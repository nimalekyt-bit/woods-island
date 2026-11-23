// Native fake windows and a unique mapping; real AIMP/Winamp instances are never contacted.
#[path = "../../src-tauri/src/media/legacy.rs"] mod legacy;
use legacy::LegacyKind;
use std::{sync::{atomic::{AtomicBool, AtomicI32, AtomicU64, Ordering}, mpsc, Mutex}, time::{Duration, Instant}};
use windows::{core::{w, PCWSTR}, Win32::{
    Foundation::{CloseHandle, HWND, LPARAM, LRESULT, WPARAM, INVALID_HANDLE_VALUE},
    System::{LibraryLoader::GetModuleHandleW, Memory::{CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, FILE_MAP_WRITE, PAGE_READWRITE}, Threading::GetCurrentThreadId},
    UI::WindowsAndMessaging::*,
}};
static AIMP_STATE: AtomicI32 = AtomicI32::new(1);
static WINAMP_STATE: AtomicI32 = AtomicI32::new(1);
static POSITION: AtomicU64 = AtomicU64::new(45_000);
static HANG: AtomicBool = AtomicBool::new(false);
static COMMANDS: Mutex<Vec<(isize, usize)>> = Mutex::new(Vec::new());
unsafe extern "system" fn procedure(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    let kind = GetWindowLongPtrW(window, GWLP_USERDATA);
    if message == WM_USER || message == WM_USER + 0x77 || message == WM_USER + 0x75 || message == WM_COMMAND {
        if HANG.swap(false, Ordering::SeqCst) { std::thread::sleep(Duration::from_millis(1100)); }
        if message == WM_USER && lparam.0 == 106 { POSITION.store(wparam.0 as u64, Ordering::SeqCst); return LRESULT(0); }
        if kind == 1 {
            if message == WM_USER + 0x77 { return LRESULT(match wparam.0 {0x40=>AIMP_STATE.load(Ordering::SeqCst) as isize,0x20=>POSITION.load(Ordering::SeqCst) as isize,0x30=>180_000,_=>0}); }
            if message == WM_USER + 0x75 {
                COMMANDS.lock().unwrap().push((kind,wparam.0));
                match wparam.0 {13=>AIMP_STATE.store(1,Ordering::SeqCst),14|15=>AIMP_STATE.store(if AIMP_STATE.load(Ordering::SeqCst)==1{2}else{1},Ordering::SeqCst),_=>{}}
                return LRESULT(1);
            }
        } else if kind == 2 {
            if message == WM_USER { return LRESULT(match lparam.0 {104=>WINAMP_STATE.load(Ordering::SeqCst) as isize,105 if wparam.0==0=>POSITION.load(Ordering::SeqCst) as isize,105=>180,_=>0}); }
            if message == WM_COMMAND {
                COMMANDS.lock().unwrap().push((kind,wparam.0));
                match wparam.0 {40045=>WINAMP_STATE.store(1,Ordering::SeqCst),40046=>WINAMP_STATE.store(if WINAMP_STATE.load(Ordering::SeqCst)==1{3}else{1},Ordering::SeqCst),_=>{}}
                return LRESULT(1);
            }
        }
    }
    DefWindowProcW(window,message,wparam,lparam)
}

