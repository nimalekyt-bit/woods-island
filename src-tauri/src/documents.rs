//! Local document text extraction for AI attachments. No office files are executed.
use quick_xml::{events::Event, Reader};
use std::io::{Cursor, Read};
use std::collections::HashMap;

const LIMIT: u64 = 32 * 1024 * 1024;

fn xml_text(source: &str, paragraph: bool) -> Result<String, String> {
    let mut reader = Reader::from_str(source);
    let mut output = String::new();
    loop {
        match reader.read_event().map_err(|e|e.to_string())? {
            Event::Text(text) => output.push_str(&text.unescape().map_err(|e|e.to_string())?),
            Event::CData(text) => output.push_str(&String::from_utf8_lossy(text.as_ref())),
            Event::Empty(tag) if paragraph && [b"w:tab".as_slice(),b"w:br",b"w:cr"].contains(&tag.name().as_ref()) => output.push(if tag.name().as_ref()==b"w:tab" {'\t'} else {'\n'}),
            Event::End(tag) if paragraph && tag.name().as_ref()==b"w:p" => output.push('\n'),
            Event::Eof => break,
            _ => {}
        }
    }
    Ok(output)
}

fn read_entry(archive: &mut zip::ZipArchive<Cursor<&[u8]>>, name: &str) -> Result<String,String> {
    let file = archive.by_name(name).map_err(|e|e.to_string())?;
    if file.size() > LIMIT { return Err("Document expands beyond the 32 MB limit".into()); }
    let mut bytes = Vec::new();
    file.take(LIMIT+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
    if bytes.len() as u64 > LIMIT { return Err("Document expands beyond the 32 MB limit".into()); }
    String::from_utf8(bytes).map_err(|_|"Document XML is not UTF-8".into())
}

fn docx(bytes: &[u8]) -> Result<String,String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e|e.to_string())?;
    xml_text(&read_entry(&mut archive,"word/document.xml")?,true)
}

fn slide_ids(source: &str) -> Result<Vec<String>, String> {
    let mut reader = Reader::from_str(source);
    let mut ids = Vec::new();
    let mut depth = 0usize;
    loop {
        match reader.read_event().map_err(|e| e.to_string())? {
            Event::Start(tag) | Event::Empty(tag) if tag.local_name().as_ref() == b"sldId" => {
                let mut id = None;
                for attribute in tag.attributes() {
                    let attribute = attribute.map_err(|e| e.to_string())?;
                    if attribute.key.as_ref().ends_with(b":id") {
                        id = Some(attribute.unescape_value().map_err(|e| e.to_string())?.into_owned());
                    }
                }
                ids.push(id.filter(|id| !id.is_empty()).ok_or("Slide is missing its relationship ID")?);
                if ids.len() > 10000 { return Err("Presentation has too many slides".into()); }
                // sldId is normally empty; nonempty variants are handled by Reader's end-name checks.
            }
            Event::Start(_) => depth += 1,
            Event::End(tag) if tag.local_name().as_ref() == b"sldId" => {},
            Event::End(_) => depth = depth.checked_sub(1).ok_or("Invalid presentation XML")?,
            Event::Eof => break,
            _ => {}
        }
    }
    if depth != 0 { return Err("Incomplete presentation XML".into()); }
    if ids.is_empty() { return Err("Presentation has no slides".into()); }
    Ok(ids)
}

fn slide_path(target: &str) -> Result<String, String> {
    if target.contains(['\\', ':', '?', '#', '\0']) { return Err("Invalid presentation slide target".into()); }
    let path = if let Some(absolute) = target.strip_prefix('/') { absolute.to_owned() } else { format!("ppt/{target}") };
    if !path.starts_with("ppt/slides/") || !path.ends_with(".xml") || path.split('/').any(|part| part.is_empty() || part == "." || part == "..") {
        return Err("Slide target is outside the presentation slides".into());
    }
    Ok(path)
}

