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
            if cache["schemaVersion"]==2 && cache["timezoneVersion"]==1 && cache["lat"]==json!(lat)&&cache["lon"]==json!(lon)
                && cache["timezoneSetting"]==json!(settings["weatherTimezone"].as_str().unwrap_or_default())
                && cache["timezoneWarning"]!=true
                && cache["units"]==weather_units(settings) && valid_forecast(&cache) && age<15*60*1000 {return Ok(cache);}
        }
    }
    let client=reqwest::Client::builder().user_agent("WoodsIsland/1.0 (https://github.com/nimalekyt-bit)").timeout(std::time::Duration::from_secs(10)).build().map_err(|e|e.to_string())?;
    let endpoint=std::env::var("WOODS_ISLAND_WEATHER_URL").ok().filter(|_|crate::win::WindowManager::passive_qa()).unwrap_or_else(||"https://api.met.no/weatherapi/locationforecast/2.0/compact".into());
    let url=reqwest::Url::parse(&endpoint).map_err(|e|e.to_string())?;
    if url.scheme()!="https" && !matches!(url.host_str(),Some("127.0.0.1"|"localhost")){return Err("Weather endpoint must use HTTPS or loopback".into());}
    let data:Value=client.get(url.clone()).query(&[("lat",format!("{lat:.4}")),("lon",format!("{lon:.4}"))]).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
    let zone=resolve_timezone(settings,lat,lon,&client).await?;
    let mut result=match zone.zone {
        WeatherZone::Named(tz)=>parse_forecast(&data,city,lat,lon,weather_units(settings),tz)?,
        WeatherZone::Fixed(tz)=>parse_forecast(&data,city,lat,lon,weather_units(settings),tz)?,
    };
    result["timezoneVersion"]=json!(1);
    result["timezoneSetting"]=json!(settings["weatherTimezone"].as_str().unwrap_or_default());
    result["timezoneSource"]=json!(zone.source);
    result["timezoneWarning"]=json!(zone.source=="utcFallback");
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

