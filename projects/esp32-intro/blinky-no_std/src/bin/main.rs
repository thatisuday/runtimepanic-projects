#![no_std]
#![no_main]

// Bare-metal (no_std) "blinky" for the ESP32-S3-WROOM-1.
//
// There is no plain user LED on this board: the only onboard LED is an
// addressable WS2812 (NeoPixel) on GPIO48. We drive it with the RMT
// peripheral via esp-hal-smartled, showing red, then green, then blue, one
// second each. That is the same light show the board shipped running under
// MicroPython, but here it is compiled to native Xtensa machine code with no
// interpreter and no garbage collector.

use esp_hal::clock::CpuClock;
use esp_hal::main;
use esp_hal::rmt::Rmt;
use esp_hal::time::{Duration, Instant, Rate};
use esp_hal_smartled::{buffer_size, color_order, RmtSmartLeds, WS2812_TIMING};
use esp_println::println;
use smart_leds::{SmartLedsWrite, RGB8};

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

extern crate alloc;

// Emits the app-descriptor the esp-idf bootloader looks for.
esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let config = esp_hal::Config::default().with_cpu_clock(CpuClock::max());
    let peripherals = esp_hal::init(config);

    esp_alloc::heap_allocator!(#[esp_hal::ram(reclaimed)] size: 73744);

    // The RMT peripheral generates the precisely-timed pulse train the
    // WS2812 needs. We clock it at 80 MHz so one source tick is 12.5 ns.
    let rmt = Rmt::new(peripherals.RMT, Rate::from_mhz(80)).unwrap();

    // Build the LED driver for one WS2812 on GPIO48. The type is wordy because
    // the crate asks us to spell out the buffer size and the color order
    // (WS2812s take their bytes green-red-blue) up front; `new` then just needs
    // the standard WS2812 timings and the RMT channel.
    let mut led = RmtSmartLeds::<{ buffer_size::<RGB8>(1) }, _, RGB8, color_order::Grb>::new(
        WS2812_TIMING,
        rmt.channel0,
        peripherals.GPIO48,
        Rate::from_mhz(80),
    )
    .unwrap();

    println!("RGB Demo (Rust / no_std / esp-hal)");

    // The three colors, one per channel. The values are kept low (32 out of a
    // possible 255) so the LED is comfortable to look at: RGB8 { r, g, b } is
    // just the red, green, and blue brightness bytes.
    let red = RGB8 { r: 32, g: 0, b: 0 };
    let green = RGB8 { r: 0, g: 32, b: 0 };
    let blue = RGB8 { r: 0, g: 0, b: 32 };

    loop {
        // Show each color for one second, then move on to the next.
        for color in [red, green, blue] {
            led.write([color]).unwrap();

            // Busy-wait one second. With no OS there is no scheduler to hand
            // the core to, so we simply spin until a second has passed.
            let start = Instant::now();
            while start.elapsed() < Duration::from_secs(1) {}
        }
    }
}
