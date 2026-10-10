# Wi-Fi + JSON API (`std` / ESP-IDF)

Connects an **ESP32-S3-WROOM-1** to your Wi-Fi network, makes an **HTTPS GET** request to a public mock JSON API ([jsonplaceholder.typicode.com](https://jsonplaceholder.typicode.com/todos/1)), parses the JSON with `serde`, and logs the result over the serial monitor.

It uses the ESP-IDF services layer ([`esp-idf-svc`](https://github.com/esp-rs/esp-idf-svc)): the system event loop, NVS, the Wi-Fi station, and the mbedTLS-backed HTTPS client with ESP-IDF's bundled root certificates.

## Prerequisites

- The same toolchain as the blinky demos: [`espup`](https://github.com/esp-rs/espup) (`espup install`, then `source $HOME/export-esp.sh`), plus `ldproxy` and `espflash`:

  ```bash
  cargo install espup ldproxy espflash
  espup install
  source $HOME/export-esp.sh
  ```

- `git`, `python3`, and `cmake` for the ESP-IDF build (pinned to **v5.3.3**). If you have already built [`blinky-std`](../blinky-std), the ESP-IDF checkout under `~/.espressif` is reused.

## Configure Wi-Fi

Credentials are read from `cfg.toml` at compile time and are **gitignored** so they never get committed. Copy the example and fill it in:

```bash
cp cfg.toml.example cfg.toml
```

```toml
# cfg.toml
[wifi-json-std]
wifi_ssid = "your-network-name"
wifi_pass = "your-network-password"
```

> 💡 The ESP32-S3 radio is **2.4 GHz only**. If the connection never comes up, make sure you are giving it a 2.4 GHz SSID, not a 5 GHz one.

## Build, flash, and run

```bash
cargo run --release
```

This flashes the binary and opens the serial monitor. You should see the Wi-Fi association, a DHCP lease, then the request and the parsed response:

```
I (...) wifi-json-std: Wi-Fi netif up
I (...) wifi-json-std: Connected. IP info: ...
I (...) wifi-json-std: -> GET https://jsonplaceholder.typicode.com/todos/1
I (...) wifi-json-std: <- 200
I (...) wifi-json-std: Body: {"userId":1,"id":1,"title":"delectus aut autem","completed":false}
I (...) wifi-json-std: Parsed todo #1: Todo { user_id: 1, id: 1, title: "delectus aut autem", completed: false }
```
