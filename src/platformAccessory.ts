import type {
  CharacteristicValue,
  PlatformAccessory,
  Service,
} from 'homebridge';

import type { BalboaESP32Platform } from './platform.js';

/**
 * Represents the current state of the spa.
 *
 * Temperature values are updated from the ESPHome native API.
 */
interface SpaState {
  currentTemperature: number;
  targetTemperature: number;
}

/**
 * Balboa Spa Accessory
 *
 * Exposes one physical spa to HomeKit with:
 *
 * - Thermostat
 * - Jets switch
 * - Light switch
 */
export class BalboaSpaAccessory {

  private readonly thermostatService: Service;
  private readonly jetsService: Service;
  private readonly lightService: Service;

  /**
   * Spa temperature state.
   *
   * Initial values are replaced by live ESPHome sensor data
   * after the API connection is established.
   */
  private readonly state: SpaState = {
    currentTemperature: 37.5,
    targetTemperature: 39.0,
  };

  constructor(
    private readonly platform: BalboaESP32Platform,
    private readonly accessory: PlatformAccessory,
  ) {

    /**
     * Information shown for the accessory in HomeKit.
     */
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Balboa Water Group',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        'ESP32 / ESPHome Spa Interface',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        'BALBOA-ESP32',
      );

    /**
     * THERMOSTAT
     */
    this.thermostatService =
      this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(
        this.platform.Service.Thermostat,
        'Temperature',
      );

    this.thermostatService
      .setCharacteristic(
        this.platform.Characteristic.Name,
        'Temperature',
      )
      .setCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        'Temperature',
      );

    /**
     * Current water temperature.
     */
    this.thermostatService
      .getCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
      )
      .onGet(() => this.state.currentTemperature);

    /**
     * Target water temperature.
     */
    const targetTemperatureCharacteristic =
      this.thermostatService.getCharacteristic(
        this.platform.Characteristic.TargetTemperature,
      );

    targetTemperatureCharacteristic.setProps({
      minValue: 26.7,
      maxValue: 40,
      minStep: 0.5,
    });

    targetTemperatureCharacteristic
      .onGet(() => this.state.targetTemperature)
      .onSet(this.setTargetTemperature.bind(this));

    /**
     * The spa is a heating-only device.
     *
     * Restrict HomeKit to Heat only so the spa is not presented
     * as having Off, Cool, or Auto operating modes.
     */
    const targetHeatingCoolingState =
      this.thermostatService.getCharacteristic(
        this.platform.Characteristic.TargetHeatingCoolingState,
      );

    targetHeatingCoolingState.setProps({
      validValues: [
        this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
      ],
    });

    targetHeatingCoolingState
      .onGet(() =>
        this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
      )
      .onSet(async () => {
        // The Balboa spa is always treated as heat-only.
      });

    /**
     * Report whether the heater is actually running.
     */
    this.thermostatService
      .getCharacteristic(
        this.platform.Characteristic.CurrentHeatingCoolingState,
      )
      .onGet(() =>
        this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
      );

    /**
     * JETS
     */
    this.jetsService =
      this.accessory.getService('Jets')
      || this.accessory.addService(
        this.platform.Service.Switch,
        'Jets',
        'jets',
      );
    
    this.jetsService
      .setCharacteristic(
        this.platform.Characteristic.Name,
        'Jets',
      )
      .setCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        'Jets',
      );    

    this.jetsService
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => false)
      .onSet(this.setJets.bind(this));

    /**
     * LIGHT
     */
    this.lightService =
      this.accessory.getService('Light')
      || this.accessory.addService(
        this.platform.Service.Switch,
        'Light',
        'light',
      );

    this.lightService
      .setCharacteristic(
        this.platform.Characteristic.Name,
        'Light',
      )
      .setCharacteristic(
        this.platform.Characteristic.ConfiguredName,
        'Light',
      );

    this.lightService
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(() => false)
      .onSet(this.setLight.bind(this));

    this.platform.esphomeClient.on('sensor', (event) => {

      if (
        event.entity === 'Spa Measured Temp'
        && typeof event.state === 'number'
      ) {
        this.state.currentTemperature = event.state;

        this.thermostatService
          .getCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
          )
          .updateValue(event.state);

        this.platform.log.info(
          `Spa measured temperature: ${event.state.toFixed(1)} °C`,
        );
      }

      if (
        event.entity === 'Spa Set Temp'
        && typeof event.state === 'number'
      ) {
        this.state.targetTemperature = event.state;

        this.thermostatService
          .getCharacteristic(
            this.platform.Characteristic.TargetTemperature,
          )
          .updateValue(event.state);

        this.platform.log.info(
          `Spa target temperature: ${event.state.toFixed(1)} °C`,
        );
      }
    });

    this.platform.log.info('Hot Tub accessory initialized');
  }

  /**
   * Handle a target-temperature change from HomeKit.
   *
   * Sends the requested Celsius temperature to the ESPHome
   * set_spa_target_temperature action.
   */
  async setTargetTemperature(value: CharacteristicValue) {

    const temperature = value as number;

    this.platform.log.info(
      'Target temperature set to:',
      temperature,
    );

    this.platform.esphomeClient.executeServiceByName(
      'set_spa_target_temperature',
      [
        { floatValue: temperature },
      ],
    );
  }

  /**
   * Handle a momentary Jets command from HomeKit.
   *
   * Triggers the ESPHome Spa Jets button and then resets
   * the HomeKit switch to Off.
   */
  async setJets(value: CharacteristicValue) {

    const on = value as boolean;

    if (!on) {
      return;
    }

    this.platform.log.info('Jets button pressed');

    this.platform.esphomeClient.sendButtonCommand(
      'button-spa_jets',
    );

    setTimeout(() => {
      this.jetsService
        .getCharacteristic(this.platform.Characteristic.On)
        .updateValue(false);
    }, 500);
  }

  /**
   * Handle a momentary Light command from HomeKit.
   *
   * Triggers the ESPHome Spa Lights button and then resets
   * the HomeKit switch to Off.
   */
  async setLight(value: CharacteristicValue) {

    const on = value as boolean;

    if (!on) {
      return;
    }

    this.platform.log.info('Light button pressed');

    this.platform.esphomeClient.sendButtonCommand(
      'button-spa_lights',
    );

    setTimeout(() => {
      this.lightService
        .getCharacteristic(this.platform.Characteristic.On)
        .updateValue(false);
    }, 500);
  }
}