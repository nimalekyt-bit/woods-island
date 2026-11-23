//! Bounded local QR decoding for ordinary, inverted and decorative screenshots.
//! Every attempt uses the same installed rqrr engine; no service or new runtime.
use image::{GrayImage, Luma, RgbaImage};

const MAX_SIDE: u32 = 2048;
const MAX_INPUT_PIXELS: u64 = 100_000_000;

fn grayscale(source: &RgbaImage) -> Result<GrayImage, String> {
    let (width, height) = source.dimensions();
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_INPUT_PIXELS {
        return Err("Invalid QR image dimensions".into());
    }
    let scale = f64::from(MAX_SIDE) / f64::from(width.max(height));
    let smaller = (scale < 1.0).then(|| image::imageops::resize(source,
        (f64::from(width) * scale).round().max(1.0) as u32,
        (f64::from(height) * scale).round().max(1.0) as u32,
        image::imageops::FilterType::Triangle));
    let source = smaller.as_ref().unwrap_or(source);
    Ok(GrayImage::from_fn(source.width(), source.height(), |x, y| {
        let p = source.get_pixel(x, y).0;
        let light = (299 * u32::from(p[0]) + 587 * u32::from(p[1]) + 114 * u32::from(p[2])) / 1000;
        Luma([((light * u32::from(p[3]) + 255 * (255 - u32::from(p[3]))) / 255) as u8])
    }))
}

fn padded(source: &GrayImage, invert: bool) -> GrayImage {
    // A selected region can touch the outer modules: provide a real quiet zone.
    let margin = (source.width().min(source.height()) / 32).clamp(8, 48);
    let mut image = GrayImage::from_pixel(source.width() + margin * 2, source.height() + margin * 2, Luma([255]));
    for (x, y, pixel) in source.enumerate_pixels() {
        image.put_pixel(x + margin, y + margin, Luma([if invert { 255 - pixel[0] } else { pixel[0] }]));
    }
    image
}

fn attempt(source: &GrayImage, invert: bool) -> Option<String> {
    let mut prepared = rqrr::PreparedImage::prepare(padded(source, invert));
    prepared.detect_grids().into_iter().find_map(|grid| grid.decode().ok().map(|(_, text)| text))
}

fn otsu(source: &GrayImage) -> u8 {
    let mut histogram = [0u64; 256];
    for pixel in source.pixels() { histogram[pixel[0] as usize] += 1; }
    let total = u64::from(source.width()) * u64::from(source.height());
    let sum: u64 = histogram.iter().enumerate().map(|(value, count)| value as u64 * count).sum();
    let mut left = 0u64; let mut left_sum = 0u64; let mut best = -1.0; let mut threshold = 127u8;
    for (value, count) in histogram.iter().enumerate() {
        left += count; left_sum += value as u64 * count;
        if left == 0 || left == total { continue; }
        let difference = left_sum as f64 / left as f64 - (sum - left_sum) as f64 / (total - left) as f64;
        let variance = left as f64 * (total - left) as f64 * difference * difference;
        if variance > best { best = variance; threshold = value as u8; }
    }
    threshold
}

fn thresholded(source: &GrayImage, threshold: u8) -> GrayImage {
    GrayImage::from_fn(source.width(), source.height(), |x,y| Luma([if source.get_pixel(x,y)[0] <= threshold {0} else {255}]))
}

fn close_dark(source: &GrayImage) -> GrayImage {
    let (width, height) = source.dimensions();
    // Close single-pixel gaps between rounded modules, preserving their centres.
    let dilated = GrayImage::from_fn(width,height,|x,y| {
        let mut value = 255;
        for yy in y.saturating_sub(1)..=(y+1).min(height-1) { for xx in x.saturating_sub(1)..=(x+1).min(width-1) { value=value.min(source.get_pixel(xx,yy)[0]); } }
        Luma([value])
    });
    GrayImage::from_fn(width,height,|x,y| {
        let mut value = 0;
        for yy in y.saturating_sub(1)..=(y+1).min(height-1) { for xx in x.saturating_sub(1)..=(x+1).min(width-1) { value=value.max(dilated.get_pixel(xx,yy)[0]); } }
        Luma([value])
    })
}

