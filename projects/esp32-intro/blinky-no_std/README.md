# Blinky (`no_std` / bare-metal)

Cycles the onboard RGB LED on an **ESP32-S3-WROOM-1** through the color wheel, written in bare-metal Rust with no operating system and no interpreter. This is the `no_std` counterpart to [`blinky-std`](../blinky-std) and mirrors the factory MicroPython RGB demo the board ships with.

The only onboard LED is an addressable **WS2812 (NeoPixel) on GPIO48**. It is driven with the chip's **RMT** peripheral through [`esp-hal`](https://github.com/esp-rs/esp-hal) 1.x and `esp-hal-smartled`.

## Prerequisites

- The **Espressif Rust toolchain** for the Xtensa target, installed with [`espup`](https://github.com/esp-rs/espup):

  ```bash
  cargo install espup
  espup install
  ```

  `espup` writes an environment file (`$HOME/export-esp.sh`) that puts the forked compiler and the Xtensa linker on your `PATH`. Source it in every shell before building:

  ```bash
  source $HOME/export-esp.sh
  ```

- [`espflash`](https://github.com/esp-rs/espflash) to flash and monitor the board:

  ```bash
  cargo install espflash
  ```

## Build

```bash
cargo build --release
```

## Flash and run

With the board connected over its USB port, flash and open the serial monitor in one step:

```bash
cargo run --release
```

The configured runner is `espflash flash --monitor`, so this flashes the binary and then streams the serial output. You should see the boot log followed by:

```
RGB Demo (Rust / no_std / esp-hal)
```

and the onboard LED breathing through red, green, blue, and back.

> 💡 If the build fails with a linker error about `xtensa-esp32s3-elf-gcc`, you have not sourced `export-esp.sh` in this shell.
