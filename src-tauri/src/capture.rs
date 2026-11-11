use base64::Engine;
use serde_json::{json, Value};
use std::{path::{Path, PathBuf}, sync::Mutex, };
use windows::Win32::{Foundation::{HWND, RECT}, Graphics::Gdi::*};

static EDITOR_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static FRAME: Mutex<Option<image::RgbaImage>> = Mutex::new(None);

pub struct MainHidden { window:Option<tauri::WebviewWindow>, restore:bool }
impl MainHidden { pub fn keep_hidden(&mut self){self.restore=false;} }
impl Drop for MainHidden {fn drop(&mut self){if self.restore{if let Some(window)=&self.window{let _=window.show();}}}}
pub fn hide_main(app:&tauri::AppHandle)->MainHidden{
    use tauri::Manager;
    let window=app.get_webview_window("main");if let Some(window)=&window{let _=window.hide();}
    MainHidden{window,restore:true}
}
pub fn set_frame(image:&image::RgbaImage){*FRAME.lock().unwrap()=Some(image.clone());}
pub fn clear_frame(){*FRAME.lock().unwrap()=None;}
pub fn selected_image(rect:RECT)->Result<image::RgbaImage,String>{
    if let Some(frame)=FRAME.lock().unwrap().as_ref(){
        let screen=screen_rect();let x=(rect.left-screen.left).max(0) as u32;let y=(rect.top-screen.top).max(0) as u32;
        let w=(rect.right-rect.left).max(1) as u32;let h=(rect.bottom-rect.top).max(1) as u32;
        if x+w<=frame.width()&&y+h<=frame.height(){return Ok(image::imageops::crop_imm(frame,x,y,w,h).to_image());}
    }
    screenshot(rect)
}

pub fn screen_rect() -> RECT {
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN};
    unsafe {
        let x=GetSystemMetrics(SM_XVIRTUALSCREEN); let y=GetSystemMetrics(SM_YVIRTUALSCREEN);
        RECT{left:x,top:y,right:x+GetSystemMetrics(SM_CXVIRTUALSCREEN),bottom:y+GetSystemMetrics(SM_CYVIRTUALSCREEN)}
    }
}

pub fn region(x: f64, y: f64, w: f64, h: f64) -> Result<RECT, String> {
    if ![x,y,w,h].iter().all(|v| v.is_finite()) { return Err("Invalid capture coordinates".into()); }
    let screen=screen_rect(); let sw=screen.right-screen.left; let sh=screen.bottom-screen.top;
    let (x,y,w,h) = if w <= 0.0 || h <= 0.0 { (0.0,0.0,1.0,1.0) } else { (x.clamp(0.0,1.0), y.clamp(0.0,1.0), w.clamp(0.0,(1.0-x).max(0.0)), h.clamp(0.0,(1.0-y).max(0.0))) };
    let left=screen.left+(x*sw as f64).round() as i32; let top=screen.top+(y*sh as f64).round() as i32;
    let width=(w*sw as f64).round().max(1.0) as i32; let height=(h*sh as f64).round().max(1.0) as i32;
    Ok(RECT {left,top,right:left+width,bottom:top+height})
}

pub fn screenshot(rect: RECT) -> Result<image::RgbaImage,String> {
    let width=rect.right-rect.left; let height=rect.bottom-rect.top;
    if width<=0 || height<=0 || (width as i64)*(height as i64)>100_000_000 { return Err("Invalid screenshot dimensions".into()); }
    unsafe {
        let screen=GetDC(HWND::default());
        if screen.is_invalid(){return Err("Cannot access screen DC".into());}
        let dc=CreateCompatibleDC(screen); let bitmap=CreateCompatibleBitmap(screen,width,height);
        if dc.is_invalid() || bitmap.is_invalid() { ReleaseDC(HWND::default(),screen); return Err("Cannot allocate capture bitmap".into()); }
        let old=SelectObject(dc,bitmap);
        let result=(||{
            BitBlt(dc,0,0,width,height,screen,rect.left,rect.top,SRCCOPY|CAPTUREBLT).map_err(|e|e.to_string())?;
            // GetDIBits requires the bitmap to be deselected from the DC.
            SelectObject(dc,old);
            let mut info=BITMAPINFO::default();
            info.bmiHeader=BITMAPINFOHEADER{biSize:std::mem::size_of::<BITMAPINFOHEADER>() as u32,biWidth:width,biHeight:-height,biPlanes:1,biBitCount:32,biCompression:BI_RGB.0,..Default::default()};
            let mut pixels=vec![0u8;(width*height*4) as usize];
            if GetDIBits(dc,bitmap,0,height as u32,Some(pixels.as_mut_ptr() as _),&mut info,DIB_RGB_COLORS)==0 {return Err("Cannot read captured pixels".into());}
            for p in pixels.chunks_exact_mut(4){p.swap(0,2);p[3]=255;}
            image::RgbaImage::from_raw(width as u32,height as u32,pixels).ok_or("Invalid capture buffer".into())
        })();
        SelectObject(dc,old); let _=DeleteObject(bitmap); let _=DeleteDC(dc); ReleaseDC(HWND::default(),screen);
        result
    }
}

