// Separate synthetic render processes. Only their own session volumes are reduced; user audio is untouched.
#[path = "../../src-tauri/src/audio/process_loopback.rs"] mod process_loopback;
use std::{io::{BufRead, Write}, process::{Command, Stdio}, time::{Duration, Instant}};
use windows::Win32::{Foundation::CloseHandle, Media::Audio::*, System::{Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED}, Threading::CreateEventW}};
struct Com;
impl Com { fn new() -> Self { unsafe {CoInitializeEx(None,COINIT_MULTITHREADED)}.ok().unwrap();Self } }
impl Drop for Com {fn drop(&mut self){unsafe{CoUninitialize()};}}
fn format() -> WAVEFORMATEX { WAVEFORMATEX {wFormatTag:3,nChannels:2,nSamplesPerSec:48000,nAvgBytesPerSec:384000,nBlockAlign:8,wBitsPerSample:32,cbSize:0} }

fn render(frequency:f32) {
    let _com=Com::new();
    unsafe {
        let enumerator:IMMDeviceEnumerator=CoCreateInstance(&MMDeviceEnumerator,None,CLSCTX_ALL).unwrap();
        let device=enumerator.GetDefaultAudioEndpoint(eRender,eConsole).unwrap();
        let client:IAudioClient=device.Activate(CLSCTX_ALL,None).unwrap();
        client.Initialize(AUDCLNT_SHAREMODE_SHARED,AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM|AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY,1_000_000,0,&format(),None).unwrap();
        let volume:ISimpleAudioVolume=client.GetService().unwrap();
        volume.SetMasterVolume(0.0001,std::ptr::null()).unwrap(); // -80 dB for this fixture only.
        let output:IAudioRenderClient=client.GetService().unwrap();
        let capacity=client.GetBufferSize().unwrap();
        println!("ready");std::io::stdout().flush().unwrap();
        let mut input=String::new();std::io::stdin().read_line(&mut input).unwrap();assert_eq!(input.trim(),"go");
        client.Start().unwrap();let mut frame=0u64;let began=Instant::now();
        while began.elapsed()<Duration::from_secs(5) {
            let available=capacity-client.GetCurrentPadding().unwrap();
            if available>0 {
                let data=output.GetBuffer(available).unwrap().cast::<f32>();
                for index in 0..available as usize{let sample=0.25*(2.*std::f32::consts::PI*frequency*(frame+index as u64) as f32/48000.).sin();std::ptr::write(data.add(index*2),sample);std::ptr::write(data.add(index*2+1),sample);}
                output.ReleaseBuffer(available,0).unwrap();frame+=available as u64;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        client.Stop().unwrap();
    }
}

fn child(frequency:u32)->std::process::Child {
    let mut child=Command::new(std::env::current_exe().unwrap()).arg("render").arg(frequency.to_string()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit()).spawn().unwrap();
    let mut reader=std::io::BufReader::new(child.stdout.take().unwrap());let mut line=String::new();reader.read_line(&mut line).unwrap();assert_eq!(line.trim(),"ready");child
}
fn go(child:&mut std::process::Child){writeln!(child.stdin.as_mut().unwrap(),"go").unwrap();}
fn power(samples:&[f32],frequency:f64)->f64 {
    let (mut real,mut imag)=(0.,0.);
    for(index,sample)in samples.iter().enumerate(){let angle=2.*std::f64::consts::PI*frequency*index as f64/48000.;real+=f64::from(*sample)*angle.cos();imag+=f64::from(*sample)*angle.sin();}
    (real*real+imag*imag)/(samples.len() as f64).powi(2)
}
fn main() {
    let args=std::env::args().collect::<Vec<_>>();if args.get(1).is_some_and(|s|s=="render"){render(args[2].parse().unwrap());return;}
    let _com=Com::new();assert!(process_loopback::activate(0).is_err());
    let mut target=child(700);let mut other=child(1700);
    let client=process_loopback::activate(target.id()).unwrap();
    let samples=unsafe {
        // Process loopback has no endpoint mix format. Windows accepts this documented shared PCM format.
        client.Initialize(AUDCLNT_SHAREMODE_SHARED,AUDCLNT_STREAMFLAGS_LOOPBACK|AUDCLNT_STREAMFLAGS_EVENTCALLBACK,0,0,&format(),None).unwrap();
        let event=CreateEventW(None,false,false,None).unwrap();client.SetEventHandle(event).unwrap();
        let capture:IAudioCaptureClient=client.GetService().unwrap();client.Start().unwrap();go(&mut target);go(&mut other);
        let began=Instant::now();let mut samples=Vec::new();
        while began.elapsed()<Duration::from_millis(1800){
            while capture.GetNextPacketSize().unwrap()>0 {
                let mut data=std::ptr::null_mut();let mut frames=0;let mut flags=0;
                capture.GetBuffer(&mut data,&mut frames,&mut flags,None,None).unwrap();
                if flags&AUDCLNT_BUFFERFLAGS_SILENT.0 as u32==0&&!data.is_null(){let data=std::slice::from_raw_parts(data.cast::<f32>(),frames as usize*2);samples.extend(data.chunks_exact(2).map(|pair|(pair[0]+pair[1])*0.5));}else{samples.extend(std::iter::repeat_n(0.,frames as usize));}
                capture.ReleaseBuffer(frames).unwrap();
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        client.Stop().unwrap();let _=CloseHandle(event);samples
    };
    let _=target.kill();let _=target.wait();let _=other.kill();let _=other.wait();
    assert!(samples.len()>48_000,"No process-loopback packets");
    let target_power=power(&samples,700.);let competing_power=power(&samples,1700.);
    assert!(target_power>1e-14,"Target rendered silence: {target_power}");
    assert!(competing_power<target_power*0.01,"Competing process leaked: {target_power}/{competing_power}");
    println!("{}",serde_json::json!({"status":"PASS","samples":samples.len(),"targetPower":target_power,"competingPower":competing_power,"isolationDb":10.*(target_power/competing_power.max(1e-30)).log10(),"onlyFixtureSessionVolumeChanged":true}));
}
