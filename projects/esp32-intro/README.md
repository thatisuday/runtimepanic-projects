# ESP32-S3 Intro (Rust)

Companion code for the article [**"Rust on the ESP32-S3"**](https://runtimepanic.com/rust/rust-on-esp32-s3) on [runtimepanic.com](https://runtimepanic.com).

Three small projects for the **ESP32-S3-WROOM-1** that show both ways to run Rust on the chip: bare-metal (`no_std`) with `esp-hal`, and `std` on top of ESP-IDF.

## Projects

| Project | Track | What it does |
| --- | --- | --- |
| [`blinky-no_std`](./blinky-no_std) | `no_std` / bare-metal | Blinks the onboard WS2812 RGB LED (GPIO48) red, green, blue, one second each, with `esp-hal` + RMT, no OS. |
| [`blinky-std`](./blinky-std) | `std` / ESP-IDF | The same red/green/blue cycle, written against Rust `std` on FreeRTOS with `esp-idf-hal`. |
| [`wifi-json-std`](./wifi-json-std) | `std` / ESP-IDF | Connects to Wi-Fi, does an HTTPS GET to a mock JSON API, parses it with `serde`. |

## Toolchain

All three target the Xtensa ESP32-S3, which needs Espressif's forked Rust toolchain. Install it once with [`espup`](https://github.com/esp-rs/espup):

```bash
cargo install espup ldproxy espflash
espup install
source $HOME/export-esp.sh   # run in every shell before building
```

Then open any project directory and follow its README. The `no_std` project builds in seconds; the `std` projects compile ESP-IDF on the first build (several minutes, cached afterward).

> 💡 These projects prioritize clarity over production hardening, as they accompany a blog post.
