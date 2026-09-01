import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { BalboaSpaAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

/**
 * BalboaESP32Platform
 *
 * This is the main entry point for the Balboa ESP32 Homebridge plugin.
 *
 * The platform is responsible for creating and restoring the Hot Tub
 * accessory. Communication with the ESPHome device will be added later.
 */
export class BalboaESP32Platform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  /**
   * Accessories that Homebridge restores from its cache at startup.
   */
  public readonly accessories: Map<string, PlatformAccessory> = new Map();

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing Balboa ESP32 platform:', this.config.name);

    /**
     * Wait until Homebridge has finished restoring cached accessories
     * before creating or restoring the Hot Tub accessory.
     */
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Homebridge finished launching');
      this.discoverSpa();
    });
  }

  /**
   * Called by Homebridge when an existing accessory is restored
   * from the accessory cache.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * Creates the Hot Tub accessory.
   *
   * For now there is always exactly one mocked spa. Later this method
   * will use the configured ESPHome device to identify the real spa.
   */
  discoverSpa() {

    const spa = {
      uniqueId: 'balboa-esp32-spa',
      displayName: 'Hot Tub',
    };

    /**
     * Generate a stable UUID so Homebridge recognizes this as the same
     * accessory after a restart.
     */
    const uuid = this.api.hap.uuid.generate(spa.uniqueId);

    const existingAccessory = this.accessories.get(uuid);

    if (existingAccessory) {

      this.log.info('Restoring existing Hot Tub accessory from cache');

      existingAccessory.context.device = spa;

      this.api.updatePlatformAccessories([existingAccessory]);

      new BalboaSpaAccessory(this, existingAccessory);

    } else {

      this.log.info('Adding new Hot Tub accessory');

      const accessory = new this.api.platformAccessory(
        spa.displayName,
        uuid,
      );

      accessory.context.device = spa;

      new BalboaSpaAccessory(this, accessory);

      this.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );
    }
  }
}