fn slide_relationships(source: &str) -> Result<HashMap<String, String>, String> {
    let mut reader = Reader::from_str(source);
    let mut relationships = HashMap::new();
    let mut depth = 0usize;
    loop {
        match reader.read_event().map_err(|e| e.to_string())? {
            Event::Start(tag) | Event::Empty(tag) if tag.local_name().as_ref() == b"Relationship" => {
                let mut attributes = HashMap::new();
                for attribute in tag.attributes() {
                    let attribute = attribute.map_err(|e| e.to_string())?;
                    attributes.insert(attribute.key.as_ref().to_vec(), attribute.unescape_value().map_err(|e| e.to_string())?.into_owned());
                }
                let kind = attributes.get(b"Type".as_slice()).map(String::as_str).unwrap_or("");
                if ["http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", "http://purl.oclc.org/ooxml/officeDocument/relationships/slide"].contains(&kind) {
                    if attributes.get(b"TargetMode".as_slice()).is_some_and(|mode| mode != "Internal") { return Err("External presentation slides are unsupported".into()); }
                    let id = attributes.get(b"Id".as_slice()).filter(|id| !id.is_empty()).ok_or("Slide relationship is missing its ID")?;
                    let target = slide_path(attributes.get(b"Target".as_slice()).ok_or("Slide relationship is missing its target")?)?;
                    if relationships.insert(id.clone(), target).is_some() { return Err("Duplicate slide relationship ID".into()); }
                }
            }
            Event::Start(_) => depth += 1,
            Event::End(tag) if tag.local_name().as_ref() == b"Relationship" => {},
            Event::End(_) => depth = depth.checked_sub(1).ok_or("Invalid relationships XML")?,
            Event::Eof => break,
            _ => {}
        }
    }
    if depth != 0 { return Err("Incomplete relationships XML".into()); }
    Ok(relationships)
}

fn slide_text(source: &str) -> Result<String, String> {
    let mut reader = Reader::from_str(source);
    let mut output = String::new();
    let mut in_text = false;
    let mut depth = 0usize;
    loop {
        match reader.read_event().map_err(|e| e.to_string())? {
            Event::Start(tag) => { depth += 1; if tag.local_name().as_ref() == b"t" { in_text = true; } }
            Event::Text(text) if in_text => output.push_str(&text.unescape().map_err(|e| e.to_string())?),
            Event::CData(text) if in_text => output.push_str(&String::from_utf8_lossy(text.as_ref())),
            Event::Empty(tag) if tag.local_name().as_ref() == b"br" => output.push('\n'),
            Event::End(tag) => {
                depth = depth.checked_sub(1).ok_or("Invalid slide XML")?;
                match tag.local_name().as_ref() { b"t" => in_text = false, b"p" => output.push('\n'), _ => {} }
            }
            Event::Eof => break,
            _ => {}
        }
        if output.len() as u64 > LIMIT { return Err("Presentation text exceeds the 32 MB limit".into()); }
    }
    if depth != 0 { return Err("Incomplete slide XML".into()); }
    Ok(output)
}

fn pptx(bytes: &[u8]) -> Result<String, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let presentation = read_entry(&mut archive, "ppt/presentation.xml")?;
    let relations = read_entry(&mut archive, "ppt/_rels/presentation.xml.rels")?;
    let mut expanded = presentation.len() as u64 + relations.len() as u64;
    let ids = slide_ids(&presentation)?;
    let relationships = slide_relationships(&relations)?;
    let mut output = String::new();
    for (index, id) in ids.iter().enumerate() {
        let path = relationships.get(id).ok_or("Presentation references a missing slide relationship")?;
        let source = read_entry(&mut archive, path)?;
        expanded += source.len() as u64;
        if expanded > LIMIT { return Err("Presentation expands beyond the 32 MB limit".into()); }
        let text = slide_text(&source)?;
        if !text.trim().is_empty() { output.push_str(&format!("\n[Slide {}]\n{text}", index + 1)); }
        if output.len() as u64 > LIMIT { return Err("Presentation text exceeds the 32 MB limit".into()); }
    }
    Ok(output)
}

fn shared_strings(source: &str) -> Result<Vec<String>,String> {
    let mut reader = Reader::from_str(source);
    let mut strings = Vec::new();
    let mut current = String::new();
    let mut in_text = false;
    loop {
        match reader.read_event().map_err(|e|e.to_string())? {
            Event::Start(tag) if tag.name().as_ref()==b"si" => current.clear(),
            Event::Start(tag) if tag.name().as_ref()==b"t" => in_text=true,
            Event::Text(text) if in_text => current.push_str(&text.unescape().map_err(|e|e.to_string())?),
            Event::End(tag) if tag.name().as_ref()==b"t" => in_text=false,
            Event::End(tag) if tag.name().as_ref()==b"si" => strings.push(current.clone()),
            Event::Eof => break,
            _ => {}
        }
    }
    Ok(strings)
}

