//! User-triggered microphone capture and BYOK OpenAI-compatible transcription.
use serde_json::{json,Value};
use std::sync::{Arc,LazyLock,Mutex,atomic::{AtomicBool,Ordering}};
use tauri::Emitter;

struct Session { stop:AtomicBool, cancelled:AtomicBool, transcribing:AtomicBool, wake:tokio::sync::Notify }
static CURRENT:LazyLock<Mutex<Option<Arc<Session>>>>=LazyLock::new(||Mutex::new(None));
const MAX_SECONDS:u64=180;

fn endpoint(settings:&Value,path:&str)->Result<String,String>{
    let raw=settings["sttBaseUrl"].as_str().unwrap_or("https://api.groq.com/openai/v1").trim_end_matches('/');
    let url=reqwest::Url::parse(raw).map_err(|_|"Некорректный адрес STT-провайдера")?;
    if !["http","https"].contains(&url.scheme()) || (url.scheme()=="http"&&!matches!(url.host_str(),Some("localhost"|"127.0.0.1"|"::1"))) {
        return Err("STT требует HTTPS или локальный HTTP endpoint".into());
    }
    Ok(format!("{raw}/{path}"))
}
fn client()->Result<reqwest::Client,String>{reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(10)).timeout(std::time::Duration::from_secs(120)).build().map_err(|e|e.to_string())}
fn auth(request:reqwest::RequestBuilder)->reqwest::RequestBuilder{
    match crate::storage::load_secret("stt").filter(|s|!s.is_empty()){Some(key)=>request.bearer_auth(key),None=>request}
}
pub async fn test(settings:&Value)->Result<bool,String>{
    let response=auth(client()?.get(endpoint(settings,"models")?)).send().await.map_err(|e|e.to_string())?;
    if !response.status().is_success(){return Err(format!("STT-провайдер вернул HTTP {}. Проверь адрес и личный API-ключ.",response.status()));}
    let data:Value=response.json().await.map_err(|e|e.to_string())?;
    let model=settings["sttModel"].as_str().unwrap_or("whisper-large-v3-turbo");
    if data["data"].as_array().map(|models|models.iter().any(|m|m["id"].as_str()==Some(model))).unwrap_or(false){Ok(true)}
    else{Err(format!("STT-модель {model} отсутствует у провайдера"))}
}

fn wav(samples:&[f32],source_rate:u32)->Result<Vec<u8>,String>{
    if source_rate==0 || samples.is_empty(){return Err("Не удалось получить звук микрофона".into());}
    let output_rate=16_000u32;
    let count=((samples.len() as u64)*u64::from(output_rate)/u64::from(source_rate)) as usize;
    if count==0 || count>output_rate as usize*(MAX_SECONDS+2) as usize{return Err("Некорректная длина записи диктовки".into());}
    let size=(count*2) as u32;
    let mut out=Vec::with_capacity(44+size as usize);
    out.extend_from_slice(b"RIFF");out.extend_from_slice(&(36+size).to_le_bytes());out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());out.extend_from_slice(&1u16.to_le_bytes());out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&output_rate.to_le_bytes());out.extend_from_slice(&(output_rate*2).to_le_bytes());out.extend_from_slice(&2u16.to_le_bytes());out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");out.extend_from_slice(&size.to_le_bytes());
    for index in 0..count {
        let at=index as f64*source_rate as f64/output_rate as f64;let left=at.floor() as usize;let fraction=(at-left as f64) as f32;
        let a=samples[left.min(samples.len()-1)];let b=samples[(left+1).min(samples.len()-1)];
        let sample=(a+(b-a)*fraction).clamp(-1.,1.);let sample=if sample.is_finite(){sample}else{0.};
        out.extend_from_slice(&((sample*32767.).round() as i16).to_le_bytes());
    }
    Ok(out)
}

async fn transcribe(settings:&Value,wave:Vec<u8>,token:&Session)->Result<String,String>{
    let model=settings["sttModel"].as_str().filter(|s|!s.is_empty()).unwrap_or("whisper-large-v3-turbo");
    let part=reqwest::multipart::Part::bytes(wave).file_name("dictation.wav").mime_str("audio/wav").map_err(|e|e.to_string())?;
    let mut form=reqwest::multipart::Form::new().part("file",part).text("model",model.to_owned()).text("response_format","json");
    if let Some(language)=settings["sttLanguage"].as_str().filter(|s|!s.is_empty()){form=form.text("language",language.to_owned());}
    let request=auth(client()?.post(endpoint(settings,"audio/transcriptions")?)).multipart(form);
    if token.cancelled.load(Ordering::SeqCst){return Err("Диктовка отменена".into());}
    let response=tokio::select!{r=request.send()=>r.map_err(|e|e.to_string())?,_=token.wake.notified()=>return Err("Диктовка отменена".into())};
    if !response.status().is_success(){return Err(format!("Распознавание недоступно: HTTP {}. Проверь STT-модель и ключ.",response.status()));}
    let data:Value=tokio::select!{r=response.json()=>r.map_err(|e|e.to_string())?,_=token.wake.notified()=>return Err("Диктовка отменена".into())};
    data["text"].as_str().map(|s|s.trim().to_owned()).filter(|s|!s.is_empty()).ok_or("Провайдер не распознал текст".into())
}

