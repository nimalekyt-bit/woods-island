//! Canonical shelf metadata, without changing launcher item names.
use image::{ImageDecoder, ImageReader, Limits};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Instant, SystemTime},
};
const MAX_PREVIEW_FILE: u64 = 32 * 1024 * 1024;
const MAX_PREVIEW_PIXELS: u64 = 16 * 1024 * 1024;
const MAX_PREVIEW_ALLOC: u64 = 64 * 1024 * 1024;
const PREVIEW_EDGE: u32 = 192;
struct Cached {
    size: u64,
    modified: Option<SystemTime>,
    directory: bool,
    icon: Option<String>,
    preview: bool,
    used: Instant,
}
static CACHE: OnceLock<Mutex<HashMap<PathBuf, Cached>>> = OnceLock::new();
fn preview(path: &Path, size: u64) -> Option<String> {
    if size > MAX_PREVIEW_FILE {
        return None;
    }
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "jfif" | "webp") {
        return None;
    }
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(MAX_PREVIEW_ALLOC);
    let reader = || -> Option<ImageReader<BufReader<File>>> {
        let file = File::open(path).ok()?;
        if !file.metadata().ok()?.is_file() || file.metadata().ok()?.len() > MAX_PREVIEW_FILE {
            return None;
        }
        let mut reader = ImageReader::new(BufReader::new(file))
            .with_guessed_format()
            .ok()?;
        reader.limits(limits.clone());
        Some(reader)
    };
    let (width, height) = reader()?.into_dimensions().ok()?;
    if width == 0 || height == 0 || width as u64 * height as u64 > MAX_PREVIEW_PIXELS {
        return None;
    }
    let mut decoder = reader()?.into_decoder().ok()?;
    let orientation = decoder
        .orientation()
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut decoded = image::DynamicImage::from_decoder(decoder).ok()?;
    decoded.apply_orientation(orientation);
    if decoded.width() as u64 * decoded.height() as u64 > MAX_PREVIEW_PIXELS {
        return None;
    }
    let thumbnail = decoded.thumbnail(PREVIEW_EDGE, PREVIEW_EDGE).to_rgba8();
    crate::capture::data_url(&thumbnail).ok()
}
pub fn shelf_item(path: &Path) -> Value {
    let metadata = std::fs::metadata(path).ok();
    let exists = metadata.is_some();
    let directory = metadata.as_ref().is_some_and(|meta| meta.is_dir());
    let size = metadata.as_ref().map_or(0, |meta| meta.len());
    let modified = metadata.as_ref().and_then(|meta| meta.modified().ok());
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let cached = cache
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get_mut(path)
        .filter(|entry| {
            entry.size == size
                && entry.modified == modified
                && entry.directory == directory
                && exists
        })
        .map(|entry| {
            entry.used = Instant::now();
            (entry.icon.clone(), entry.preview)
        });
    let (icon, is_preview) = if !exists {
        (None, false)
    } else if let Some(cached) = cached {
        cached
    } else {
        let image = if directory { None } else { preview(path, size) };
        let is_preview = image.is_some();
        let icon = image.or_else(|| crate::system::icon(&path.to_string_lossy()));
        let mut entries = cache.lock().unwrap_or_else(|e| e.into_inner());
        if entries.len() >= 64 {
            if let Some(oldest) = entries
                .iter()
                .min_by_key(|(_, entry)| entry.used)
                .map(|(path, _)| path.clone())
            {
                entries.remove(&oldest);
            }
        }
        entries.insert(
            path.to_path_buf(),
            Cached {
                size,
                modified,
                directory,
                icon: icon.clone(),
                preview: is_preview,
                used: Instant::now(),
            },
        );
        (icon, is_preview)
    };
    json!({"path":path.to_string_lossy(),"name":path.file_name().unwrap_or_default().to_string_lossy(),"isDir":directory,"kind":if directory{"folder"}else{"file"},"icon":icon,"preview":is_preview,"exists":exists,"size":size})
}

#[cfg(test)]
mod tests {
    use super::*;
    fn folder() -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "woods-shelf-preview-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&path).unwrap();
        path
    }
    #[test]
    fn unicode_name_and_real_preview_are_retained() {
        let root = folder();
        let path = root.join("Лес 你好.png");
        image::RgbaImage::from_pixel(640, 320, image::Rgba([93, 143, 110, 255]))
            .save(&path)
            .unwrap();
        let item = shelf_item(&path);
        assert_eq!(item["name"], "Лес 你好.png");
        assert_eq!(item["preview"], true);
        assert!(item["icon"]
            .as_str()
            .unwrap()
            .starts_with("data:image/png;base64,"));
        use base64::Engine;
        let encoded = item["icon"].as_str().unwrap().split_once(',').unwrap().1;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        let thumbnail = image::load_from_memory(&bytes).unwrap();
        assert_eq!((thumbnail.width(), thumbnail.height()), (192, 96));
        assert_eq!(item, shelf_item(&path));
        assert_eq!(preview(&path, MAX_PREVIEW_FILE + 1), None);
        std::fs::remove_file(&path).unwrap();
        let missing = shelf_item(&path);
        assert_eq!(missing["exists"], false);
        assert_eq!(missing["icon"], Value::Null);
        std::fs::remove_dir(&root).unwrap();
    }
    #[test]
    fn corrupt_and_excessive_image_headers_do_not_decode() {
        let root = folder();
        let path = root.join("broken.png");
        std::fs::write(&path, b"not a photo").unwrap();
        assert_eq!(preview(&path, 11), None);
        // Preserve a valid IHDR CRC so this proves the dimension limit, rather
        // than merely rejecting another malformed PNG.
        image::RgbaImage::from_pixel(1, 1, image::Rgba([1, 2, 3, 255]))
            .save(&path)
            .unwrap();
        let mut bytes = std::fs::read(&path).unwrap();
        bytes[16..20].copy_from_slice(&100000u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&100000u32.to_be_bytes());
        let mut crc = u32::MAX;
        for byte in &bytes[12..29] {
            crc ^= *byte as u32;
            for _ in 0..8 {
                crc = (crc >> 1) ^ (0xedb88320 & (0u32.wrapping_sub(crc & 1)));
            }
        }
        bytes[29..33].copy_from_slice(&(!crc).to_be_bytes());
        std::fs::write(&path, &bytes).unwrap();
        assert_eq!(
            ImageReader::open(&path).unwrap().into_dimensions().unwrap(),
            (100000, 100000)
        );
        assert_eq!(preview(&path, bytes.len() as u64), None);
        std::fs::remove_file(path).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
    #[test]
    fn phone_camera_orientation_is_applied_before_preview() {
        use base64::Engine;
        let root = folder();
        let path = root.join("camera.jpg");
        image::RgbImage::from_pixel(32, 16, image::Rgb([70, 110, 90]))
            .save(&path)
            .unwrap();
        let jpeg = std::fs::read(&path).unwrap();
        // EXIF little-endian TIFF with orientation=6 (90 degrees clockwise).
        let exif = [
            b'E', b'x', b'i', b'f', 0, 0, b'I', b'I', 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0,
            0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
        ];
        let mut oriented = vec![255, 216, 255, 225, 0, 34];
        oriented.extend_from_slice(&exif);
        oriented.extend_from_slice(&jpeg[2..]);
        std::fs::write(&path, &oriented).unwrap();
        let preview = preview(&path, oriented.len() as u64).unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(preview.split_once(',').unwrap().1)
            .unwrap();
        let image = image::load_from_memory(&bytes).unwrap();
        assert_eq!((image.width(), image.height()), (96, 192));
        std::fs::remove_file(path).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
