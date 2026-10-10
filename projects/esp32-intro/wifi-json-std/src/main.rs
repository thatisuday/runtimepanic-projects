// Wi-Fi + JSON API demo for the ESP32-S3-WROOM-1, on Rust `std` / ESP-IDF.
//
// This connects to your Wi-Fi network as a station, makes an HTTPS GET request
// to a public mock JSON API (jsonplaceholder.typicode.com), parses the JSON
// response with serde, and logs the result over the serial monitor.
//
// It uses the ESP-IDF services layer (esp-idf-svc): the system event loop,
// NVS (where the Wi-Fi driver caches calibration data), the Wi-Fi station,
// and the mbedTLS-backed HTTPS client with the bundled root certificates.
//
// Wi-Fi credentials come from `cfg.toml` (gitignored) via toml-cfg; copy
// `cfg.toml.example` to `cfg.toml` and fill in your SSID and password.

use anyhow::{bail, Result};
use embedded_svc::{
    http::{client::Client as HttpClient, Method},
    utils::io,
    wifi::{AuthMethod, ClientConfiguration, Configuration},
};
use esp_idf_svc::hal::peripherals::Peripherals;
use esp_idf_svc::http::client::{Configuration as HttpConfiguration, EspHttpConnection};
use esp_idf_svc::log::EspLogger;
use esp_idf_svc::wifi::{BlockingWifi, EspWifi};
use esp_idf_svc::{eventloop::EspSystemEventLoop, nvs::EspDefaultNvsPartition};
use log::info;
use serde::Deserialize;

// Reads `[wifi-json-std]` from `cfg.toml` at compile time into `CONFIG`.
#[toml_cfg::toml_config]
pub struct Config {
    #[default("")]
    wifi_ssid: &'static str,
    #[default("")]
    wifi_pass: &'static str,
}

// The shape of one todo from https://jsonplaceholder.typicode.com/todos/1 :
// {"userId":1,"id":1,"title":"delectus aut autem","completed":false}
#[derive(Debug, Deserialize)]
struct Todo {
    #[serde(rename = "userId")]
    user_id: u32,
    id: u32,
    title: String,
    completed: bool,
}

const URL: &str = "https://jsonplaceholder.typicode.com/todos/1";

fn main() -> Result<()> {
    esp_idf_svc::sys::link_patches();
    EspLogger::initialize_default();

    if CONFIG.wifi_ssid.is_empty() {
        bail!("Wi-Fi SSID is empty. Copy cfg.toml.example to cfg.toml and fill it in.");
    }

    // These three singletons are the backbone of ESP-IDF networking: the modem
    // peripheral owns the radio, the event loop delivers Wi-Fi/IP events, and
    // NVS gives the Wi-Fi driver somewhere to persist its calibration blobs.
    let peripherals = Peripherals::take()?;
    let sys_loop = EspSystemEventLoop::take()?;
    let nvs = EspDefaultNvsPartition::take()?;

    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(peripherals.modem, sys_loop.clone(), Some(nvs))?,
        sys_loop,
    )?;
    connect_wifi(&mut wifi)?;

    let ip_info = wifi.wifi().sta_netif().get_ip_info()?;
    info!("Connected. IP info: {ip_info:?}");

    // Build an HTTPS-capable client. `crt_bundle_attach` wires in ESP-IDF's
    // bundled Mozilla root-certificate store so TLS can verify the server.
    let config = HttpConfiguration {
        crt_bundle_attach: Some(esp_idf_svc::sys::esp_crt_bundle_attach),
        ..Default::default()
    };
    let mut client = HttpClient::wrap(EspHttpConnection::new(&config)?);

    let todo = fetch_todo(&mut client)?;
    info!("Parsed todo #{}: {:?}", todo.id, todo);
    info!(
        "  user {} | \"{}\" | completed = {}",
        todo.user_id, todo.title, todo.completed
    );

    // Nothing left to do; idle so the serial monitor keeps the output on screen.
    loop {
        std::thread::sleep(core::time::Duration::from_secs(10));
    }
}

/// Perform the HTTPS GET and decode the JSON body into a `Todo`.
fn fetch_todo(client: &mut HttpClient<EspHttpConnection>) -> Result<Todo> {
    let headers = [("accept", "application/json")];
    let request = client.request(Method::Get, URL, &headers)?;
    info!("-> GET {URL}");

    let mut response = request.submit()?;
    let status = response.status();
    info!("<- {status}");

    // The payload is tiny, so a single fixed buffer is plenty.
    let mut buf = [0u8; 512];
    let len = io::try_read_full(&mut response, &mut buf).map_err(|e| e.0)?;
    let body = std::str::from_utf8(&buf[..len])?;
    info!("Body: {body}");

    Ok(serde_json::from_str(body)?)
}

/// Connect to the Wi-Fi network named in `cfg.toml` and wait for an IP lease.
fn connect_wifi(wifi: &mut BlockingWifi<EspWifi<'static>>) -> Result<()> {
    let config: Configuration = Configuration::Client(ClientConfiguration {
        ssid: CONFIG.wifi_ssid.try_into().unwrap(),
        bssid: None,
        auth_method: AuthMethod::WPA2Personal,
        password: CONFIG.wifi_pass.try_into().unwrap(),
        channel: None,
        ..Default::default()
    });
    wifi.set_configuration(&config)?;

    wifi.start()?;
    info!("Wi-Fi started");
    wifi.connect()?;
    info!("Wi-Fi connected");
    wifi.wait_netif_up()?;
    info!("Wi-Fi netif up");

    Ok(())
}
