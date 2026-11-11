use serde_json::{json, Value};
use std::{collections::HashMap, sync::{Arc, LazyLock, Mutex, atomic::{AtomicBool,Ordering}}};
use tauri::Emitter;
use base64::Engine;

struct Cancel { cancelled:AtomicBool, signal:tokio::sync::Notify }
static REQUESTS:LazyLock<Mutex<HashMap<u64,Arc<Cancel>>>>=LazyLock::new(||Mutex::new(HashMap::new()));
static ATTACHMENT_SEQUENCE:std::sync::atomic::AtomicU64=std::sync::atomic::AtomicU64::new(0);

fn endpoint(settings:&Value,path:&str)->Result<String,String>{
    let raw=settings["aiBaseUrl"].as_str().unwrap_or("http://127.0.0.1:11434/v1").trim_end_matches('/');
    let url=reqwest::Url::parse(raw).map_err(|_|"Invalid AI base URL")?;
    if !["http","https"].contains(&url.scheme()){return Err("AI endpoint must use HTTP or HTTPS".into());}
    if url.scheme()=="http"&&!matches!(url.host_str(),Some("localhost"|"127.0.0.1"|"::1")){return Err("Remote AI endpoints must use HTTPS".into());}
    Ok(format!("{raw}/{path}"))
}
fn client()->Result<reqwest::Client,String>{reqwest::Client::builder().timeout(std::time::Duration::from_secs(120)).connect_timeout(std::time::Duration::from_secs(8)).build().map_err(|e|e.to_string())}
fn authenticate(request:reqwest::RequestBuilder)->reqwest::RequestBuilder{
    match crate::storage::load_secret("ai").filter(|s|!s.is_empty()){Some(key)=>request.bearer_auth(key),None=>request}
}
pub async fn models(settings:&Value)->Result<Vec<Value>,String>{
    let response=authenticate(client()?.get(endpoint(settings,"models")?)).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;
    let data:Value=response.json().await.map_err(|e|e.to_string())?;
    let list=data["data"].as_array().ok_or("Provider did not return an OpenAI-compatible model list")?;
    Ok(list.iter().filter_map(|m|m["id"].as_str().map(|id|json!({"id":id,"name":id}))).collect())
}
pub fn cancel(id:u64)->bool{
    if let Some(token)=REQUESTS.lock().unwrap().get(&id){token.cancelled.store(true,Ordering::SeqCst);token.signal.notify_one();true}else{false}
}

pub fn start(app:tauri::AppHandle,id:u64,settings:Value,messages:Vec<Value>){
    let token=Arc::new(Cancel{cancelled:AtomicBool::new(false),signal:tokio::sync::Notify::new()});
    if let Some(old)=REQUESTS.lock().unwrap().insert(id,token.clone()){old.cancelled.store(true,Ordering::SeqCst);old.signal.notify_one();}
    tauri::async_runtime::spawn(async move{
        let result=stream(&app,id,&settings,messages,&token).await;
        REQUESTS.lock().unwrap().remove(&id);
        if !token.cancelled.load(Ordering::SeqCst){
            match result{Ok(())=>{let _=app.emit("ai:done",id);},Err(message)=>{let _=app.emit("ai:error",json!({"id":id,"message":message}));}}
        }
    });
}

pub fn resolve_messages(messages:Vec<Value>)->Result<Vec<Value>,String>{
    let mut result=Vec::new();
    for message in messages {
        let role=message["role"].as_str().unwrap_or("user");
        if !["system","user","assistant"].contains(&role){return Err("Unsupported message role".into());}
        let mut content=Vec::new();
        if let Some(text)=message["content"].as_str(){content.push(json!({"type":"text","text":text}));}
        else if let Some(items)=message["content"].as_array(){content.extend(items.clone());}
        if let Some(ids)=message["attachments"].as_array(){
            for id in ids.iter().filter_map(Value::as_str){
                if !safe_id(id){return Err("Invalid attachment ID".into());}
                let info=crate::storage::load_json_file(&format!("attachments/{id}.json")).ok_or("Attachment no longer exists")?;
                if let Some(url)=info["dataUrl"].as_str(){content.push(json!({"type":"image_url","image_url":{"url":url}}));}
                else if let Some(text)=info["text"].as_str(){content.push(json!({"type":"text","text":format!("File: {}\n{}",info["name"].as_str().unwrap_or("document"),text)}));}
            }
        }
        result.push(json!({"role":role,"content":content}));
    }
    if result.is_empty(){return Err("No messages supplied".into());} Ok(result)
}

