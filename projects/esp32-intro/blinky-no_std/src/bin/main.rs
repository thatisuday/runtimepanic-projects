#![no_std]
#![no_main]

// Bare-metal (no_std) "blinky" for the ESP32-S3-WROOM-1.
//
// There is no plain user LED on this board: the only onboard LED is an
// addressable WS2812 (NeoPixel) on GPIO48. We drive it with the RMT
// peripheral via esp-hal-smartled, cycling the hue so the LED breathes
// through the color wheel. This mirrors the factory MicroPython demo,
// but compiled to native Xtensa machine code with no interpreter and no GC.

use esp_hal::clock::CpuClock;
use esp_hal::main;
use esp_hal::rmt::Rmt;
use esp_hal::time::{Duration, Instant, Rate};
use esp_hal_smartled::{buffer_size, color_order, RmtSmartLeds, WS2812_TIMING};
use esp_println::println;
use smart_leds::{
    hsv::{hsv2rgb, Hsv},
    SmartLedsWrite, RGB8,
};

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

    // One LED, RGB8 color, sent in GRB order (what the WS2812 expects),
    // using the standard WS2812 bit timings.
    let mut led = RmtSmartLeds::<{ buffer_size::<RGB8>(1) }, _, RGB8, color_order::Grb>::new(
        WS2812_TIMING,
        rmt.channel0,
        peripherals.GPIO48,
        Rate::from_mhz(80),
    )
    .unwrap();

    println!("RGB Demo (Rust / no_std / esp-hal)");

    // Walk the hue around the color wheel, dim enough not to blind anyone.
    let mut hue: u8 = 0;
    loop {
        let color = hsv2rgb(Hsv {
            hue,
            sat: 255,
            val: 32,
        });
        led.write([color]).unwrap();
        hue = hue.wrapping_add(1);

        // Busy-wait ~20 ms between steps (no OS, no scheduler here).
        let start = Instant::now();
        while start.elapsed() < Duration::from_millis(20) {}
    }
}
