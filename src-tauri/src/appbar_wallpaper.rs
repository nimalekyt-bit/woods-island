//! Read the selected monitor's desktop image; keep only the small strip in RAM.
//! No wallpaper/settings mutation, files, screenshots or private paths are logged.
use image::RgbaImage;
use std::path::PathBuf;
use windows::{
    core::{PCWSTR, PWSTR},
    Win32::{
        Foundation::RECT,
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED,
        },
        UI::Shell::{DesktopWallpaper, IDesktopWallpaper},
    },
};
pub struct Bitmap {
    pub width: i32,
    pub height: i32,
    pub bgra: Vec<u8>,
}
struct Apartment;
impl Apartment {
    fn new() -> Result<Self, String> {
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }
            .ok()
            .map_err(|_| "Wallpaper service unavailable")?;
        Ok(Self)
    }
}
impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() }
    }
}
struct Wide(PWSTR);
impl Drop for Wide {
    fn drop(&mut self) {
        unsafe { CoTaskMemFree(Some(self.0 .0.cast())) }
    }
}
fn bounds(rect: RECT) -> (i32, i32, i32, i32) {
    (rect.left, rect.top, rect.right, rect.bottom)
}
fn sample(
    image: &RgbaImage,
    screen: (f64, f64),
    container: (i32, i32, i32, i32),
    position: i32,
    background: [u8; 3],
) -> [u8; 4] {
    let (iw, ih) = (image.width() as f64, image.height() as f64);
    let (width, height) = (
        (container.2 - container.0) as f64,
        (container.3 - container.1) as f64,
    );
    let (mut x, mut y) = (screen.0 - container.0 as f64, screen.1 - container.1 as f64);
    let (sx, sy) = match position {
        2 => (width / iw, height / ih),
        3 => {
            let scale = (width / iw).min(height / ih);
            (scale, scale)
        }
        4 | 5 => {
            let scale = (width / iw).max(height / ih);
            (scale, scale)
        }
        _ => (1., 1.),
    };
    if position == 1 {
        x = x.rem_euclid(iw);
        y = y.rem_euclid(ih);
    } else {
        x = (x - (width - iw * sx) / 2.) / sx;
        y = (y - (height - ih * sy) / 2.) / sy;
    }
    let color = if x < 0. || y < 0. || x >= iw || y >= ih {
        [background[0], background[1], background[2], 255]
    } else {
        let pixel = image.get_pixel(x.floor() as u32, y.floor() as u32).0;
        let alpha = pixel[3] as u16;
        [
            ((pixel[0] as u16 * alpha + background[0] as u16 * (255 - alpha)) / 255) as u8,
            ((pixel[1] as u16 * alpha + background[1] as u16 * (255 - alpha)) / 255) as u8,
            ((pixel[2] as u16 * alpha + background[2] as u16 * (255 - alpha)) / 255) as u8,
            255,
        ]
    };
    [color[2], color[1], color[0], 255]
}
pub fn load(monitor: (i32, i32, i32, i32), strip: (i32, i32, i32, i32)) -> Result<Bitmap, String> {
    let width = strip.2 - strip.0;
    let height = strip.3 - strip.1;
    let bytes = i64::from(width)
        .checked_mul(i64::from(height))
        .and_then(|value| value.checked_mul(4))
        .filter(|value| *value > 0 && *value <= 32 * 1024 * 1024)
        .ok_or("Wallpaper strip out of range")?;
    let _apartment = Apartment::new()?;
    let desktop: IDesktopWallpaper =
        unsafe { CoCreateInstance(&DesktopWallpaper, None, CLSCTX_INPROC_SERVER) }
            .map_err(|_| "Wallpaper service unavailable")?;
    let count = unsafe { desktop.GetMonitorDevicePathCount() }
        .map_err(|_| "Wallpaper monitors unavailable")?
        .min(64);
    let mut selected = None;
    let mut virtual_bounds = None::<(i32, i32, i32, i32)>;
    for index in 0..count {
        let path = Wide(
            unsafe { desktop.GetMonitorDevicePathAt(index) }
                .map_err(|_| "Wallpaper monitor unavailable")?,
        );
        let rect = unsafe { desktop.GetMonitorRECT(PCWSTR(path.0 .0)) }
            .map_err(|_| "Wallpaper bounds unavailable")?;
        let rect = bounds(rect);
        virtual_bounds = Some(virtual_bounds.map_or(rect, |old| {
            (
                old.0.min(rect.0),
                old.1.min(rect.1),
                old.2.max(rect.2),
                old.3.max(rect.3),
            )
        }));
        if rect == monitor {
            selected = Some(path);
        }
    }
    let path = selected.ok_or("Selected wallpaper monitor unavailable")?;
    let wallpaper = Wide(
        unsafe { desktop.GetWallpaper(PCWSTR(path.0 .0)) }
            .map_err(|_| "Wallpaper image unavailable")?,
    );
    let file = unsafe { wallpaper.0.to_string() }.map_err(|_| "Wallpaper path unavailable")?;
    let background = unsafe { desktop.GetBackgroundColor() }
        .map_err(|_| "Wallpaper color unavailable")?
        .0;
    let color = [
        background as u8,
        (background >> 8) as u8,
        (background >> 16) as u8,
    ];
    let position = unsafe { desktop.GetPosition() }
        .map_err(|_| "Wallpaper layout unavailable")?
        .0;
    let image = if file.is_empty() {
        None
    } else {
        let file = PathBuf::from(file);
        if std::fs::metadata(&file)
            .map_err(|_| "Wallpaper image unavailable")?
            .len()
            > 64 * 1024 * 1024
        {
            return Err("Wallpaper image exceeds the limit".into());
        }
        let mut reader = image::ImageReader::open(file)
            .map_err(|_| "Wallpaper image unavailable")?
            .with_guessed_format()
            .map_err(|_| "Wallpaper format unavailable")?;
        let mut limits = image::Limits::default();
        limits.max_image_width = Some(16000);
        limits.max_image_height = Some(16000);
        limits.max_alloc = Some(192 * 1024 * 1024);
        reader.limits(limits);
        Some(
            reader
                .decode()
                .map_err(|_| "Wallpaper image could not be decoded")?
                .to_rgba8(),
        )
    };
    let container = if position == 5 {
        virtual_bounds.unwrap_or(monitor)
    } else {
        monitor
    };
    let mut bgra = vec![0; bytes as usize];
    for y in 0..height {
        for x in 0..width {
            let value = image
                .as_ref()
                .map(|image| {
                    sample(
                        image,
                        (
                            strip.0 as f64 + x as f64 + 0.5,
                            strip.1 as f64 + y as f64 + 0.5,
                        ),
                        container,
                        position,
                        color,
                    )
                })
                .unwrap_or([color[2], color[1], color[0], 255]);
            let at = ((y as usize * width as usize) + x as usize) * 4;
            bgra[at..at + 4].copy_from_slice(&value);
        }
    }
    Ok(Bitmap {
        width,
        height,
        bgra,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    fn image() -> RgbaImage {
        RgbaImage::from_raw(2, 1, vec![255, 0, 0, 255, 0, 0, 255, 255]).unwrap()
    }
    #[test]
    fn wallpaper_mapping_matches_stretch_fit_center_and_negative_monitor_origin() {
        let image = image();
        let monitor = (-1920, 0, 0, 1080);
        assert_eq!(
            sample(&image, (-1919.5, 0.5), monitor, 2, [0, 0, 0]),
            [0, 0, 255, 255]
        );
        assert_eq!(
            sample(&image, (-0.5, 0.5), monitor, 2, [0, 0, 0]),
            [255, 0, 0, 255]
        );
        assert_eq!(
            sample(&image, (-1919.5, 0.5), monitor, 3, [10, 20, 30]),
            [30, 20, 10, 255]
        );
        assert_eq!(
            sample(&image, (-1919.5, 0.5), monitor, 0, [10, 20, 30]),
            [30, 20, 10, 255]
        );
    }
    #[test]
    fn wallpaper_tiles_repeat_without_out_of_range_reads() {
        let image = image();
        assert_eq!(
            sample(&image, (2.5, 0.5), (0, 0, 8, 8), 1, [0, 0, 0]),
            [0, 0, 255, 255]
        );
        assert_eq!(
            sample(&image, (-0.5, 0.5), (0, 0, 8, 8), 1, [0, 0, 0]),
            [255, 0, 0, 255]
        );
    }
}
