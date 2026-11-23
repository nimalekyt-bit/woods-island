use base64::Engine;
use std::io::Cursor;

pub(super) const MAX_ICON_BYTES: u64 = 1024 * 1024;
/// Normalize locally supplied Windows artwork to a small raster resource.
pub(super) fn image_url(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_ICON_BYTES { return None; }
    let mut reader=image::ImageReader::new(Cursor::new(bytes)).with_guessed_format().ok()?;
    let mut limits=image::Limits::default();
    limits.max_image_width=Some(2048);limits.max_image_height=Some(2048);limits.max_alloc=Some(16*1024*1024);
    reader.limits(limits);
    let image=reader.decode().ok()?.thumbnail(96,96);
    let mut png=Cursor::new(Vec::new());image.write_to(&mut png,image::ImageFormat::Png).ok()?;
    Some(format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(png.into_inner())))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn notification_artwork_is_bounded_and_decoded_before_it_reaches_the_webview() {
        assert!(image_url(b"<svg><script>alert(1)</script></svg>").is_none());
        assert!(image_url(&vec![0;MAX_ICON_BYTES as usize+1]).is_none());
        assert!(image_url(b"\x89PNG\r\n\x1a\ninvalid").is_none());
        let large=image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(480,240,image::Rgba([20,60,100,255])));
        let mut input=Cursor::new(Vec::new());large.write_to(&mut input,image::ImageFormat::Png).unwrap();
        let output=image_url(input.get_ref()).unwrap();
        let bytes=base64::engine::general_purpose::STANDARD.decode(output.strip_prefix("data:image/png;base64,").unwrap()).unwrap();
        let decoded=image::load_from_memory(&bytes).unwrap();assert_eq!((decoded.width(),decoded.height()),(96,48));
    }
}