async fn stream(app:&tauri::AppHandle,id:u64,settings:&Value,messages:Vec<Value>,cancel:&Arc<Cancel>)->Result<(),String>{
    let messages=resolve_messages(messages)?;
    let model=match settings["aiModel"].as_str().filter(|s|!s.is_empty()){Some(m)=>m.to_owned(),None=>models(settings).await?.first().and_then(|m|m["id"].as_str()).ok_or("No AI model is available")?.to_owned()};
    let request=authenticate(client()?.post(endpoint(settings,"chat/completions")?)).json(&json!({"model":model,"messages":messages,"stream":true}));
    let mut response=tokio::select!{response=request.send()=>response.map_err(|e|e.to_string())?,_ = cancel.signal.notified()=>return Ok(())};
    if !response.status().is_success(){return Err(format!("AI provider returned HTTP {}. Check endpoint, model and your API key.",response.status()));}
    let mut pending=Vec::new();
    loop{
        let chunk=tokio::select!{chunk=response.chunk()=>chunk.map_err(|e|e.to_string())?,_=cancel.signal.notified()=>return Ok(())};
        let Some(chunk)=chunk else{break;}; pending.extend_from_slice(&chunk);
        if pending.len()>2*1024*1024{return Err("Invalid AI stream: oversized event".into());}
        while let Some(index)=pending.iter().position(|c|*c==b'\n'){
            let line=pending.drain(..=index).collect::<Vec<_>>();
            let line=std::str::from_utf8(&line).map_err(|_|"AI stream contained invalid UTF-8")?.trim();
            if let Some(data)=line.strip_prefix("data:"){
                let data=data.trim();if data=="[DONE]"{return Ok(());}
                if let Some(text)=parse_chunk(data)?{let _=app.emit("ai:chunk",json!({"id":id,"text":text}));}
            }
        }
        if cancel.cancelled.load(Ordering::SeqCst){return Ok(());}
    }
    Ok(())
}

fn parse_chunk(data:&str)->Result<Option<String>,String>{
    let event:Value=serde_json::from_str(data).map_err(|_|"Invalid AI stream event")?;
    if let Some(error)=event["error"]["message"].as_str(){return Err(error.to_owned());}
    Ok(event["choices"][0]["delta"]["content"].as_str().map(str::to_owned))
}
fn safe_id(id:&str)->bool{!id.is_empty()&&id.len()<100&&id.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='_')}

pub fn attachment(name:&str,data:&[u8])->Result<Value,String>{
    if data.len()>20*1024*1024{return Err("Attachment exceeds 20 MB".into());}
    let name=std::path::Path::new(name).file_name().ok_or("Invalid attachment name")?.to_string_lossy().into_owned();
    let id=format!("{}-{}",crate::media::now_ms(),ATTACHMENT_SEQUENCE.fetch_add(1,Ordering::Relaxed));
    let info=if let Ok(image)=image::load_from_memory(data){
        let url=crate::capture::data_url(&image.into_rgba8())?;
        json!({"id":id,"name":name,"kind":"image","dataUrl":url,"thumb":url,"chars":0})
    }else{
        let text=crate::documents::extract(&name,data)?;
        if text.chars().any(|c|c=='\0'){return Err("Binary document format is not yet supported".into());}
        let truncated=text.chars().count()>100_000;
        let text:String=text.chars().take(100_000).collect();
        json!({"id":id,"name":name,"kind":"document","text":text,"chars":text.chars().count(),"truncated":truncated})
    };
    crate::storage::save_json_file(&format!("attachments/{id}.json"),&info)?;
    let mut public=info;public.as_object_mut().unwrap().remove("dataUrl");public.as_object_mut().unwrap().remove("text");Ok(public)
}
pub fn attachment_data(name:&str,url:&str)->Result<Value,String>{
    let encoded=url.split_once(',').ok_or("Invalid attachment data URL")?.1;
    let bytes=base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e|e.to_string())?; attachment(name,&bytes)
}
pub fn attachment_paths(paths:&[String])->Value{
    let mut items=Vec::new();let mut errors=Vec::new();
    for path in paths{
        match std::fs::read(path).map_err(|e|e.to_string()).and_then(|data|attachment(path,&data)){Ok(item)=>items.push(item),Err(error)=>errors.push(format!("{}: {error}",std::path::Path::new(path).file_name().unwrap_or_default().to_string_lossy()))}
    }
    json!({"items":items,"errors":errors})
}
pub fn prune(keep:&[String])->Result<(),String>{
    let dir=crate::storage::get_storage_dir().join("attachments");
    if let Ok(entries)=std::fs::read_dir(dir){for entry in entries.flatten(){let p=entry.path();let id=p.file_stem().unwrap_or_default().to_string_lossy();if p.extension().map(|e|e=="json").unwrap_or(false)&&safe_id(&id)&&!keep.iter().any(|k|k==&id){std::fs::remove_file(p).map_err(|e|e.to_string())?;}}}Ok(())
}

#[cfg(test)] mod tests{
    use super::*;
    #[test] fn stream_parser_preserves_unicode_and_errors(){assert_eq!(parse_chunk(r#"{"choices":[{"delta":{"content":"Привет 🌲"}}]}"#).unwrap(),Some("Привет 🌲".into()));assert!(parse_chunk(r#"{"error":{"message":"quota"}}"#).is_err());}
    #[test] fn endpoint_prevents_cleartext_remote_api_keys(){assert!(endpoint(&json!({"aiBaseUrl":"http://remote.example/v1"}),"models").is_err());assert_eq!(endpoint(&json!({"aiBaseUrl":"http://127.0.0.1:11434/v1/"}),"models").unwrap(),"http://127.0.0.1:11434/v1/models");}
}
