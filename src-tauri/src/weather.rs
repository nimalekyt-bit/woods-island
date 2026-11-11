use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeatherData {
    pub temperature: f64,
    pub symbol_code: String,
    pub wind_speed: f64,
    pub humidity: f64,
    pub precipitation: f64,
    pub city: String,
}

struct StaticCity {
    name: &'static str,
    region: &'static str,
    lat: f64,
    lon: f64,
}

const POPULAR_CITIES: &[StaticCity] = &[
    StaticCity { name: "Брянск", region: "Брянская область, Россия", lat: 53.2424, lon: 34.3668 },
    StaticCity { name: "Москва", region: "Москва, Россия", lat: 55.7558, lon: 37.6176 },
    StaticCity { name: "Санкт-Петербург", region: "Санкт-Петербург, Россия", lat: 59.9343, lon: 30.3351 },
    StaticCity { name: "Казань", region: "Татарстан, Россия", lat: 55.7887, lon: 49.1221 },
    StaticCity { name: "Новосибирск", region: "Новосибирская область, Россия", lat: 55.0084, lon: 82.9357 },
    StaticCity { name: "Екатеринбург", region: "Свердловская область, Россия", lat: 56.8389, lon: 60.6057 },
    StaticCity { name: "Нижний Новгород", region: "Нижегородская область, Россия", lat: 56.3269, lon: 44.0059 },
    StaticCity { name: "Самара", region: "Самарская область, Россия", lat: 53.1959, lon: 50.1002 },
    StaticCity { name: "Краснодар", region: "Краснодарский край, Россия", lat: 45.0355, lon: 38.9753 },
    StaticCity { name: "Сочи", region: "Краснодарский край, Россия", lat: 43.6028, lon: 39.7342 },
    StaticCity { name: "Ростов-на-Дону", region: "Ростовская область, Россия", lat: 47.2357, lon: 39.7015 },
    StaticCity { name: "Уфа", region: "Башкортостан, Россия", lat: 54.7388, lon: 55.9721 },
    StaticCity { name: "Красноярск", region: "Красноярский край, Россия", lat: 56.0153, lon: 92.8932 },
    StaticCity { name: "Владивосток", region: "Приморский край, Россия", lat: 43.1155, lon: 131.8855 },
    StaticCity { name: "Калининград", region: "Калининградская область, Россия", lat: 54.7104, lon: 20.4522 },
    StaticCity { name: "Воронеж", region: "Воронежская область, Россия", lat: 51.6608, lon: 39.2003 },
    StaticCity { name: "Пермь", region: "Пермский край, Россия", lat: 58.0105, lon: 56.2502 },
    StaticCity { name: "Волгоград", region: "Волгоградская область, Россия", lat: 48.7080, lon: 44.5133 },
    StaticCity { name: "Саратов", region: "Саратовская область, Россия", lat: 51.5406, lon: 46.0086 },
    StaticCity { name: "Тюмень", region: "Тюменская область, Россия", lat: 57.1522, lon: 65.5272 },
    StaticCity { name: "Томск", region: "Томская область, Россия", lat: 56.4977, lon: 84.9744 },
    StaticCity { name: "Иркутск", region: "Иркутская область, Россия", lat: 52.2870, lon: 104.3050 },
    StaticCity { name: "Хабаровск", region: "Хабаровский край, Россия", lat: 48.4827, lon: 135.0840 },
    StaticCity { name: "Минск", region: "Беларусь", lat: 53.9045, lon: 27.5615 },
    StaticCity { name: "Алматы", region: "Казахстан", lat: 43.2220, lon: 76.8512 },
    StaticCity { name: "Астана", region: "Казахстан", lat: 51.1694, lon: 71.4491 },
    StaticCity { name: "Ташкент", region: "Узбекистан", lat: 41.2995, lon: 69.2401 },
    StaticCity { name: "London", region: "Greater London, United Kingdom", lat: 51.5074, lon: -0.1278 },
    StaticCity { name: "Berlin", region: "Germany", lat: 52.5200, lon: 13.4050 },
    StaticCity { name: "Paris", region: "France", lat: 48.8566, lon: 2.3522 },
    StaticCity { name: "Dubai", region: "United Arab Emirates", lat: 25.2048, lon: 55.2708 },
    StaticCity { name: "New York", region: "New York, United States", lat: 40.7128, lon: -74.0060 },
];

