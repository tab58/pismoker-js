import { MAX31865, MAX31865ConfigOptions } from "../rtd/max31865";

export { MAX31865ConfigOptions };

export interface RTDevice {
  getTempCelsius(): Promise<number>;
}

/**
 * The types of standard Traeger RTDs.
 */
export enum PlatinumResistorType {
  PT100,
  PT1000,
}

/**
 * The value of the R_Ref resistor.
 */
const PlatinumRefResistorValue = {
  [PlatinumResistorType.PT100]: 430.0,
  [PlatinumResistorType.PT1000]: 4300.0,
};

/**
 * The 'nominal' 0-degrees-C resistance of the sensor.
 */
const PlatinumNominalResistanceValue = {
  [PlatinumResistorType.PT100]: 100.0,
  [PlatinumResistorType.PT1000]: 1000.0,
};

/**
 * Contains information for a resistance-temperature device wired to the MAX31865.
 */
export class TraegerRTDevice implements RTDevice {
  private _device: MAX31865;

  constructor(r0: number, rRef: number, options?: MAX31865ConfigOptions) {
    this._device = new MAX31865(r0, rRef, options);
  }

  public fromPlatinumResistorType(type: PlatinumResistorType): TraegerRTDevice {
    const r0 = PlatinumNominalResistanceValue[type];
    const rRef = PlatinumRefResistorValue[type];
    return new TraegerRTDevice(r0, rRef);
  }

  public async getTempCelsius() {
    return this._device.getTemperature();
  }
}
