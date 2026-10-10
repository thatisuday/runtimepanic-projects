# Blinky (`std` / ESP-IDF)

Cycles the onboard RGB LED on an **ESP32-S3-WROOM-1** through the color wheel, written in Rust `std` on top of ESP-IDF. This is the `std` counterpart to [`blinky-no_std`](../blinky-no_std): same hardware, same effect, but running on FreeRTOS with a real `std` library (threads, `println!`, `Duration`) underneath.

The only onboard LED is an addressable **WS2812 (NeoPixel) on GPIO48**. It is driven with the chip's **RMT** peripheral through `esp-idf-hal` and the `ws2812-esp32-rmt-driver` crate.

## Prerequisites

- The **Espressif Rust toolchain** for the Xtensa target, installed with [`espup`](https://github.com/esp-rs/espup):

  ```bash
  cargo install espup
  espup install
  source $HOME/export-esp.sh   # run in every shell before building
  ```

- [`ldproxy`](https://github.com/esp-rs/embuild) (the linker wrapper the ESP-IDF build needs) and [`espflash`](https://github.com/esp-rs/espflash):

  ```bash
  cargo install ldproxy espflash
  ```

- A working C/build environment for the ESP-IDF side: `git`, `python3`, and `cmake`. The first build downloads and compiles **ESP-IDF v5.3.3** (pinned in `.cargo/config.toml`), so expect it to take several minutes and a few hundred MB under `~/.espressif`.

> 💡 Unlike the `no_std` build, this one compiles a full C framework the first time. Later builds reuse the cached ESP-IDF and are fast.

## Build

```bash
cargo build --release
```

## Flash and run

With the board connected over its USB port:

```bash
cargo run --release
```

The configured runner flashes the binary and opens the serial monitor. You should see the ESP-IDF boot log, then:

```
RGB Demo (Rust / std / esp-idf-hal)
```

and the onboard LED breathing through the color wheel.
