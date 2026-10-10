// Blinky for the ESP32-S3-WROOM-1, written against Rust `std` on ESP-IDF.
//
// The only onboard LED is an addressable WS2812 (NeoPixel) on GPIO48. We drive
// it with the chip's RMT peripheral through the ESP-IDF HAL, showing red, then
// green, then blue, one second each. This is the `std` counterpart to
// `blinky-no_std`: same hardware, same light show, but running on FreeRTOS with
// a real `std` library (threads, `sleep`, `Duration`) underneath.

use esp_idf_hal::peripherals::Peripherals;
use esp_idf_svc::log::EspLogger;
use log::info;
use smart_leds::{SmartLedsWrite, RGB8};
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

    // The three colors, kept low (32 out of 255) so the LED is comfortable to
    // look at. RGB8 { r, g, b } is just the red, green, and blue brightness bytes.
    let red = RGB8 { r: 32, g: 0, b: 0 };
    let green = RGB8 { r: 0, g: 32, b: 0 };
    let blue = RGB8 { r: 0, g: 0, b: 32 };

    loop {
        // Show each color for one second, then move on to the next.
        for color in [red, green, blue] {
            ws2812.write([color].into_iter()).unwrap();

            // FreeRTOS puts this task to sleep for one second, so other tasks
            // (and the idle task that feeds the watchdog) get to run meanwhile.
            sleep(Duration::from_secs(1));
        }
    }
}
