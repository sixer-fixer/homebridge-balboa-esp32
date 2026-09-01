import type {
  CharacteristicValue,
  PlatformAccessory,
  Service,
} from 'homebridge';

import type { BalboaESP32Platform } from './platform.js';

/**
 * Represents the current state of the spa.
 *
 * These values are mocked for now. Later, they will be populated
 * from the ESPHome native API.
 */
interface SpaState {
  currentTemperature: number;
  targetTemperature: number;
  heating: boolean;
  jets: boolean;
  light: boolean;
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
   * Mock spa state used during initial development.
   *
   * Later this state will be updated from ESPHome.
   */
  private readonly state: SpaState = {
    currentTemperature: 37.5,
    targetTemperature: 39.0,
    heating: true,
    jets: false,
    light: false,
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
      minValue: 26,
      maxValue: 40,
      minStep: 1,
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
      .onGet(() => {
        if (this.state.heating) {
          return this.platform.Characteristic
            .CurrentHeatingCoolingState.HEAT;
        }

        return this.platform.Characteristic
          .CurrentHeatingCoolingState.OFF;
      });

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
      .onGet(() => this.state.jets)
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
      .onGet(() => this.state.light)
      .onSet(this.setLight.bind(this));

    this.platform.log.info('Hot Tub accessory initialized');
  }

  /**
   * Handle a target-temperature change from HomeKit.
   *
   * Eventually this will compare the requested temperature with the
   * ESPHome-reported set temperature and send Warm/Cool commands.
   */
  async setTargetTemperature(value: CharacteristicValue) {

    const temperature = value as number;

    this.state.targetTemperature = temperature;

    this.platform.log.info(
      'Target temperature set to:',
      temperature,
    );
  }

  /**
   * Handle Jets commands from HomeKit.
   *
   * Eventually this will trigger the ESPHome spa_pumps button.
   */
  async setJets(value: CharacteristicValue) {

    const on = value as boolean;

    this.state.jets = on;

    this.platform.log.info(
      'Jets set to:',
      on ? 'ON' : 'OFF',
    );
  }

  /**
   * Handle Light commands from HomeKit.
   *
   * Eventually this will trigger the ESPHome spa_lights button.
   */
  async setLight(value: CharacteristicValue) {

    const on = value as boolean;

    this.state.light = on;

    this.platform.log.info(
      'Light set to:',
      on ? 'ON' : 'OFF',
    );
  }
}