enum WeatherZone { Named(chrono_tz::Tz), Fixed(chrono::FixedOffset) }
struct ResolvedZone { zone:WeatherZone, source:&'static str }

fn builtin_timezone(lat:f64,lon:f64)->Option<chrono_tz::Tz> {
    let city=POPULAR_CITIES.iter().find(|c|(c.lat-lat).abs()<0.1&&(c.lon-lon).abs()<0.1).map(|c|c.name);
    let name=match city {
        Some("Брянск"|"Москва"|"Санкт-Петербург"|"Нижний Новгород"|"Краснодар"|"Сочи"|"Ростов-на-Дону"|"Воронеж"|"Казань")=>"Europe/Moscow",
        Some("Волгоград")=>"Europe/Volgograd",Some("Минск")=>"Europe/Minsk",
        Some("Самара")=>"Europe/Samara",Some("Уфа"|"Екатеринбург"|"Тюмень")=>"Asia/Yekaterinburg",
        Some("Новосибирск")=>"Asia/Novosibirsk",Some("Томск")=>"Asia/Tomsk",Some("Красноярск")=>"Asia/Krasnoyarsk",Some("Иркутск")=>"Asia/Irkutsk",
        Some("Владивосток"|"Хабаровск")=>"Asia/Vladivostok",Some("Калининград")=>"Europe/Kaliningrad",
        Some("Алматы"|"Астана")=>"Asia/Almaty",Some("Ташкент")=>"Asia/Tashkent",
        Some("London")=>"Europe/London",Some("Berlin")=>"Europe/Berlin",Some("Paris")=>"Europe/Paris",
        Some("Dubai")=>"Asia/Dubai",Some("New York")=>"America/New_York",_=>return None,
    };
    name.parse().ok()
}

fn cached_timezone(cache:&Value,lat:f64,lon:f64)->Option<chrono_tz::Tz> {
    if cache["lat"]!=json!(lat)||cache["lon"]!=json!(lon){return None;}
    cache["timezone"].as_str()?.parse().ok()
}

async fn resolve_timezone(settings:&Value,lat:f64,lon:f64,client:&reqwest::Client)->Result<ResolvedZone,String> {
    let manual=settings["weatherTimezone"].as_str().unwrap_or_default().trim();
    if !manual.is_empty(){return manual.parse::<chrono_tz::Tz>().map(|zone|ResolvedZone{zone:WeatherZone::Named(zone),source:"manual"}).map_err(|_|"Invalid IANA time zone. Choose a time zone in weather settings.".into());}
    // Keep a previously explicit fixed offset working during profile migration.
    if let Some(zone)=settings["weatherUtcOffset"].as_i64().and_then(|n|i32::try_from(n).ok()).and_then(chrono::FixedOffset::east_opt){return Ok(ResolvedZone{zone:WeatherZone::Fixed(zone),source:"manual"});}
    if let Some(zone)=builtin_timezone(lat,lon){return Ok(ResolvedZone{zone:WeatherZone::Named(zone),source:"builtin"});}
    let cache=crate::storage::load_json_file("weather-timezone.json").unwrap_or(Value::Null);
    if let Some(zone)=cached_timezone(&cache,lat,lon){return Ok(ResolvedZone{zone:WeatherZone::Named(zone),source:"cached"});}
    // A tiny cached lookup avoids keeping a global polygon database in memory.
    // Passive acceptance stays offline and never sends fixture coordinates.
    if !crate::win::WindowManager::passive_qa(){
        if let Ok(response)=client.get("https://api.open-meteo.com/v1/forecast")
            .timeout(std::time::Duration::from_secs(3))
            .query(&[("latitude",format!("{lat:.4}")),("longitude",format!("{lon:.4}")),("timezone","auto".into()),("forecast_days","1".into())])
            .send().await {
            if response.status().is_success(){if let Ok(value)=response.json::<Value>().await{
                if let Some(zone)=value["timezone"].as_str().and_then(|name|name.parse::<chrono_tz::Tz>().ok()){
                    let _=crate::storage::save_json_file("weather-timezone.json",&json!({"lat":lat,"lon":lon,"timezone":zone.to_string()}));
                    return Ok(ResolvedZone{zone:WeatherZone::Named(zone),source:"resolved"});
                }
            }}
        }
    }
    Ok(ResolvedZone{zone:WeatherZone::Named(chrono_tz::UTC),source:"utcFallback"})
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

fn parse_forecast<T:chrono::TimeZone+std::fmt::Display>(data:&Value,city:&str,lat:f64,lon:f64,units:&str,tz:T)->Result<Value,String> where T::Offset:std::fmt::Display {
    use chrono::Offset;
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
        // A few zones advance at midnight. Use the first existing hour of that
        // local date rather than dropping an otherwise valid forecast.
        let day=(0..24).find_map(|hour|local.date_naive().and_hms_opt(hour,0,0).and_then(|d|tz.from_local_datetime(&d).earliest())).ok_or("Invalid local date")?.timestamp();
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
    use chrono::{Offset,TimeZone};
    #[test] fn known_city_timezone_uses_iana_rules_at_each_date(){
        let zone=builtin_timezone(40.7128,-74.0060).unwrap();
        assert_eq!(zone.to_string(),"America/New_York");
        assert_eq!(zone.with_ymd_and_hms(2026,1,10,12,0,0).single().unwrap().offset().fix().local_minus_utc(),-18000);
        assert_eq!(zone.with_ymd_and_hms(2026,7,10,12,0,0).single().unwrap().offset().fix().local_minus_utc(),-14400);
    }
    #[test] fn timezone_cache_is_bound_to_coordinates_and_valid_iana_name(){
        let cache=json!({"lat":35.68,"lon":139.69,"timezone":"Asia/Tokyo"});
        assert_eq!(cached_timezone(&cache,35.68,139.69).unwrap(),chrono_tz::Asia::Tokyo);
        assert!(cached_timezone(&cache,35.69,139.69).is_none());
        assert!(cached_timezone(&json!({"lat":35.68,"lon":139.69,"timezone":"invalid/zone"}),35.68,139.69).is_none());
    }
    #[tokio::test] async fn manual_timezone_is_validated_without_a_network_lookup(){
        let client=reqwest::Client::new();
        let resolved=resolve_timezone(&json!({"weatherTimezone":"Asia/Kolkata"}),0.,0.,&client).await.unwrap();
        assert_eq!(resolved.source,"manual");
        assert!(matches!(resolved.zone,WeatherZone::Named(chrono_tz::Asia::Kolkata)));
        assert!(resolve_timezone(&json!({"weatherTimezone":"invalid/zone"}),0.,0.,&client).await.is_err());
    }
    #[test] fn forecast_days_follow_dst_instead_of_current_fixed_offset(){
        let mut input=fixture();
        let mut entries=Vec::new();
        for time in ["2026-03-08T06:00:00Z","2026-03-08T07:00:00Z","2026-03-09T04:30:00Z"]{
            let mut entry=input["properties"]["timeseries"][0].clone();entry["time"]=json!(time);entries.push(entry);
        }
        input["properties"]["timeseries"]=json!(entries);
        let forecast=parse_forecast(&input,"New York",40.7128,-74.006,"metric",chrono_tz::America::New_York).unwrap();
        assert_eq!(forecast["timezone"],"America/New_York");
        assert_eq!(forecast["days"].as_array().unwrap().len(),2);
        assert_eq!(forecast["days"][1]["time"],chrono::DateTime::parse_from_rfc3339("2026-03-09T04:00:00Z").unwrap().timestamp());
    }
    #[tokio::test] async fn bryansk_search_works_offline(){let cities=search_cities("БРЯНСК").await;assert_eq!(cities.len(),1);assert_eq!(cities[0]["lat"],53.2424);}
    #[test] fn invalid_forecast_is_an_error(){assert!(parse_forecast(&json!({}),"Брянск",53.2424,34.3668,"metric",chrono::FixedOffset::east_opt(10800).unwrap()).is_err());}
    fn fixture()->Value{json!({"properties":{"timeseries":[{"time":"2026-11-11T21:00:00Z","data":{"instant":{"details":{"air_temperature":2.,"wind_speed":3.,"relative_humidity":80.,"air_pressure_at_sea_level":1012.,"wind_from_direction":180.}},"next_1_hours":{"summary":{"symbol_code":"lightrain_night"},"details":{"precipitation_amount":0.4}}}}]}})}
    #[test] fn forecast_matches_days_seconds_units_and_numeric_codes(){let value=parse_forecast(&fixture(),"Брянск",53.2424,34.3668,"metric",chrono::FixedOffset::east_opt(10800).unwrap()).unwrap();assert!(valid_forecast(&value));assert_eq!(value["utcOffset"],10800);assert_eq!(value["now"]["code"],61);assert_eq!(value["now"]["isDay"],false);assert_eq!(value["days"][0]["time"],1794430800i64);assert_eq!(value["days"][0]["precip"],0.4);let imperial=parse_forecast(&fixture(),"Брянск",53.2424,34.3668,"imperial",chrono::FixedOffset::east_opt(10800).unwrap()).unwrap();assert_eq!(imperial["now"]["temp"],35.6);assert!((imperial["now"]["wind"].as_f64().unwrap()-6.7108).abs()<0.01);assert_eq!(imperial["now"]["pressure"],1012.);assert_eq!(imperial["now"]["precip"],0.4);}
    #[test] fn old_cache_and_incomplete_forecasts_are_rejected(){assert!(!valid_forecast(&json!({"now":{"code":"cloudy"},"hours":[{"time":1794427200000i64}]})));let mut broken=fixture();broken["properties"]["timeseries"][0]["data"]["instant"]["details"]["wind_speed"]=Value::Null;assert!(parse_forecast(&broken,"Брянск",53.2424,34.3668,"metric",chrono::FixedOffset::east_opt(10800).unwrap()).is_err());}
}