pub async fn search_cities(query: &str) -> Vec<Value> {
    let q_clean = query.trim().to_lowercase();
    if q_clean.is_empty() {
        return vec![];
    }

    let mut matches = Vec::new();
    
    // 1. Instant local matching (0ms latency, 100% offline-ready)
    for c in POPULAR_CITIES {
        if c.name.to_lowercase().contains(&q_clean) || c.region.to_lowercase().contains(&q_clean) {
            matches.push(json!({
                "name": c.name,
                "region": c.region,
                "lat": c.lat,
                "lon": c.lon
            }));
        }
    }

    // If local match found, return immediately
    if !matches.is_empty() {
        return matches;
    }

    // 2. Query Nominatim OpenStreetMap API
    let url = format!(
        "https://nominatim.openstreetmap.org/search?q={}&format=jsonv2&addressdetails=1&limit=6&featureType=settlement&accept-language=ru",
        urlencoding::encode(&q_clean)
    );

    let client = reqwest::Client::builder()
        .user_agent("WoodsIsland/1.0 (https://github.com/nimalekyt-bit/woods-island)")
        .timeout(std::time::Duration::from_millis(2500))
        .build();

    if let Ok(c) = client {
        if let Ok(resp) = c.get(&url).send().await {
            if let Ok(arr) = resp.json::<Vec<Value>>().await {
                for item in arr {
                    let name = item.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let addr = item.get("address");
                    let mut region_parts = Vec::new();
                    if let Some(a) = addr {
                        if let Some(state) = a.get("state").and_then(|v| v.as_str()) {
                            region_parts.push(state.to_string());
                        } else if let Some(county) = a.get("county").and_then(|v| v.as_str()) {
                            region_parts.push(county.to_string());
                        }
                        if let Some(country) = a.get("country").and_then(|v| v.as_str()) {
                            region_parts.push(country.to_string());
                        }
                    }
                    let region = if region_parts.is_empty() {
                        item.get("display_name").and_then(|v| v.as_str()).unwrap_or("").to_string()
                    } else {
                        region_parts.join(", ")
                    };
                    let lat = item.get("lat")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<f64>().ok())
                        .unwrap_or(0.0);
                    let lon = item.get("lon")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<f64>().ok())
                        .unwrap_or(0.0);

                    if !name.is_empty() && (lat != 0.0 || lon != 0.0) {
                        matches.push(json!({
                            "name": name,
                            "region": region,
                            "lat": lat,
                            "lon": lon
                        }));
                    }
                }
            }
        }
    }

    matches
}

pub async fn fetch_weather(lat: f64, lon: f64, city_name: &str) -> Result<WeatherData, String> {
    let url = format!(
        "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={:.4}&lon={:.4}",
        lat, lon
    );

    let client = reqwest::Client::builder()
        .user_agent("WoodsIsland/1.0 (https://github.com/nimalekyt-bit/woods-island)")
        .timeout(std::time::Duration::from_millis(3000))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    let current = resp["properties"]["timeseries"][0]["data"].clone();
    let instant_details = &current["instant"]["details"];
    let next_1h = &current["next_1_hours"];

    let temp = instant_details["air_temperature"].as_f64().ok_or("Missing forecast temperature")?;
    let wind = instant_details["wind_speed"].as_f64().ok_or("Missing forecast wind speed")?;
    let humidity = instant_details["relative_humidity"].as_f64().ok_or("Missing forecast humidity")?;
    let precip = next_1h["details"]["precipitation_amount"].as_f64().unwrap_or(0.0);
    let symbol = next_1h["summary"]["symbol_code"].as_str().unwrap_or("clearsky_day").to_string();

    Ok(WeatherData {
        temperature: temp,
        symbol_code: symbol,
        wind_speed: wind,
        humidity,
        precipitation: precip,
        city: city_name.to_string(),
    })
}

