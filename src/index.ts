import type { API } from 'homebridge';

import { BalboaESP32Platform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

/**
 * Register the Balboa ESP32 platform with Homebridge.
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, BalboaESP32Platform);
};