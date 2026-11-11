//! Portable FFmpeg video capture plus native WASAPI audio, joined at stop.
use serde_json::{json,Value};
use std::{fs::File,io::{Write,Seek,SeekFrom},path::PathBuf,process::{Child,Command,Stdio},sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},os::windows::process::CommandExt};
use windows::Win32::Foundation::RECT;

struct Recording {
    video:Child, stop:Arc<AtomicBool>, audio:Vec<std::thread::JoinHandle<Result<PathBuf,String>>>,
    output:PathBuf, temporary:PathBuf, started_at:u64, format:String, ffmpeg:PathBuf, thumb:Option<String>, log:PathBuf,
}
static CURRENT:Mutex<Option<Recording>>=Mutex::new(None);

pub fn executable()->Result<PathBuf,String>{
    let mut candidates=Vec::new();
    if let Some(path)=std::env::var_os("WOODS_FFMPEG_PATH"){candidates.push(PathBuf::from(path));}
    if let Ok(exe)=std::env::current_exe(){if let Some(parent)=exe.parent(){
        candidates.extend([parent.join("bin/ffmpeg.exe"),parent.join("resources/bin/ffmpeg.exe"),parent.join("src-tauri/resources/bin/ffmpeg.exe")]);
    }}
    candidates.push(crate::storage::get_storage_dir().join("bin/ffmpeg.exe"));
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/bin/ffmpeg.exe"));
    candidates.push(PathBuf::from("ffmpeg.exe"));
    for path in candidates {
        if Command::new(&path).creation_flags(0x08000000).arg("-version").stdout(Stdio::null()).stderr(Stdio::null()).status().map(|s|s.success()).unwrap_or(false){return Ok(path);}
    }
    Err("FFmpeg не найден. Укажи WOODS_FFMPEG_PATH или положи portable ffmpeg.exe в папку bin рядом с Woods Island.".into())
}

struct WavWriter {file:File,frames:u64,rate:u32,channels:u16,path:PathBuf}
impl WavWriter {
    fn new(path:PathBuf,rate:u32,channels:u16)->Result<Self,String>{
        let mut file=File::create(&path).map_err(|e|e.to_string())?;file.write_all(&[0;44]).map_err(|e|e.to_string())?;
        Ok(Self{file,frames:0,rate,channels,path})
    }
    fn samples(&mut self,samples:&[f32])->Result<(),String>{
        let mut bytes=Vec::with_capacity(samples.len()*2);
        for sample in samples {let value=if sample.is_finite(){sample.clamp(-1.,1.)}else{0.};bytes.extend_from_slice(&((value*32767.).round() as i16).to_le_bytes());}
        self.file.write_all(&bytes).map_err(|e|e.to_string())?;self.frames+=samples.len() as u64/self.channels as u64;Ok(())
    }
    fn finish(mut self)->Result<PathBuf,String>{
        let length=u32::try_from(self.frames*2*self.channels as u64).map_err(|_|"Запись WAV слишком велика")?;
        let mut header=Vec::with_capacity(44);header.extend_from_slice(b"RIFF");header.extend_from_slice(&(length+36).to_le_bytes());header.extend_from_slice(b"WAVEfmt ");
        header.extend_from_slice(&16u32.to_le_bytes());header.extend_from_slice(&1u16.to_le_bytes());header.extend_from_slice(&self.channels.to_le_bytes());
        header.extend_from_slice(&self.rate.to_le_bytes());header.extend_from_slice(&(self.rate*2*u32::from(self.channels)).to_le_bytes());header.extend_from_slice(&(2*self.channels).to_le_bytes());header.extend_from_slice(&16u16.to_le_bytes());
        header.extend_from_slice(b"data");header.extend_from_slice(&length.to_le_bytes());
        self.file.seek(SeekFrom::Start(0)).map_err(|e|e.to_string())?;self.file.write_all(&header).map_err(|e|e.to_string())?;self.file.sync_all().map_err(|e|e.to_string())?;Ok(self.path)
    }
}