/// Forecasts are fetched for the chosen city, never substituted with fabricated weather.
pub async fn forecast(settings: &Value, force: bool) -> Result<Value,String> {
    let lat=settings["weatherLat"].as_f64().unwrap_or(0.0);
    let lon=settings["weatherLon"].as_f64().unwrap_or(0.0);
    let city=settings["weatherCity"].as_str().unwrap_or_default();
    if city.is_empty(){return Err("Choose a weather city in settings".into());}
    if !lat.is_finite()||!lon.is_finite()||!(-90.0..=90.0).contains(&lat)||!(-180.0..=180.0).contains(&lon){return Err("Invalid weather coordinates".into());}
    if !force {
        if let Some(cache)=crate::storage::load_json_file("weather.json") {
            let age=crate::media::now_ms().saturating_sub(cache["fetchedAt"].as_u64().unwrap_or(0));
            if cache["schemaVersion"]==2 && cache["lat"]==json!(lat)&&cache["lon"]==json!(lon)
                && cache["units"]==weather_units(settings) && valid_forecast(&cache) && age<15*60*1000 {return Ok(cache);}
        }
    }
    let client=reqwest::Client::builder().user_agent("WoodsIsland/1.0 (https://github.com/nimalekyt-bit)").timeout(std::time::Duration::from_secs(10)).build().map_err(|e|e.to_string())?;
    let endpoint=std::env::var("WOODS_ISLAND_WEATHER_URL").ok().filter(|_|crate::win::WindowManager::passive_qa()).unwrap_or_else(||"https://api.met.no/weatherapi/locationforecast/2.0/compact".into());
    let url=reqwest::Url::parse(&endpoint).map_err(|e|e.to_string())?;
    if url.scheme()!="https" && !matches!(url.host_str(),Some("127.0.0.1"|"localhost")){return Err("Weather endpoint must use HTTPS or loopback".into());}
    let data:Value=client.get(url.clone()).query(&[("lat",format!("{lat:.4}")),("lon",format!("{lon:.4}"))]).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
    let mut result=parse_forecast(&data,city,lat,lon,weather_units(settings),weather_timezone(settings,lat,lon))?;
    // Sunrise is independent: a unavailable optional endpoint must not discard
    // a usable forecast. The UI shows missing observations explicitly.
    let sun_url=if url.host_str()==Some("api.met.no"){"https://api.met.no/weatherapi/sunrise/3.0/sun".to_owned()}else{url.join("/sun").map_err(|e|e.to_string())?.to_string()};
    let offset=result["utcOffset"].as_i64().unwrap_or(0);
    let date=chrono::Utc::now()+chrono::Duration::seconds(offset);
    let offset_text=format!("{}{:02}:{:02}",if offset<0{"-"}else{"+"},offset.abs()/3600,offset.abs()%3600/60);
    if let Ok(response)=client.get(sun_url).timeout(std::time::Duration::from_secs(3)).query(&[("lat",format!("{lat:.4}")),("lon",format!("{lon:.4}")),("date",date.format("%Y-%m-%d").to_string()),("offset",offset_text)]).send().await {
        if response.status().is_success(){if let Ok(sun)=response.json::<Value>().await{attach_sun(&mut result,&sun);}}
    }
    let _=crate::storage::save_json_file("weather.json",&result);
    Ok(result)
}

fn weather_units(settings:&Value)->&str {if settings["weatherUnits"]=="imperial"{"imperial"}else{"metric"}}

fn weather_timezone(settings:&Value,lat:f64,lon:f64)->chrono::FixedOffset {
    use chrono::{Datelike,TimeZone};
    if let Some(tz)=settings["weatherUtcOffset"].as_i64().and_then(|s|i32::try_from(s).ok()).and_then(chrono::FixedOffset::east_opt){return tz;}
    let now=chrono::Utc::now();let year=now.year();
    let last_sunday=|month:u32|{let next=chrono::Utc.with_ymd_and_hms(year,month+1,1,1,0,0).single().unwrap();let last=next-chrono::Duration::days(1);last-chrono::Duration::days(last.weekday().num_days_from_sunday() as i64)};
    let nth_sunday=|month:u32,n:i64,hour:u32|{let first=chrono::Utc.with_ymd_and_hms(year,month,1,hour,0,0).single().unwrap();first+chrono::Duration::days((7-first.weekday().num_days_from_sunday() as i64)%7+(n-1)*7)};
    let eu_dst=now>=last_sunday(3)&&now<last_sunday(10);
    let us_dst=now>=nth_sunday(3,2,7)&&now<nth_sunday(11,1,6);
    let city=POPULAR_CITIES.iter().find(|c|(c.lat-lat).abs()<0.1&&(c.lon-lon).abs()<0.1).map(|c|c.name);
    let hours=match city {
        Some("Брянск"|"Москва"|"Санкт-Петербург"|"Нижний Новгород"|"Краснодар"|"Сочи"|"Ростов-на-Дону"|"Воронеж"|"Волгоград"|"Казань"|"Минск")=>3,
        Some("Самара")=>4,Some("Уфа"|"Екатеринбург"|"Тюмень")=>5,
        Some("Новосибирск"|"Томск"|"Красноярск")=>7,Some("Иркутск")=>8,
        Some("Владивосток"|"Хабаровск")=>10,Some("Калининград")=>2,
        Some("Алматы"|"Астана"|"Ташкент")=>5,
        Some("London")=>i32::from(eu_dst),Some("Berlin"|"Paris")=>1+i32::from(eu_dst),
        Some("Dubai")=>4,Some("New York")=>-5+i32::from(us_dst),_=>0,
    };
    chrono::FixedOffset::east_opt(hours*3600).unwrap()
}