fn worksheet(source: &str, shared: &[String]) -> Result<String,String> {
    let mut reader = Reader::from_str(source);
    let mut output = String::new();
    let mut value = String::new();
    let mut kind = String::new();
    let mut text_value = false;
    let mut cells = 0;
    loop {
        match reader.read_event().map_err(|e|e.to_string())? {
            Event::Start(tag) if tag.name().as_ref()==b"row" => cells=0,
            Event::Start(tag) if tag.name().as_ref()==b"c" => {
                value.clear();kind.clear();
                for attribute in tag.attributes() {
                    let attribute=attribute.map_err(|e|e.to_string())?;
                    if attribute.key.as_ref()==b"t" {kind=attribute.unescape_value().map_err(|e|e.to_string())?.into_owned();}
                }
            },
            Event::Start(tag) if tag.name().as_ref()==b"v"||tag.name().as_ref()==b"t" => text_value=true,
            Event::Text(text) if text_value => value.push_str(&text.unescape().map_err(|e|e.to_string())?),
            Event::End(tag) if tag.name().as_ref()==b"v"||tag.name().as_ref()==b"t" => text_value=false,
            Event::End(tag) if tag.name().as_ref()==b"c" => {
                if cells>0 {output.push('\t');} cells+=1;
                if kind=="s" {let index=value.parse::<usize>().map_err(|_|"Invalid spreadsheet string index")?;output.push_str(shared.get(index).ok_or("Missing spreadsheet shared string")?);}
                else if kind=="b" {output.push_str(if value=="1" {"TRUE"} else {"FALSE"});}
                else {output.push_str(&value);}
            },
            Event::End(tag) if tag.name().as_ref()==b"row" => output.push('\n'),
            Event::Eof => break,
            _ => {}
        }
        if output.len() as u64 > LIMIT {return Err("Spreadsheet text exceeds the 32 MB limit".into());}
    }
    Ok(output)
}

fn xlsx(bytes: &[u8]) -> Result<String,String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e|e.to_string())?;
    let shared = match read_entry(&mut archive,"xl/sharedStrings.xml") {Ok(xml)=>shared_strings(&xml)?,Err(_)=>Vec::new()};
    let mut names=archive.file_names().filter(|p|p.starts_with("xl/worksheets/sheet")&&p.ends_with(".xml")).map(str::to_owned).collect::<Vec<_>>();
    names.sort_by_key(|name|name.trim_start_matches("xl/worksheets/sheet").trim_end_matches(".xml").parse::<u32>().unwrap_or(u32::MAX));
    if names.is_empty() {return Err("Workbook has no worksheets".into());}
    let mut output=String::new();
    for name in names {
        output.push_str(&format!("\n[{}]\n",name.trim_start_matches("xl/worksheets/")));
        output.push_str(&worksheet(&read_entry(&mut archive,&name)?,&shared)?);
        if output.len() as u64 > LIMIT {return Err("Workbook text exceeds the 32 MB limit".into());}
    }
    Ok(output)
}