fn start_audio(input:bool,path:PathBuf,stop:Arc<AtomicBool>)->std::thread::JoinHandle<Result<PathBuf,String>>{
    std::thread::spawn(move||{
        let writer=std::cell::RefCell::new(None::<WavWriter>);
        crate::audio::capture_pcm_channels(input,&stop,7200,if input{1}else{2},
            |rate,channels|{*writer.borrow_mut()=Some(WavWriter::new(path.clone(),rate,channels)?);Ok(())},
            |samples|writer.borrow_mut().as_mut().ok_or("Аудиоустройство не инициализировано")?.samples(samples))?;
        writer.into_inner().ok_or("Аудиоустройство недоступно")?.finish()
    })
}

pub fn begin(rect:RECT,format:&str,settings:&Value)->Result<Value,String>{
    let mut slot=CURRENT.lock().unwrap();if slot.is_some(){return Err("Запись уже идёт".into());}
    let width=rect.right-rect.left;let height=rect.bottom-rect.top;
    if width<1 || height<1{return Err("Пустая область записи".into());}
    let ffmpeg=executable()?;let format=if format=="gif"{"gif"}else{"mp4"};let at=crate::media::now_ms();
    let output=crate::capture::output_dir(settings,"recording")?.join(format!("woods-{at}.{format}"));
    let temporary=std::env::temp_dir().join("woodscorp_obs/woods-island-recordings").join(at.to_string());std::fs::create_dir_all(&temporary).map_err(|e|e.to_string())?;
    let sound=if format=="gif"{"none"}else{settings["recordingSound"].as_str().unwrap_or("system")};
    if !["none","system","both"].contains(&sound){return Err("Неизвестный режим звука записи".into());}
    let video_path=if sound=="none"{output.clone()}else{temporary.join("video.mp4")};
    let log=temporary.join("ffmpeg.log");
    let log_file=File::create(&log).map_err(|e|e.to_string())?;
    let fps=settings["recordingFps"].as_u64().unwrap_or(30).clamp(10,60).to_string();
    let mut command=Command::new(&ffmpeg);
    command.creation_flags(0x08000000).args(["-y","-hide_banner","-loglevel","error","-f","gdigrab","-framerate",&fps,"-offset_x",&rect.left.to_string(),"-offset_y",&rect.top.to_string(),"-video_size",&format!("{width}x{height}"),"-i","desktop"]);
    if format=="mp4"{
        let crf=match settings["recordingQuality"].as_str(){Some("high")=>"18",Some("low")=>"28",_=>"23"};
        command.args(["-vf","pad=ceil(iw/2)*2:ceil(ih/2)*2","-c:v","libx264","-preset","ultrafast","-crf",crf,"-pix_fmt","yuv420p"]);
    }else{command.args(["-vf","fps=15,scale=iw:ih:flags=lanczos"]);}
    let mut video=command.arg(&video_path).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(log_file).spawn().map_err(|e|e.to_string())?;
    let stop=Arc::new(AtomicBool::new(false));let mut audio=Vec::new();
    if sound!="none"{audio.push(start_audio(false,temporary.join("system.wav"),stop.clone()));}
    if sound=="both"{audio.push(start_audio(true,temporary.join("microphone.wav"),stop.clone()));}
    std::thread::sleep(std::time::Duration::from_millis(250));
    if let Some(status)=video.try_wait().map_err(|e|e.to_string())?{stop.store(true,Ordering::SeqCst);for worker in audio{let _=worker.join();}return Err(format!("FFmpeg не смог начать запись ({status}): {}",std::fs::read_to_string(&log).unwrap_or_default().chars().take(1000).collect::<String>()));}
    if audio.iter().any(std::thread::JoinHandle::is_finished){
        stop.store(true,Ordering::SeqCst);let _=wait_for_video(&mut video);
        let mut failure="Аудиозахват не запущен".to_owned();for worker in audio {if let Ok(Err(e))=worker.join(){failure=e;}}
        return Err(failure);
    }
    let thumb=crate::capture::screenshot(rect).ok().map(|i|image::imageops::thumbnail(&i,232,144)).and_then(|i|crate::capture::data_url(&i).ok());
    *slot=Some(Recording{video,stop,audio,output,temporary,started_at:at,format:format.into(),ffmpeg,thumb,log});
    Ok(json!({"at":at,"startedAt":at,"format":format}))
}

