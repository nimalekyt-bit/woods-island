//! Original Codex artwork stays in the user's profile, never in product resources.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs::{self, File, OpenOptions}, io::{Read, Seek, SeekFrom, Write, Cursor}, path::{Path, PathBuf}, sync::Mutex};

pub const IDS: [&str; 9] = ["codex","dewey","fireball","hoots","rocky","seedy","stacky","bsod","null-signal"];
const MAX_HEADER: u64 = 8 * 1024 * 1024;
const MAX_ASSET: u64 = 8 * 1024 * 1024;
const MAX_TOTAL: u64 = 64 * 1024 * 1024;
const MAX_INDEX: u64 = 64 * 1024;
static IMPORT_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct PetEntry { id:String, relative_path:String, sha256:String, bytes:u64, width:u32, height:u32 }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ImportIndex { schema:u8, source:String, pets:Vec<PetEntry> }
fn known(id:&str)->bool { IDS.contains(&id) }
fn safe_file(root:&Path, relative:&str)->Result<PathBuf,String> {
    let mut parts=relative.split('/');
    let id=parts.next().ok_or("Pet ID missing")?;
    if !known(id)||parts.next()!=Some("sheet.webp")||parts.next().is_some() {return Err("Unsafe pet asset path".into());}
    reject_reparse(root)?;
    let directory=root.join(id); reject_reparse(&directory)?;
    let path=directory.join("sheet.webp");reject_reparse(&path)?;
    Ok(path)
}
fn reject_reparse(path:&Path)->Result<(),String> {
    if let Ok(metadata)=fs::symlink_metadata(path) {
        #[cfg(windows)] {use std::os::windows::fs::MetadataExt; if metadata.file_attributes()&0x400!=0{return Err("Reparse points are not allowed for pet assets".into());}}
        if metadata.file_type().is_symlink(){return Err("Symbolic links are not allowed for pet assets".into());}
    }
    Ok(())
}
fn profile_root(profile:&Path)->Result<PathBuf,String> {
    reject_reparse(profile)?;
    let pets=profile.join("pets");reject_reparse(&pets)?;
    let root=pets.join("codex");reject_reparse(&root)?;
    Ok(root)
}
fn read_index(root:&Path)->Result<ImportIndex,String> {
    let path=root.join("index.json");reject_reparse(&path)?;
    if fs::metadata(&path).map_err(|e|e.to_string())?.len()>MAX_INDEX{return Err("Pet index is too large".into());}
    let index:ImportIndex=serde_json::from_slice(&fs::read(path).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    if index.schema!=1||index.pets.len()>IDS.len()||index.source.len()>4096{return Err("Unsupported pet index".into());}
    let mut seen=std::collections::HashSet::new();
    for pet in &index.pets {
        safe_file(root,&pet.relative_path)?;
        if !known(&pet.id)||!seen.insert(&pet.id)||pet.relative_path!=format!("{}/sheet.webp",pet.id)||pet.sha256.len()!=64||!pet.sha256.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b))||pet.bytes==0||pet.bytes>MAX_ASSET||pet.width!=1536||pet.height!=2288{return Err("Invalid pet metadata".into());}
    }
    Ok(index)
}
fn catalog(root:&Path, status:&str, error:Option<String>)->Value {
    let index=read_index(root).ok();
    let pets:Vec<Value>=IDS.iter().map(|id| {
        let entry=index.as_ref().and_then(|index|index.pets.iter().find(|pet|pet.id==*id));
        let valid=entry.map(|entry|cached_asset_valid(root,entry)).unwrap_or(false);
        json!({"id":id,"available":valid,"sha256":entry.map(|pet|&pet.sha256),"bytes":entry.map(|pet|pet.bytes)})
    }).collect();
    let ready=pets.iter().filter(|pet|pet["available"]==true).count();
    json!({"status":if ready==9{"ready"}else if ready>0{"partial"}else{status},"pets":pets,"error":error,"source":index.map(|index|index.source)})
}
fn cached_asset_valid(root:&Path,entry:&PetEntry)->bool {
    let Ok(path)=safe_file(root,&entry.relative_path) else{return false;};
    let Ok(mut file)=File::open(path) else{return false;};
    if !file.metadata().map(|meta|meta.is_file()&&meta.len()==entry.bytes).unwrap_or(false){return false;}
    let mut hash=Sha256::new();
    let mut block=[0u8;65536];
    loop {match file.read(&mut block){Ok(0)=>break,Ok(count)=>hash.update(&block[..count]),Err(_)=>return false}}
    format!("{:x}",hash.finalize())==entry.sha256
}
fn all_ready(value:&Value)->bool {value["pets"].as_array().map(|pets|pets.len()==9&&pets.iter().all(|pet|pet["available"]==true)).unwrap_or(false)}