fn number(value:&Value,name:&str)->Result<f64,String>{value[name].as_f64().filter(|n|n.is_finite()).ok_or_else(||format!("Missing forecast {name}"))}

fn weather_code(symbol:&str)->i64 {
    let name=symbol.split('_').next().unwrap_or(symbol);
    if name.contains("thunder"){95}else if name.contains("sleet"){68}else if name.contains("snow"){
        if name.contains("heavy"){75}else if name.contains("light"){71}else{73}
    }else if name.contains("rain"){
        if name.contains("heavy"){65}else if name.contains("light"){61}else{63}
    }else{match name{"clearsky"=>0,"fair"=>1,"partlycloudy"=>2,"fog"=>45,_=>3}}
}

fn valid_forecast(value:&Value)->bool {
    value["now"].is_object() && value["now"]["code"].is_number()
        && value["hours"].as_array().is_some_and(|a|!a.is_empty())
        && value["days"].as_array().is_some_and(|a|!a.is_empty())
        && value["hours"][0]["time"].as_i64().is_some_and(|n|n>0&&n<100_000_000_000)
}

fn attach_sun(result:&mut Value,data:&Value){
    for (name,key) in [("sunrise","sunrise"),("sunset","sunset")]{
        if let Some(at)=data["properties"][key]["time"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()){
            result["days"][0][name]=json!(at.timestamp());
        }
    }
}

fn parse_forecast(data:&Value,city:&str,lat:f64,lon:f64,units:&str,tz:chrono::FixedOffset)->Result<Value,String>{
    use chrono::{Offset,TimeZone};
    let series=data["properties"]["timeseries"].as_array().filter(|v|!v.is_empty()).ok_or("Weather service returned no forecast")?;
    let mut hours=Vec::new();
    let mut days=std::collections::BTreeMap::<i64,Value>::new();
    let temp_unit=|n:f64|if units=="imperial"{n*1.8+32.}else{n};
    let wind_unit=|n:f64|if units=="imperial"{n*2.2369362921}else{n};
    for entry in series {
        let instant=&entry["data"]["instant"]["details"];
        let next=if entry["data"]["next_1_hours"].is_object(){&entry["data"]["next_1_hours"]}else{&entry["data"]["next_6_hours"]};
        let temp=number(instant,"air_temperature")?;
        let wind=number(instant,"wind_speed")?;
        let humidity=number(instant,"relative_humidity")?;
        let code=next["summary"]["symbol_code"].as_str().unwrap_or("cloudy");
        let at=chrono::DateTime::parse_from_rfc3339(entry["time"].as_str().ok_or("Missing forecast time")?).map_err(|e|e.to_string())?.timestamp();
        let local=tz.timestamp_opt(at,0).single().ok_or("Invalid forecast timestamp")?;
        let day=local.date_naive().and_hms_opt(0,0,0).and_then(|d|tz.from_local_datetime(&d).earliest()).ok_or("Invalid local date")?.timestamp();
        let precip=next["details"]["precipitation_amount"].as_f64().unwrap_or(0.0).max(0.);
        let wmo=weather_code(code);
        // MET has no apparent temperature; use the published wind-chill formula
        // in cold weather, otherwise the observed air temperature.
        let feels=if temp<=10.&&wind>1.34{let v=(wind*3.6).powf(0.16);13.12+0.6215*temp-11.37*v+0.3965*temp*v}else{temp};
        let gamma=(humidity.clamp(0.01,100.)/100.).ln()+17.62*temp/(243.12+temp);
        let dew=243.12*gamma/(17.62-gamma);
        hours.push(json!({"time":at,"temp":temp_unit(temp),"feels":temp_unit(feels),"code":wmo,"isDay":!code.ends_with("_night"),"precip":precip,"wind":wind_unit(wind),"windDir":instant["wind_from_direction"],"gust":instant["wind_speed_of_gust"].as_f64().map(wind_unit),"humidity":humidity,"pressure":instant["air_pressure_at_sea_level"],"dewPoint":temp_unit(dew),"uv":instant["ultraviolet_index_clear_sky"]}));
        let record=days.entry(day).or_insert_with(||json!({"time":day,"min":temp_unit(temp),"max":temp_unit(temp),"code":wmo,"precip":0.,"sunrise":null,"sunset":null}));
        record["min"]=json!(record["min"].as_f64().unwrap().min(temp_unit(temp)));
        record["max"]=json!(record["max"].as_f64().unwrap().max(temp_unit(temp)));
        record["precip"]=json!(record["precip"].as_f64().unwrap()+precip);
        if wmo>record["code"].as_i64().unwrap(){record["code"]=json!(wmo);}
    }
    let now=hours.first().cloned().ok_or("Empty forecast")?;
    let offset=tz.timestamp_opt(now["time"].as_i64().unwrap(),0).single().unwrap().offset().fix().local_minus_utc();
    Ok(json!({"schemaVersion":2,"city":city,"location":city,"lat":lat,"lon":lon,"units":units,"timezone":tz.to_string(),"utcOffset":offset,"now":now,"hours":hours.into_iter().take(24).collect::<Vec<_>>(),"days":days.into_values().take(7).collect::<Vec<_>>(),"fetchedAt":crate::media::now_ms(),"source":"MET Norway"}))
}