pub fn toggle(app:tauri::AppHandle,settings:Value,target:Option<String>)->Result<bool,String>{
    let address=endpoint(&settings,"audio/transcriptions")?;
    let remote=reqwest::Url::parse(&address).ok().and_then(|u|u.host_str().map(str::to_owned)).map(|host|!matches!(host.as_str(),"localhost"|"127.0.0.1"|"::1")).unwrap_or(true);
    if remote && crate::storage::load_secret("stt").filter(|s|!s.is_empty()).is_none(){return Err("Добавь личный STT API-ключ в настройках диктовки".into());}
    let token={
        let mut current=CURRENT.lock().unwrap();
        if let Some(session)=current.as_ref(){
            if session.transcribing.load(Ordering::SeqCst){return Err("Дождись распознавания или отмени диктовку".into());}
            session.stop.store(true,Ordering::SeqCst);return Ok(true);
        }
        let token=Arc::new(Session{stop:AtomicBool::new(false),cancelled:AtomicBool::new(false),transcribing:AtomicBool::new(false),wake:tokio::sync::Notify::new()});
        *current=Some(token.clone());token
    };
    let target=target.unwrap_or_else(||"external".into());
    std::thread::spawn(move||{
        let mut rate=0;let mut captured=Vec::new();let mut emitted=std::time::Instant::now();
        let capture=crate::audio::capture_pcm(true,&token.stop,MAX_SECONDS,
            |sample_rate|{rate=sample_rate;if !token.cancelled.load(Ordering::SeqCst){let _=app.emit("dictation:state",json!({"state":"recording","target":target}));}Ok(())},
            |samples|{captured.extend_from_slice(samples);if !token.cancelled.load(Ordering::SeqCst)&&emitted.elapsed()>std::time::Duration::from_millis(80){let level=(samples.iter().filter(|s|s.is_finite()).map(|s|s*s).sum::<f32>()/samples.len().max(1) as f32).sqrt();let _=app.emit("dictation:level",level);emitted=std::time::Instant::now();}Ok(())});
        tauri::async_runtime::spawn(async move{
            let outcome=async{
                capture?;if token.cancelled.load(Ordering::SeqCst){return Ok(());}
                if captured.len()<(rate as usize/5) {return Err("Запись слишком короткая для распознавания".into());}
                if !captured.iter().any(|s|s.is_finite()&&s.abs()>0.001){return Err("Микрофон не передал звук. Проверь устройство и отключение микрофона.".into());}
                let wave=wav(&captured,rate)?;
                token.transcribing.store(true,Ordering::SeqCst);let _=app.emit("dictation:state",json!({"state":"transcribing","target":target}));
                let text=transcribe(&settings,wave,&token).await?;
                if token.cancelled.load(Ordering::SeqCst){return Ok(());}
                let pasted=target!="chat"&&settings["dictatePaste"].as_bool().unwrap_or(false);
                if pasted {crate::clipboard::paste_to_focused_window(&text)?;}
                else if target!="chat" {crate::clipboard::set_text(&text)?;}
                let _=app.emit("dictation:done",json!({"target":target,"text":text,"pasted":pasted}));Ok::<(),String>(())
            }.await;
            if !token.cancelled.load(Ordering::SeqCst){if let Err(error)=outcome {let _=app.emit("dictation:error",error);}}
            let mut current=CURRENT.lock().unwrap();
            if current.as_ref().map(|s|Arc::ptr_eq(s,&token)).unwrap_or(false){*current=None;let _=app.emit("dictation:state",json!({"state":"idle","target":target}));}
        });
    });
    Ok(true)
}
pub fn cancel(app:&tauri::AppHandle)->bool{
    if let Some(session)=CURRENT.lock().unwrap().take(){session.cancelled.store(true,Ordering::SeqCst);session.stop.store(true,Ordering::SeqCst);session.wake.notify_one();let _=app.emit("dictation:state",json!({"state":"idle"}));true}else{false}
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn wav_is_valid_mono_16khz_pcm(){let bytes=wav(&vec![0.5;48000],48000).unwrap();assert_eq!(&bytes[..4],b"RIFF");assert_eq!(u32::from_le_bytes(bytes[24..28].try_into().unwrap()),16000);assert_eq!(bytes.len(),32044);assert_eq!(i16::from_le_bytes(bytes[44..46].try_into().unwrap()),16384);}
    #[test]fn endpoint_only_sends_keys_to_https_or_loopback(){assert!(endpoint(&json!({"sttBaseUrl":"http://remote.example/v1"}),"models").is_err());assert_eq!(endpoint(&json!({"sttBaseUrl":"http://127.0.0.1:8000/v1/"}),"audio/transcriptions").unwrap(),"http://127.0.0.1:8000/v1/audio/transcriptions");}
}