pub fn extract(name:&str,bytes:&[u8])->Result<String,String> {
    let extension=std::path::Path::new(name).extension().and_then(|e|e.to_str()).unwrap_or("").to_ascii_lowercase();
    let text=match extension.as_str() {
        "pdf" => pdf_extract::extract_text_from_mem(bytes).map_err(|e|format!("PDF text extraction failed: {e}"))?,
        "docx" => docx(bytes)?,
        "xlsx" => xlsx(bytes)?,
        "pptx" => pptx(bytes)?,
        _ => String::from_utf8(bytes.to_vec()).map_err(|_|"This binary file format is not supported".to_string())?,
    };
    if text.len() as u64 > LIMIT {return Err("Document text exceeds the 32 MB limit".into());}
    if text.trim().is_empty() {return Err("Document contains no extractable text. For scanned pages, use OCR first.".into());}
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    fn archive(files:&[(&str,&str)])->Vec<u8> {
        let mut writer=zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name,content) in files {writer.start_file(*name,zip::write::SimpleFileOptions::default()).unwrap();writer.write_all(content.as_bytes()).unwrap();}
        writer.finish().unwrap().into_inner()
    }
    #[test] fn docx_preserves_paragraphs_tabs_and_entities() {
        let bytes=archive(&[("word/document.xml","<w:document xmlns:w=\"w\"><w:p><w:r><w:t>Текст &amp; текст</w:t><w:tab/><w:t>дальше</w:t></w:r></w:p><w:p><w:r><w:t>Новая строка</w:t></w:r></w:p></w:document>")]);
        assert_eq!(extract("notes.docx",&bytes).unwrap(),"Текст & текст\tдальше\nНовая строка\n");
    }
    #[test] fn xlsx_resolves_rich_shared_strings_and_cached_formulas() {
        let bytes=archive(&[("xl/sharedStrings.xml","<sst><si><r><t>Продажи</t></r><r><t> &amp; итоги</t></r></si></sst>"),("xl/worksheets/sheet1.xml","<worksheet><sheetData><row><c t=\"s\"><v>0</v></c><c><f>1+1</f><v>2</v></c><c t=\"inlineStr\"><is><t>Встроено</t></is></c></row></sheetData></worksheet>")]);
        assert!(extract("report.xlsx",&bytes).unwrap().contains("Продажи & итоги\t2\tВстроено\n"));
    }
    #[test] fn invalid_archive_is_an_error() {assert!(extract("broken.docx",b"not a zip").is_err());}
    fn presentation(target: &str, mode: &str, content: &str) -> Vec<u8> {
        archive(&[("ppt/presentation.xml", "<p:presentation xmlns:p='p' xmlns:r='r'><p:sldIdLst><p:sldId id='1' r:id='rId1'/></p:sldIdLst></p:presentation>"),
            ("ppt/_rels/presentation.xml.rels", &format!("<Relationships><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide' Target='{target}' {mode}/></Relationships>")),
            ("ppt/slides/slide1.xml", content)])
    }
    #[test] fn pptx_respects_relationship_order_and_drawingml_paragraphs() {
        let bytes = archive(&[("ppt/presentation.xml", "<p:presentation xmlns:p='p' xmlns:r='r'><p:sldIdLst><p:sldId id='9' r:id='second'/><p:sldId id='4' r:id='first'/></p:sldIdLst></p:presentation>"),
            ("ppt/_rels/presentation.xml.rels", "<Relationships><Relationship Id='first' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide' Target='slides/slide1.xml'/><Relationship Id='second' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide' Target='/ppt/slides/slide8.xml'/></Relationships>"),
            ("ppt/slides/slide1.xml", "<p:sld xmlns:p='p' xmlns:a='a'><a:p><a:r><a:t>Первый файл</a:t></a:r></a:p></p:sld>"),
            ("ppt/slides/slide8.xml", "<p:sld xmlns:p='p' xmlns:a='a'>\n<a:p><a:r><a:t>Привет &amp; 🌲</a:t></a:r><a:br/><a:r><a:t><![CDATA[<мир>]]></a:t></a:r></a:p><a:p><a:r><a:t>Дальше</a:t></a:r></a:p></p:sld>")]);
        assert_eq!(extract("slides.PPTX", &bytes).unwrap(), "\n[Slide 1]\nПривет & 🌲\n<мир>\nДальше\n\n[Slide 2]\nПервый файл\n");
    }
    #[test] fn pptx_rejects_external_traversal_missing_and_malformed_slides() {
        for target in ["../outside.xml", "slides/../../outside.xml", "slides\\slide1.xml", "https://host/slide.xml", "/word/document.xml"] {
            assert!(extract("slides.pptx", &presentation(target, "", "<sld/>" )).is_err(), "{target}");
        }
        assert!(extract("slides.pptx", &presentation("slides/slide1.xml", "TargetMode='External'", "<sld/>" )).is_err());
        assert!(extract("slides.pptx", &presentation("slides/missing.xml", "", "<sld/>" )).is_err());
        assert!(extract("slides.pptx", &presentation("slides/slide1.xml", "", "<sld><p><t>broken</p></sld>" )).is_err());
        assert!(extract("slides.pptx", &presentation("slides/slide1.xml", "", "<sld><p><t>unclosed" )).is_err());
        assert!(extract("slides.pptx", b"not a zip").is_err());
    }
    #[test] fn pptx_empty_images_do_not_become_fake_text() {
        assert!(extract("slides.pptx", &presentation("slides/slide1.xml", "", "<sld><p/><picture/></sld>" )).unwrap_err().contains("no extractable text"));
    }
}