#[test]
fn real_native_legacy_protocols_are_bounded_and_keep_unicode() {
    let (sender, receiver) = mpsc::channel();
    let worker = std::thread::spawn(move || unsafe {
        let module = GetModuleHandleW(None).unwrap();
        let class = w!("WoodsLegacyNativeFixture");
        let definition = WNDCLASSW { lpfnWndProc:Some(procedure),hInstance:module.into(),lpszClassName:class,..Default::default() };
        assert_ne!(RegisterClassW(&definition),0);
        let aimp = CreateWindowExW(WINDOW_EX_STYLE::default(),class,w!("Woods AIMP fixture"),WINDOW_STYLE::default(),0,0,0,0,None,None,module,None).unwrap();
        let winamp = CreateWindowExW(WINDOW_EX_STYLE::default(),class,w!("12. Исполнитель - Ночь - Winamp [Paused]"),WINDOW_STYLE::default(),0,0,0,0,None,None,module,None).unwrap();
        SetWindowLongPtrW(aimp,GWLP_USERDATA,1);SetWindowLongPtrW(winamp,GWLP_USERDATA,2);
        sender.send((aimp.0 as isize,winamp.0 as isize,GetCurrentThreadId())).unwrap();
        let mut message=MSG::default();
        while GetMessageW(&mut message,None,0,0).as_bool(){let _=TranslateMessage(&message);DispatchMessageW(&message);}
        let _=DestroyWindow(aimp);let _=DestroyWindow(winamp);
    });
    let (aimp,winamp,thread)=receiver.recv_timeout(Duration::from_secs(3)).unwrap();
    let aimp=HWND(aimp as *mut _);let winamp=HWND(winamp as *mut _);
    let mapping_name=format!("Local\\WoodsAimpFixture-{}",std::process::id()).encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let mut bytes=[0u8;2048];bytes[4]=1;bytes[16..20].copy_from_slice(&180_000u32.to_le_bytes());
    let mut offset=88;
    for (index,string) in ["Альбом","Исполнитель","2026",r"E:\Music\ночь.mp3","Electronic","Ночь"].into_iter().enumerate(){
        let value=string.encode_utf16().collect::<Vec<_>>();bytes[40+index*4..44+index*4].copy_from_slice(&(value.len() as u32).to_le_bytes());
        for unit in value{bytes[offset..offset+2].copy_from_slice(&unit.to_le_bytes());offset+=2;}
    }
    unsafe {
        let mapping=CreateFileMappingW(INVALID_HANDLE_VALUE,None,PAGE_READWRITE,0,2048,PCWSTR(mapping_name.as_ptr())).unwrap();
        let view=MapViewOfFile(mapping,FILE_MAP_WRITE,0,0,2048);assert!(!view.Value.is_null());
        std::ptr::copy_nonoverlapping(bytes.as_ptr(),view.Value.cast::<u8>(),2048);
        let read=||legacy::read_aimp_mapping(PCWSTR(mapping_name.as_ptr()));
        for(kind,window)in[(LegacyKind::Aimp,aimp),(LegacyKind::Winamp,winamp)]{
            let value=legacy::snapshot_window(kind,window,std::process::id(),read).unwrap();
            assert_eq!(value["title"],"Ночь");assert_eq!(value["artist"],"Исполнитель");assert_eq!(value["positionMs"],45_000);assert_eq!(value["durationMs"],180_000);assert_eq!(value["playing"],true);assert_eq!(value["app"],kind.id());assert!(value["key"].as_str().unwrap().ends_with("|Ночь"));assert!(value["updatedAt"].as_u64().unwrap()>0);
            legacy::control_window(kind,window,"pause").unwrap();let count=COMMANDS.lock().unwrap().len();
            assert_eq!(legacy::snapshot_window(kind,window,0,read).unwrap()["playing"],false);
            legacy::control_window(kind,window,"pause").unwrap();assert_eq!(COMMANDS.lock().unwrap().len(),count);
            legacy::control_window(kind,window,"play").unwrap();assert_eq!(legacy::snapshot_window(kind,window,0,read).unwrap()["playing"],true);
            legacy::control_window(kind,window,"next").unwrap();legacy::control_window(kind,window,"prev").unwrap();
            assert!(legacy::control_window(kind,window,"invalid").is_err());
            legacy::seek_window(window,90_000).unwrap();assert_eq!(legacy::snapshot_window(kind,window,0,read).unwrap()["positionMs"],90_000);POSITION.store(45_000,Ordering::SeqCst);
        }
        assert_eq!(*COMMANDS.lock().unwrap(),vec![(1,15),(1,13),(1,17),(1,18),(2,40046),(2,40046),(2,40048),(2,40044)]);
        AIMP_STATE.store(0,Ordering::SeqCst);assert!(legacy::snapshot_window(LegacyKind::Aimp,aimp,0,read).is_err());
        WINAMP_STATE.store(0,Ordering::SeqCst);assert!(legacy::snapshot_window(LegacyKind::Winamp,winamp,0,read).is_err());
        HANG.store(true,Ordering::SeqCst);let began=Instant::now();assert!(legacy::control_window(LegacyKind::Winamp,winamp,"play").is_err());assert!(began.elapsed()<Duration::from_millis(850));
        std::thread::sleep(Duration::from_millis(800));
        let _=UnmapViewOfFile(view);let _=CloseHandle(mapping);
        PostThreadMessageW(thread,WM_QUIT,WPARAM(0),LPARAM(0)).unwrap();
    }
    worker.join().unwrap();
}