/// Read only the ASAR header and selected ranges; never load the 737 MiB archive.
fn asar_header(file:&mut File)->Result<(Value,u64,u64),String> {
    let length=file.metadata().map_err(|e|e.to_string())?.len();
    let mut prefix=[0u8;8];file.read_exact(&mut prefix).map_err(|e|e.to_string())?;
    if u32::from_le_bytes(prefix[..4].try_into().unwrap())!=4{return Err("Invalid ASAR size pickle".into());}
    let size=u32::from_le_bytes(prefix[4..].try_into().unwrap()) as u64;
    if !(8..=MAX_HEADER).contains(&size)||size.checked_add(8).filter(|end|*end<=length).is_none(){return Err("ASAR header exceeds limits".into());}
    let mut bytes=vec![0;size as usize];file.read_exact(&mut bytes).map_err(|e|e.to_string())?;
    let pickle=u32::from_le_bytes(bytes[..4].try_into().unwrap()) as usize;
    let json_length=u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
    if pickle.checked_add(4)!=Some(bytes.len())||json_length.checked_add(8).filter(|end|*end<=bytes.len()).is_none(){return Err("Invalid ASAR header pickle".into());}
    let value:Value=serde_json::from_slice(&bytes[8..8+json_length]).map_err(|e|e.to_string())?;
    Ok((value,8+size,length))
}
fn asset_name(name:&str,id:&str)->bool {
    let Some(tail)=name.strip_prefix(&format!("{id}-spritesheet-v")) else{return false;};
    let Some((version,hash))=tail.split_once('.') else{return false;};
    let Some(hash)=hash.strip_suffix(".webp") else{return false;};
    !version.is_empty()&&version.bytes().all(|b|b.is_ascii_digit())&&(8..=64).contains(&hash.len())&&hash.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b))
}
fn asar_asset(file:&mut File,header:&Value,base:u64,length:u64,id:&str)->Result<Vec<u8>,String> {
    let files=header["files"]["webview"]["files"]["assets"]["files"].as_object().ok_or("ASAR webview assets missing")?;
    let matches:Vec<_>=files.iter().filter(|(name,_)|asset_name(name,id)).collect();
    if matches.len()!=1{return Err(format!("Expected exactly one Codex atlas for {id}"));}
    let entry=matches[0].1;
    if entry.get("link").is_some()||entry.get("files").is_some()||entry.get("unpacked").is_some(){return Err("ASAR links/unpacked entries are unsupported".into());}
    let size=entry["size"].as_u64().filter(|size|*size>0&&*size<=MAX_ASSET).ok_or("Atlas size exceeds limit")?;
    let offset=entry["offset"].as_str().ok_or("ASAR offset missing")?;
    if offset.is_empty()||!offset.bytes().all(|b|b.is_ascii_digit()){return Err("Invalid ASAR offset".into());}
    let offset=offset.parse::<u64>().map_err(|e|e.to_string())?;
    let start=base.checked_add(offset).ok_or("ASAR offset overflow")?;
    if start.checked_add(size).filter(|end|*end<=length).is_none(){return Err("ASAR atlas is outside archive".into());}
    file.seek(SeekFrom::Start(start)).map_err(|e|e.to_string())?;
    let mut bytes=vec![0;size as usize];file.read_exact(&mut bytes).map_err(|e|e.to_string())?;
    Ok(bytes)
}
fn validate_art(bytes:&[u8])->Result<(),String> {
    if bytes.len() as u64>MAX_ASSET||bytes.len()<20||&bytes[..4]!=b"RIFF"||&bytes[8..12]!=b"WEBP" {return Err("Invalid WebP atlas".into());}
    let mut reader=image::ImageReader::with_format(Cursor::new(bytes),image::ImageFormat::WebP);
    let mut limits=image::Limits::default();limits.max_image_width=Some(1536);limits.max_image_height=Some(2288);limits.max_alloc=Some(32*1024*1024);reader.limits(limits);
    if reader.into_dimensions().map_err(|e|e.to_string())? != (1536,2288){return Err("Unsupported Codex atlas dimensions".into());}
    let mut reader=image::ImageReader::with_format(Cursor::new(bytes),image::ImageFormat::WebP);
    let mut limits=image::Limits::default();limits.max_image_width=Some(1536);limits.max_image_height=Some(2288);limits.max_alloc=Some(32*1024*1024);reader.limits(limits);
    let decoded=reader.decode().map_err(|e|e.to_string())?;
    if !decoded.color().has_alpha(){return Err("Codex atlas must have alpha".into());}
    let rgba=decoded.into_rgba8();
    if !rgba.pixels().any(|pixel|pixel[3]==0){return Err("Codex atlas has no transparent background".into());}
    for (row,count) in [6,8,8,4,5,8,6,6,6,8,8].iter().enumerate() { for column in 0..*count {
        if !(0..208).any(|y|(0..192).any(|x|rgba.get_pixel(column*192+x,row as u32*208+y)[3]>0)){return Err(format!("Empty required Codex frame {row}:{column}"));}
    }}
    Ok(())
}
fn discover()->Option<PathBuf> {
    // Query the installed Store package only. Reuse the existing Windows API
    // feature set instead of compiling a second, larger WinRT binding library.
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        if let Ok(output)=std::process::Command::new("powershell.exe")
            .args(["-NoProfile","-NonInteractive","-Command",
                "Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty InstallLocation"])
            .creation_flags(0x08000000).output() {
            if output.status.success() && output.stdout.len()<8192 {
                let folder=String::from_utf8_lossy(&output.stdout);
                let archive=PathBuf::from(folder.trim()).join("app/resources/app.asar");
                if !folder.trim().is_empty() && archive.is_file(){return Some(archive);}
            }
        }
    }
    for (variable,suffix) in [("LOCALAPPDATA","Programs/Codex/resources/app.asar"),("LOCALAPPDATA","Programs/Codex/app/resources/app.asar"),("LOCALAPPDATA","Codex/resources/app.asar"),("ProgramFiles","Codex/resources/app.asar")] {
        if let Some(directory)=std::env::var_os(variable) {let path=PathBuf::from(directory).join(suffix);if path.is_file(){return Some(path);}}
    }
    None
}
fn import_archive(root:&Path,archive:&Path)->Result<(),String> {
    reject_reparse(archive)?;
    let mut file=File::open(archive).map_err(|e|e.to_string())?;
    let (header,base,length)=asar_header(&mut file)?;
    fs::create_dir_all(root).map_err(|e|e.to_string())?;reject_reparse(root)?;
    let mut index=ImportIndex{schema:1,source:archive.to_string_lossy().into_owned(),pets:Vec::new()};
    let mut total=0;
    for id in IDS {
        let bytes=asar_asset(&mut file,&header,base,length,id)?;
        total+=bytes.len() as u64;if total>MAX_TOTAL{return Err("Pet import exceeds total limit".into());}
        validate_art(&bytes)?;
        let relative=format!("{id}/sheet.webp");
        let destination=safe_file(root,&relative)?;
        let directory=destination.parent().ok_or("Invalid atlas directory")?;fs::create_dir_all(directory).map_err(|e|e.to_string())?;reject_reparse(directory)?;
        let temp=directory.join(format!("sheet-{}.tmp",std::process::id()));reject_reparse(&temp)?;
        let result=(||{let mut output=OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|e|e.to_string())?;output.write_all(&bytes).and_then(|_|output.sync_all()).map_err(|e|e.to_string())?;drop(output);fs::rename(&temp,&destination).map_err(|e|e.to_string())})();
        if result.is_err(){let _=fs::remove_file(&temp);}result?;
        index.pets.push(PetEntry{id:id.into(),relative_path:relative,sha256:format!("{:x}",Sha256::digest(&bytes)),bytes:bytes.len() as u64,width:1536,height:2288});
    }
    reject_reparse(&root.join("index.tmp"))?;reject_reparse(&root.join("index.json"))?;
    crate::storage::atomic_write(&root.join("index.json"),&serde_json::to_vec_pretty(&index).map_err(|e|e.to_string())?)
}
pub fn import_profile(profile:&Path,refresh:bool)->Value {
    let Ok(_guard)=IMPORT_LOCK.lock() else {return json!({"status":"error","pets":[],"error":"Pet import lock poisoned"});};
    let root=match profile_root(profile){Ok(root)=>root,Err(error)=>return json!({"status":"error","pets":[],"error":error})};
    let cached=catalog(&root,"not_installed",None);
    if !refresh&&all_ready(&cached){return cached;}
    let Some(archive)=discover() else{return catalog(&root,"not_installed",Some("Установленный Codex с поддерживаемыми питомцами не найден".into()));};
    match import_archive(&root,&archive){Ok(())=>catalog(&root,"ready",None),Err(error)=>catalog(&root,"error",Some(error))}
}
pub fn load_asset(profile:&Path,id:&str)->Result<String,String> {
    use base64::Engine;
    if !known(id){return Err("Unknown local pet ID".into());}
    let root=profile_root(profile)?;
    let index=read_index(&root)?;
    let entry=index.pets.iter().find(|entry|entry.id==id).ok_or("Local pet is unavailable")?;
    let path=safe_file(&root,&entry.relative_path)?;
    if fs::metadata(&path).map_err(|e|e.to_string())?.len()!=entry.bytes{return Err("Local atlas size changed".into());}
    let bytes=fs::read(path).map_err(|e|e.to_string())?;
    if format!("{:x}",Sha256::digest(&bytes))!=entry.sha256{return Err("Local atlas checksum changed".into());}
    validate_art(&bytes)?;
    Ok(format!("data:image/webp;base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cached_asset_detects_same_size_modification() {
        let directory=root();
        fs::create_dir(directory.join("codex")).unwrap();
        let path=directory.join("codex/sheet.webp");
        fs::write(&path,b"original").unwrap();
        let entry=PetEntry{id:"codex".into(),relative_path:"codex/sheet.webp".into(),sha256:format!("{:x}",Sha256::digest(b"original")),bytes:8,width:1536,height:2288};
        assert!(cached_asset_valid(&directory,&entry));
        fs::write(&path,b"modified").unwrap();
        assert!(!cached_asset_valid(&directory,&entry));
        fs::remove_file(path).unwrap();
        fs::remove_dir(directory.join("codex")).unwrap();
        fs::remove_dir(directory).unwrap();
    }
    fn root()->PathBuf {let path=std::env::temp_dir().join(format!("woods-pets-test-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));fs::create_dir_all(&path).unwrap();path}
    fn archive(path:&Path,header:Value,data:&[u8])->File {
        let bytes=serde_json::to_vec(&header).unwrap();let size=(bytes.len()+8+3)&!3;
        let mut content=Vec::new();content.extend_from_slice(&4u32.to_le_bytes());content.extend_from_slice(&(size as u32).to_le_bytes());content.extend_from_slice(&((size-4) as u32).to_le_bytes());content.extend_from_slice(&(bytes.len() as u32).to_le_bytes());content.extend(bytes);content.resize(8+size,0);content.extend(data);fs::write(path,&content).unwrap();File::open(path).unwrap()
    }
    #[test] fn rejects_paths_ids_and_unsafe_index(){let path=root();for name in ["../sheet.webp","codex/../sheet.webp","C:/sheet.webp","codex\\sheet.webp","codex/sheet.webp/extra","cat/sheet.webp"]{assert!(safe_file(&path,name).is_err());}assert!(safe_file(&path,"codex/sheet.webp").is_ok());fs::write(path.join("index.json"),r#"{"schema":1,"source":"x","pets":[{"id":"codex","relative_path":"../secret","sha256":"x","bytes":1,"width":1536,"height":2288}]}"#).unwrap();assert!(read_index(&path).is_err());assert!(load_asset(&path,"../secret").is_err());fs::remove_file(path.join("index.json")).unwrap();fs::remove_dir(path).unwrap();}
    #[test] fn asar_rejects_links_unpacked_bounds_overflow_and_duplicate_atlases(){let dir=root();let path=dir.join("fixture.asar");for entry in [json!({"size":3,"offset":"0","link":"../../secret"}),json!({"size":3,"offset":"0","unpacked":true}),json!({"size":3,"offset":"18446744073709551615"}),json!({"size":MAX_ASSET+1,"offset":"0"}),json!({"size":3,"offset":"30"})] {let mut file=archive(&path,json!({"files":{"webview":{"files":{"assets":{"files":{"codex-spritesheet-v1.12345678.webp":entry}}}}}}),b"abc");let(h,b,l)=asar_header(&mut file).unwrap();assert!(asar_asset(&mut file,&h,b,l,"codex").is_err());}let mut file=archive(&path,json!({"files":{"webview":{"files":{"assets":{"files":{"codex-spritesheet-v1.12345678.webp":{"size":3,"offset":"0"},"codex-spritesheet-v2.12345678.webp":{"size":3,"offset":"0"}}}}}}}),b"abc");let(h,b,l)=asar_header(&mut file).unwrap();assert!(asar_asset(&mut file,&h,b,l,"codex").is_err());fs::remove_file(path).unwrap();fs::remove_dir(dir).unwrap();}
    #[test] fn asar_reads_exact_selected_ranges_and_rejects_header_limit(){let dir=root();let path=dir.join("fixture.asar");let mut file=archive(&path,json!({"files":{"webview":{"files":{"assets":{"files":{"codex-spritesheet-v1.12345678.webp":{"size":3,"offset":"2"}}}}}}}),b"xxabczz");let(h,b,l)=asar_header(&mut file).unwrap();assert_eq!(asar_asset(&mut file,&h,b,l,"codex").unwrap(),b"abc");drop(file);fs::write(&path,[4u32.to_le_bytes(),(MAX_HEADER as u32+1).to_le_bytes()].concat()).unwrap();assert!(asar_header(&mut File::open(&path).unwrap()).is_err());fs::remove_file(path).unwrap();fs::remove_dir(dir).unwrap();}
    #[test] fn validates_dimensions_alpha_and_required_frames(){let encode=|image:&image::RgbaImage|{let mut bytes=Vec::new();image::codecs::webp::WebPEncoder::new_lossless(&mut bytes).encode(image.as_raw(),image.width(),image.height(),image::ExtendedColorType::Rgba8).unwrap();bytes};assert!(validate_art(&encode(&image::RgbaImage::new(10,10))).is_err());let mut image=image::RgbaImage::new(1536,2288);assert!(validate_art(&encode(&image)).is_err());for(row,count)in[6,8,8,4,5,8,6,6,6,8,8].iter().enumerate(){for column in 0..*count{image.put_pixel(column*192+10,row as u32*208+10,image::Rgba([255,30,100,255]));}}assert!(validate_art(&encode(&image)).is_ok());assert!(validate_art(&encode(&image::RgbaImage::from_pixel(1536,2288,image::Rgba([1,2,3,255])))).is_err());}
    #[test] fn metadata_cannot_report_missing_files_as_available(){let path=root();let value=catalog(&path,"not_installed",None);assert_eq!(value["status"],"not_installed");assert_eq!(value["pets"].as_array().unwrap().len(),9);assert!(value["pets"].as_array().unwrap().iter().all(|pet|pet["available"]==false));fs::remove_dir(path).unwrap();}
}