pub fn data_url(image: &image::RgbaImage) -> Result<String,String> {
    let mut out=std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(image.clone()).write_to(&mut out,image::ImageFormat::Png).map_err(|e|e.to_string())?;
    Ok(format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(out.into_inner())))
}

pub fn output_dir(settings: &Value, kind: &str) -> Result<PathBuf,String> {
    let key=if kind=="recording"{"recordingDir"}else{"screenshotDir"};
    let path=settings[key].as_str().filter(|s|!s.trim().is_empty()).map(PathBuf::from).unwrap_or_else(||crate::storage::get_storage_dir().join(if kind=="recording"{"Recordings"}else{"Screenshots"}));
    std::fs::create_dir_all(&path).map_err(|e|e.to_string())?; Ok(path)
}

pub fn save(image: &image::RgbaImage, settings: &Value) -> Result<Value,String> {
    let path=output_dir(settings,"screenshot")?.join(format!("woods-{}.png",crate::media::now_ms()));
    image.save(&path).map_err(|e|e.to_string())?;
    let thumb=image::imageops::thumbnail(image,480,270);
    Ok(json!({"kind":"screenshot","path":path.to_string_lossy(),"thumb":data_url(&thumb)?,"width":image.width(),"height":image.height()}))
}

pub fn ocr(path: &Path) -> Result<String,String> {
    use windows::{Storage::StorageFile, Graphics::Imaging::BitmapDecoder, Media::Ocr::OcrEngine, core::HSTRING};
    let _apartment = crate::audio::WinRtApartment::new()?;
    let absolute=path.canonicalize().map_err(|e|e.to_string())?;
    let file=StorageFile::GetFileFromPathAsync(&HSTRING::from(absolute.to_string_lossy().trim_start_matches("\\\\?\\"))).map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?;
    let stream=file.OpenReadAsync().map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?;
    let decoder=BitmapDecoder::CreateAsync(&stream).map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?;
    let bitmap=decoder.GetSoftwareBitmapAsync().map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?;
    let engine=OcrEngine::TryCreateFromUserProfileLanguages().map_err(|_|"Windows OCR language packs are not installed")?;
    engine.RecognizeAsync(&bitmap).map_err(|e|e.to_string())?.get().map_err(|e|e.to_string())?.Text().map(|s|s.to_string()).map_err(|e|e.to_string())
}

pub fn qr(image: &image::RgbaImage) -> Result<String,String> {
    let gray=image::DynamicImage::ImageRgba8(image.clone()).into_luma8();
    let mut prepared=rqrr::PreparedImage::prepare(gray);
    for grid in prepared.detect_grids(){if let Ok((_,text))=grid.decode(){return Ok(text);}}
    Err("No QR code found in the selected region".into())
}

pub fn editor_open(path: &Path) -> Result<(),String>{
    image::open(path).map_err(|e|e.to_string())?;
    *EDITOR_PATH.lock().unwrap()=Some(path.to_owned()); Ok(())
}
pub fn editor_image() -> Result<String,String>{
    let path=EDITOR_PATH.lock().unwrap().clone().ok_or("No image selected")?;
    let image=image::open(path).map_err(|e|e.to_string())?.into_rgba8(); data_url(&image)
}
pub fn editor_save(url:&str,copy:bool) -> Result<(),String>{
    let (_,encoded)=url.split_once(',').ok_or("Invalid image data URL")?;
    let data=base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e|e.to_string())?;
    image::load_from_memory(&data).map_err(|e|e.to_string())?;
    if copy { return crate::clipboard::set_png(url); }
    let path=EDITOR_PATH.lock().unwrap().clone().ok_or("No image selected")?;
    crate::storage::atomic_write(&path,&data)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn region_rejects_nonfinite_and_clamps(){assert!(region(f64::NAN,0.,1.,1.).is_err());let r=region(0.,0.,1.,1.).unwrap();assert!(r.right>r.left && r.bottom>r.top);}
    #[test] fn png_data_url_roundtrip(){let image=image::RgbaImage::from_pixel(2,3,image::Rgba([200,10,30,255]));let url=data_url(&image).unwrap();let bytes=base64::engine::general_purpose::STANDARD.decode(url.split_once(',').unwrap().1).unwrap();let decoded=image::load_from_memory(&bytes).unwrap().into_rgba8();assert_eq!(decoded,image);}
}
