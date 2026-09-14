import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { EspHomeClient } from 'esphome-client';
import { BalboaSpaAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

/**
 * BalboaESP32Platform
 *
 * Main entry point for the Balboa ESP32 Homebridge plugin.
 *
 * Creates and restores the Hot Tub accessory and manages the
 * connection to the ESPHome native API.
 */
export class BalboaESP32Platform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly esphomeClient: EspHomeClient;

  private esphomeConnected = false;
  public lastEspHomeActivity = Date.now();

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
    this.esphomeClient = new EspHomeClient({
      clientId: 'homebridge-balboa-esp32',
      host: (this.config.host as string) || 'balboa-gs5xx.local',
      port: (this.config.port as number) || 6053,
      psk: this.config.encryptionKey as string,
    });

    this.esphomeClient.on('connect', (encrypted) => {
      this.esphomeConnected = true;
      this.log.info(`Connected to ESPHome device (encrypted: ${encrypted})`);
    });

    this.esphomeClient.on('disconnect', () => {
      this.esphomeConnected = false;
      this.log.warn('Disconnected from ESPHome device');

      const reconnect = () => {
        if (this.esphomeConnected) {
          return;
        }

        this.log.info('Attempting to reconnect to ESPHome device...');
        this.esphomeClient.connect();

        if (!this.esphomeConnected) {
          setTimeout(reconnect, 15000);
        }
      };

      setTimeout(reconnect, 15000);
    });

    this.esphomeClient.on('deviceInfo', (info) => {
      this.log.debug(`ESPHome device: ${info.name} v${info.esphomeVersion}`);
    });

    this.esphomeClient.on('entities', (entities) => {
      this.lastEspHomeActivity = Date.now();

      this.log.debug(`ESPHome discovered ${entities.length} entities`);

      for (const entity of entities) {

        if (!entity.objectId) {
          const entityId =
            `${entity.type}-${entity.name.replace(/ /g, '_').toLowerCase()}`;

          const clientInternals = this.esphomeClient as unknown as {
            entityKeys: Map<string, number>;
          };

          clientInternals.entityKeys.set(entityId, entity.key);

          this.log.debug(
            `Registered fallback ESPHome ID: ${entityId} → ${entity.key}`,
          );
        }
      }
    });

    this.log.debug('Finished initializing Balboa ESP32 platform:', this.config.name);

    /**
     * Wait until Homebridge has finished restoring cached accessories
     * before creating or restoring the Hot Tub accessory.
     */
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Homebridge finished launching');
      this.esphomeClient.connect();
      this.discoverSpa();

      setInterval(() => {
        const inactivity = Date.now() - this.lastEspHomeActivity;

        if (inactivity > 2 * 60 * 1000) {
          this.log.warn(
            `No ESPHome data received for ${Math.round(inactivity / 1000)} seconds; resetting connection`,
          );

          this.esphomeClient.disconnect();
        }
      }, 60 * 1000);
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
   * Creates or restores the Hot Tub accessory.
   *
   * The plugin currently manages one configured Balboa ESP32 spa.
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