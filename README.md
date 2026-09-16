## Homebridge / Apple Home Accessory for Balboa VL400 ESP32 Hot Tub Controllers

This Homebridge plugin is designed to work with the [Balboa VL400 ESP32](https://github.com/sixer-fixer/Balboa-VL400-ESP32) ESPHome project. That project provides the ESP32 hardware interface, Balboa topside communication, and ESPHome entities required by this plugin.

The plugin connects directly to the ESP32 through the ESPHome native API and exposes the hot tub as a grouped Apple Home accessory through Homebridge, including temperature control, heater status, jets, and lighting.

The Balboa VL400 ESP32 project was developed from the original [Balboa-GS5xx](https://github.com/kgstorm/Balboa-GS5xx) project by Kevin Storm.

## Dependencies

This plugin requires:

- [Homebridge](https://homebridge.io/)
- [Balboa VL400 ESP32](https://github.com/sixer-fixer/Balboa-VL400-ESP32) running on a compatible ESP32
- ESPHome native API enabled on the ESP32
- `esphome-client` version 1.3.1 (installed automatically with the plugin)