pub fn decode(source: &RgbaImage) -> Result<String, String> {
    let gray = grayscale(source)?;
    if let Some(text)=attempt(&gray,false).or_else(||attempt(&gray,true)) { return Ok(text); }
    let threshold=otsu(&gray);
    let binary=thresholded(&gray,threshold);
    if let Some(text)=attempt(&binary,false).or_else(||attempt(&binary,true)) { return Ok(text); }
    let closed=close_dark(&binary);
    if let Some(text)=attempt(&closed,false).or_else(||attempt(&closed,true)) { return Ok(text); }
    // Fixed thresholds cover strongly coloured finder rings and pale gradients.
    for threshold in [96u8,160,208] {
        let binary=thresholded(&gray,threshold);
        if let Some(text)=attempt(&binary,false).or_else(||attempt(&binary,true)) { return Ok(text); }
    }
    Err("No QR code found in the selected region".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(style: &str, margin: u32) -> (RgbaImage,String) {
        let data:serde_json::Value=serde_json::from_str(include_str!("../../../scripts/fixtures/capture-qr-matrix.json")).unwrap();
        let rows:Vec<&str>=data["rows"].as_array().unwrap().iter().map(|row|row.as_str().unwrap()).collect();
        let module=8u32; let size=(rows.len() as u32 + margin*2)*module;
        let image=RgbaImage::from_fn(size,size,|x,y| {
            let mx=(x/module) as i32-margin as i32; let my=(y/module) as i32-margin as i32;
            let inside=mx>=0&&my>=0&&(mx as usize)<rows.len()&&(my as usize)<rows.len();
            let mut dark=inside&&rows[my as usize].as_bytes()[mx as usize]==b'1';
            let finder=inside&&((mx<8&&my<8)||(mx>=rows.len() as i32-8&&my<8)||(mx<8&&my>=rows.len() as i32-8));
            if style=="rounded"&&!finder { let dx=x%module;let dy=y%module;dark&=(dx as f64-3.5).powi(2)+(dy as f64-3.5).powi(2)<=15.0; }
            if style=="logo"&&mx>=18&&mx<=22&&my>=18&&my<=22 {dark=false;}
            let color=match style {
                "inverse"=>if dark {[244,245,242,255]} else {[25,35,29,255]},
                "pale"=>if dark {[207,210,208,255]} else {[234,236,235,255]},
                "transparent"=>if dark {[32,70,48,255]} else {[0,0,0,0]},
                _=>if dark {[30,70+(y%50) as u8,52,255]} else {[240,245,242,255]},
            };
            image::Rgba(color)
        });
        (image,data["text"].as_str().unwrap().to_owned())
    }
    #[test] fn reads_normal_inverted_transparent_pale_rounded_and_logo_symbols() {
        for style in ["normal","inverse","transparent","pale","rounded","logo"] {
            let (image,text)=fixture(style,4);assert_eq!(decode(&image).unwrap(),text,"{style}");
        }
    }
    #[test] fn restores_quiet_zone_and_reads_rotated_symbols() {
        let (image,text)=fixture("normal",0);assert_eq!(decode(&image).unwrap(),text);
        assert_eq!(decode(&image::imageops::rotate90(&image)).unwrap(),text);
    }
    #[test] fn rejects_empty_and_non_qr_images_and_limits_processing_dimensions() {
        assert!(decode(&RgbaImage::new(0,0)).is_err());
        assert!(decode(&RgbaImage::from_pixel(96,96,image::Rgba([255,255,255,255]))).is_err());
        let image=RgbaImage::from_pixel(3000,10,image::Rgba([255,255,255,255]));let processed=grayscale(&image).unwrap();
        assert_eq!(processed.width(),MAX_SIDE);assert!(processed.height()>=1);
    }
}
