// Blinky for the ESP32-S3-WROOM-1, written against Rust `std` on ESP-IDF.
//
// The only onboard LED is an addressable WS2812 (NeoPixel) on GPIO48. We drive
// it with the chip's RMT peripheral through the ESP-IDF HAL, cycling the hue so
// the LED breathes through the color wheel. This is the `std` counterpart to
// `blinky-no_std`: same hardware, same effect, but running on FreeRTOS with a
// real `std` library (threads, `println!`, `Duration`) underneath.

use esp_idf_hal::peripherals::Peripherals;
use esp_idf_svc::log::EspLogger;
use log::info;
use smart_leds::{
    hsv::{hsv2rgb, Hsv},
    SmartLedsWrite,
};
use std::thread::sleep;
use std::time::Duration;
use ws2812_esp32_rmt_driver::Ws2812Esp32Rmt;

fn main() {
    // Pulls in a few runtime patches esp-idf-sys needs linked. Harmless to call,
    // required to call once, so it goes first.
    esp_idf_sys::link_patches();
    // Route the `log` crate through ESP-IDF's logger (same console as boot log).
    EspLogger::initialize_default();

    let peripherals = Peripherals::take().unwrap();
    let led_pin = peripherals.pins.gpio48;
    let channel = peripherals.rmt.channel0;

    // The driver owns one RMT channel and the LED pin, and encodes each color
    // into the WS2812's precisely-timed pulse train for us.
    let mut ws2812 = Ws2812Esp32Rmt::new(channel, led_pin).unwrap();

    info!("RGB Demo (Rust / std / esp-idf-hal)");

    // Walk the hue around the color wheel, dim enough not to blind anyone.
    let mut hue: u8 = 0;
    loop {
        let color = hsv2rgb(Hsv {
            hue,
            sat: 255,
            val: 32,
        });
        // `write` takes an iterator of pixels; we have exactly one LED.
        ws2812.write([color].into_iter()).unwrap();
        hue = hue.wrapping_add(1);

        // FreeRTOS puts this task to sleep for 20 ms, so other tasks (and the
        // idle task that feeds the watchdog) get to run. No busy-wait here.
        sleep(Duration::from_millis(20));
    }
}
