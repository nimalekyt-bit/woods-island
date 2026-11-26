//! Decode the PNG displayed by the native shelf with the application's QR engine.
//! Expected links stay in a local QA file rather than logs or command arguments.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args_os().skip(1);
    let png = args.next().ok_or("Expected QR PNG path")?;
    let expected = args.next().ok_or("Expected link file path")?;
    if args.next().is_some() {
        return Err("Unexpected argument".into());
    }
    let expected = std::fs::read_to_string(expected)?;
    let image = image::open(png)?.into_rgba8();
    let decoded = woods_island_lib::capture::qr(&image)?;
    if decoded != expected {
        return Err("Displayed QR does not contain the active phone link".into());
    }
    let url = reqwest::Url::parse(&decoded)?;
    if url.scheme() != "http"
        || url.path() != "/phone/"
        || url.fragment().is_none_or(|token| token.len() != 64)
    {
        return Err("Phone QR has an unexpected navigation format".into());
    }
    println!("PASS: displayed phone QR decodes to the active HTTP page and capability");
    Ok(())
}
