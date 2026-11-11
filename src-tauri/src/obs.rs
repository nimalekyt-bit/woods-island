use serde_json::{json, Value};
use futures_util::{SinkExt, StreamExt};
use base64::Engine;
use sha2::{Sha256, Digest};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tauri::Emitter;

type Socket=tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

fn auth(password:&str,salt:&str,challenge:&str)->String{
    let secret=base64::engine::general_purpose::STANDARD.encode(Sha256::digest(format!("{password}{salt}").as_bytes()));
    base64::engine::general_purpose::STANDARD.encode(Sha256::digest(format!("{secret}{challenge}").as_bytes()))
}
async fn next(socket:&mut Socket)->Result<Value,String>{
    loop{
        let message=tokio::time::timeout(std::time::Duration::from_secs(3),socket.next()).await.map_err(|_|"OBS WebSocket timed out")?.ok_or("OBS disconnected")?.map_err(|e|e.to_string())?;
        match message{Message::Text(text)=>return serde_json::from_str(&text).map_err(|e|e.to_string()),Message::Ping(p)=>socket.send(Message::Pong(p)).await.map_err(|e|e.to_string())?,Message::Close(_)=>return Err("OBS disconnected".into()),_=>{}}
    }
}
async fn connect(port:u16)->Result<Socket,String>{
    let (mut socket,_)=tokio::time::timeout(std::time::Duration::from_secs(2),connect_async(format!("ws://127.0.0.1:{port}"))).await.map_err(|_|"OBS is unavailable")?.map_err(|_|"OBS WebSocket is not running")?;
    let hello=next(&mut socket).await?;
    if hello["op"]!=json!(0){return Err("OBS server did not send protocol v5 Hello".into());}
    let mut identify=json!({"rpcVersion":1,"eventSubscriptions":0});
    if let Some(authentication)=hello["d"]["authentication"].as_object(){
        let password=crate::storage::load_secret("obs").ok_or("Set the OBS WebSocket password in settings")?;
        let salt=authentication["salt"].as_str().ok_or("Invalid OBS authentication salt")?;
        let challenge=authentication["challenge"].as_str().ok_or("Invalid OBS authentication challenge")?;
        identify["authentication"]=json!(auth(&password,salt,challenge));
    }
    socket.send(Message::Text(json!({"op":1,"d":identify}).to_string().into())).await.map_err(|e|e.to_string())?;
    if next(&mut socket).await?["op"]!=json!(2){return Err("OBS authentication failed".into());} Ok(socket)
}
async fn request(socket:&mut Socket,kind:&str)->Result<Value,String>{
    socket.send(Message::Text(json!({"op":6,"d":{"requestType":kind,"requestId":kind}}).to_string().into())).await.map_err(|e|e.to_string())?;
    loop{
        let response=next(socket).await?;
        if response["op"]==json!(7)&&response["d"]["requestId"]==json!(kind){
            if response["d"]["requestStatus"]["result"]!=json!(true){return Err(response["d"]["requestStatus"]["comment"].as_str().unwrap_or("OBS request failed").to_owned());}
            return Ok(response["d"]["responseData"].clone());
        }
    }
}
pub async fn state(port:u16)->Value{
    let result=async{
        let mut socket=connect(port).await?;
        let stream=request(&mut socket,"GetStreamStatus").await?;
        let record=request(&mut socket,"GetRecordStatus").await?;
        let _=socket.close(None).await;
        Ok::<_,String>(json!({"connected":true,"streaming":stream["outputActive"],"recording":record["outputActive"],"paused":record["outputPaused"],"problem":null,"streamDuration":stream["outputDuration"],"recordDuration":record["outputDuration"]}))
    }.await;
    result.unwrap_or_else(|error|json!({"connected":false,"streaming":false,"recording":false,"paused":false,"problem":error}))
}
pub async fn action(port:u16,what:&str,on:bool)->Result<(),String>{
    let kind=match (what,on){("stream",true)=>"StartStream",("stream",false)=>"StopStream",("record",true)=>"StartRecord",("record",false)=>"StopRecord",("pause",true)=>"PauseRecord",("pause",false)=>"ResumeRecord",_=>return Err("Unknown OBS action".into())};
    let mut socket=connect(port).await?;request(&mut socket,kind).await?;let _=socket.close(None).await;Ok(())
}
pub fn start_loop(app:tauri::AppHandle,state:std::sync::Arc<crate::AppState>){
    tauri::async_runtime::spawn(async move{
        let mut previous=Value::Null;
        loop{
            let settings=state.settings.lock().unwrap().clone();
            if settings["obsStatus"].as_bool().unwrap_or(false){
                let status=self::state(settings["obsPort"].as_u64().unwrap_or(4455) as u16).await;
                if status!=previous{let _=app.emit("obs:state",&status);previous=status;}
            }
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    });
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn auth_uses_obs_two_stage_sha256(){let result=auth("secret","salt","challenge");assert_eq!(base64::engine::general_purpose::STANDARD.decode(result).unwrap().len(),32);assert_ne!(auth("secret","salt","challenge"),auth("other","salt","challenge"));}
}