fn wait_for_video(child:&mut Child)->Result<(),String>{
    if let Some(status)=child.try_wait().map_err(|e|e.to_string())?{return if status.success(){Ok(())}else{Err(format!("FFmpeg завершился с ошибкой: {status}"))};}
    if let Some(stdin)=child.stdin.as_mut(){stdin.write_all(b"q\n").map_err(|e|e.to_string())?;}
    let started=std::time::Instant::now();
    loop {
        if let Some(status)=child.try_wait().map_err(|e|e.to_string())?{return if status.success(){Ok(())}else{Err(format!("FFmpeg завершился с ошибкой: {status}"))};}
        if started.elapsed()>std::time::Duration::from_secs(20){let _=child.kill();let _=child.wait();return Err("FFmpeg не завершил сохранение записи за 20 секунд".into());}
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}
pub fn stop()->Result<Value,String>{
    finalize_active()?.ok_or("Запись не запущена".into())
}
/// Used before quitting/restarting. Ownership is taken out of the mutex before
/// joining workers or muxing so shutdown cannot deadlock with record callbacks.
pub fn finalize_active()->Result<Option<Value>,String>{
    let record=CURRENT.lock().unwrap().take();record.map(finish).transpose()
}
fn finish(mut record:Recording)->Result<Value,String>{
    let duration=crate::media::now_ms().saturating_sub(record.started_at);
    record.stop.store(true,Ordering::SeqCst);
    let video=wait_for_video(&mut record.video);
    if video.is_err(){let _=record.video.kill();let _=record.video.wait();}
    let mut audio_paths=Vec::new();let mut audio_error=None;
    for worker in record.audio {match worker.join(){Ok(Ok(path))=>audio_paths.push(path),Ok(Err(e))=>audio_error=Some(e),Err(_)=>audio_error=Some("Поток записи звука завершился аварийно".into())}}
    video?;if let Some(error)=audio_error{return Err(format!("Не удалось сохранить звук: {error}. Видеочасть осталась в {}",record.temporary.to_string_lossy()));}
    if !audio_paths.is_empty(){
        let mut mux=Command::new(&record.ffmpeg);mux.creation_flags(0x08000000).args(["-y","-hide_banner","-loglevel","error","-i"]).arg(record.temporary.join("video.mp4"));
        for audio in &audio_paths{mux.arg("-i").arg(audio);}
        if audio_paths.len()>1{mux.args(["-filter_complex","[1:a][2:a]amix=inputs=2:duration=longest:normalize=0[a]","-map","0:v:0","-map","[a]"]);}
        else{mux.args(["-map","0:v:0","-map","1:a:0"]);}
        mux.args(["-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart"]).arg(&record.output);
        let result=mux.output().map_err(|e|e.to_string())?;
        if !result.status.success(){return Err(format!("Не удалось объединить видео и звук: {}",String::from_utf8_lossy(&result.stderr).chars().take(1000).collect::<String>()));}
    }
    let size=std::fs::metadata(&record.output).map_err(|e|e.to_string())?.len();if size==0{return Err("FFmpeg создал пустой файл записи".into());}
    // Only this run's temporary files are removed after a verified saved output.
    for name in ["system.wav","microphone.wav","video.mp4"]{let path=record.temporary.join(name);if path.exists(){let _=std::fs::remove_file(path);}}
    let _=std::fs::remove_file(record.log);let _=std::fs::remove_dir(&record.temporary);
    Ok(json!({"path":record.output.to_string_lossy(),"durationMs":duration,"format":record.format,"size":size,"thumb":record.thumb}))
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn wav_writer_preserves_length_format_and_signed_pcm(){
        let dir=std::env::temp_dir().join("woodscorp_obs/fixtures");std::fs::create_dir_all(&dir).unwrap();let path=dir.join(format!("woods-wav-test-{}.wav",crate::media::now_ms()));let mut writer=WavWriter::new(path.clone(),48000,1).unwrap();writer.samples(&[0.,1.,-1.]).unwrap();writer.finish().unwrap();let bytes=std::fs::read(&path).unwrap();assert_eq!(&bytes[..4],b"RIFF");assert_eq!(bytes.len(),50);assert_eq!(u32::from_le_bytes(bytes[40..44].try_into().unwrap()),6);assert_eq!(i16::from_le_bytes(bytes[48..50].try_into().unwrap()),-32767);let _=std::fs::remove_file(path);
    }
}