pub async fn rates()->Result<Value,String>{
    let data:Value=reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build().map_err(|e|e.to_string())?.get("https://www.cbr-xml-daily.ru/daily_json.js").send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
    let currencies=data["Valute"].as_object().ok_or("Exchange-rate service returned invalid data")?;
    let mut rub=serde_json::Map::new();
    for (code,val) in currencies {
        if let (Some(rate),Some(nominal))=(val["Value"].as_f64(),val["Nominal"].as_f64()){if nominal>0.0{rub.insert(code.clone(),json!(rate/nominal));}}
    }
    let result=json!({"date":data["Date"],"rub":rub,"fetchedAt":crate::media::now_ms()});
    let _=crate::storage::save_json_file("rates.json",&result); Ok(result)
}

#[cfg(test)]
mod tests{
    use super::*;
    #[tokio::test] async fn bryansk_search_works_offline(){let cities=search_cities("БРЯНСК").await;assert_eq!(cities.len(),1);assert_eq!(cities[0]["lat"],53.2424);}
    #[test] fn invalid_forecast_is_an_error(){assert!(parse_forecast(&json!({}),"Брянск",53.2424,34.3668,"metric",chrono::FixedOffset::east_opt(10800).unwrap()).is_err());}
    fn fixture()->Value{json!({"properties":{"timeseries":[{"time":"2026-11-11T21:00:00Z","data":{"instant":{"details":{"air_temperature":2.,"wind_speed":3.,"relative_humidity":80.,"air_pressure_at_sea_level":1012.,"wind_from_direction":180.}},"next_1_hours":{"summary":{"symbol_code":"lightrain_night"},"details":{"precipitation_amount":0.4}}}}]}})}
    #[test] fn forecast_matches_days_seconds_units_and_numeric_codes(){let value=parse_forecast(&fixture(),"Брянск",53.2424,34.3668,"metric",chrono::FixedOffset::east_opt(10800).unwrap()).unwrap();assert!(valid_forecast(&value));assert_eq!(value["utcOffset"],10800);assert_eq!(value["now"]["code"],61);assert_eq!(value["now"]["isDay"],false);assert_eq!(value["days"][0]["time"],1794430800i64);assert_eq!(value["days"][0]["precip"],0.4);let imperial=parse_forecast(&fixture(),"Брянск",53.2424,34.3668,"imperial",chrono::FixedOffset::east_opt(10800).unwrap()).unwrap();assert_eq!(imperial["now"]["temp"],35.6);assert!((imperial["now"]["wind"].as_f64().unwrap()-6.7108).abs()<0.01);assert_eq!(imperial["now"]["pressure"],1012.);assert_eq!(imperial["now"]["precip"],0.4);}
    #[test] fn old_cache_and_incomplete_forecasts_are_rejected(){assert!(!valid_forecast(&json!({"now":{"code":"cloudy"},"hours":[{"time":1794427200000i64}]})));let mut broken=fixture();broken["properties"]["timeseries"][0]["data"]["instant"]["details"]["wind_speed"]=Value::Null;assert!(parse_forecast(&broken,"Брянск",53.2424,34.3668,"metric",chrono::FixedOffset::east_opt(10800).unwrap()).is_err());}
}
