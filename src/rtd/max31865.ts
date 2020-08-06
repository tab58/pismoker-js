import spi, { SpiDevice } from "spi-device";

export enum SPIMode {
  MODE0 = 0,
  MODE1 = 1,
  MODE2 = 2,
  MODE3 = 3,
}

enum MAX31865ReadRegister {
  CONFIG = 0x00,
  RTDMSBs = 0x01,
  RTDLSBs = 0x02,
  HighFaultThreshMSB = 0x03,
  HighFaultThreshLSB = 0x04,
  LowFaultThreshMSB = 0x05,
  LowFaultThreshLSB = 0x06,
  FaultStatue = 0x07,
}

enum MAX31865WriteRegister {
  CONFIG = 0x80,
  HighFaultThreshMSB = 0x83,
  HighFaultThreshLSB = 0x84,
  LowFaultThreshMSB = 0x85,
  LowFaultThreshLSB = 0x86,
}

/**
 * Theory of Operation
 * -------------------
 *
 * Resistance vs. temperature is reasonably linear, but there is some curvature as given by the Callendar-Van Dusen equation.
 *
 * R(T) = R_0 * (1 + a*T + b*T^2 + c*(T-100)*T^3)
 *
 * For 0 deg C <= T <= 850 deg Celsius, c = 0. This makes the equation quadratic in T, which can be solved for in closed-form.
 */

export interface MAX31865ConfigOptions {
  mode?: SPIMode; // 2-bit, MODE0, MODE1, MODE2, or MODE3, default MODE0
  chipSelectHigh?: boolean; // true for active high chip select, default false
  lsbFirst?: boolean; // true for least significant bit first transfer, default false
  threeWire?: boolean; // true for shared MISO/MOSI signals, default false
  loopback?: boolean; // true for loopback mode, default false
  noChipSelect?: boolean; // true for 1 device per bus, no chip select, default false
  ready?: boolean; // true if device pulls low to pause, default false
  bitsPerWord?: number; // 8-bit, device word size, default 8
  maxSpeedHz?: number; // 32-bit, device clock frequency in Hertz, default system specific
}

const defaultConfig: MAX31865ConfigOptions = {
  mode: SPIMode.MODE1, // 2-bit, MODE0, MODE1, MODE2, or MODE3, default MODE0
  chipSelectHigh: false, // true for active high chip select, default false
  lsbFirst: false, // true for least significant bit first transfer, default false
  threeWire: false, // true for shared MISO/MOSI signals, default false
  loopback: false, // true for loopback mode, default false
  noChipSelect: false, // true for 1 device per bus, no chip select, default false
  ready: false, // true if device pulls low to pause, default false
  bitsPerWord: 8, // 8-bit, device word size, default 8
  maxSpeedHz: 500000,
};

/**
 * Information container for SPI messaging with the MAX31865.
 */
export class MAX31865 {
  private _device: SpiDevice;
  private _rNom: number;
  private _rRef: number;

  private _rtdA = 3.9083e-3; // deg C^-1
  private _rtdB = -5.775e-7; // deg C^-2
  // private _rtdC = -4.183e-12; // deg C^-4

  private _coeffs5thOrder = [
    1.5243e-10,
    -2.8183e-8,
    -4.826e-6,
    2.5859e-3,
    2.2228,
    -242.02,
  ];

  constructor(
    rtdNominal: number,
    refResistor: number,
    options: MAX31865ConfigOptions = defaultConfig
  ) {
    this._rNom = rtdNominal;
    this._rRef = refResistor;
    const BUS_N0 = 0;
    const DEVICE_NO = 0;
    const config = Object.assign({}, defaultConfig, options);
    this._device = spi.open(
      BUS_N0,
      DEVICE_NO,
      config as spi.SpiOptions,
      (err) => {
        if (err) {
          throw new Error(
            `MAX31865(): could not open SPI interface;\n${err.message}`
          );
        }
      }
    );
  }

  /**
   * Reads the raw resistance value from the RTD.
   */
  public async readRTD() {
    await this.clearFaultStatus();
    await this.setBiasVoltage(true);
    await this._delay(10);
    await this.setOneShot();
    await this._delay(65);
    const rawValue = await this._readUint16(MAX31865ReadRegister.RTDMSBs);
    const rtd = rawValue >> 1;
    return rtd;
  }

  public async getTemperature() {
    const A = this._rtdA;
    const B = this._rtdB;
    const R0 = this._rNom;
    const Rref = this._rRef;

    const raw = await this.readRTD();
    const Rt = (raw / 32768) * Rref;

    const z1 = -A;
    const z2 = A * A - 4 * B;
    const z3 = (4 * B) / R0;
    const z4 = 2 * B;

    const t1 = z2 + z3 * Rt;
    const t = (Math.sqrt(t1) + z1) / z4;

    // return temp over 0C
    if (t >= 0) {
      return t;
    }

    const RRt = (Rt / R0) * 100;
    let cs = this._coeffs5thOrder;
    let r = RRt;

    let res = cs[0];
    for (let i = 1; i < cs.length; ++i) {
      res = res * r + cs[i];
    }
    return res;
  }

  /**
   * Write 1 to this bit when using a 3-wire RTD connection. In this mode the voltage
   * between FORCE+ and RTDIN+ is subtracted from (RTDIN+ - RTDIN-) to compensate for
   * the IR errors caused by using a single wire for the FORCE- and RTDIN- connections.
   * When using 2-wire or 4-wire connections, write 0 to this bit.
   * @param threeWire True if RTD is a three-wire setup, false if not.
   */
  public async setWireConfig(threeWire: boolean): Promise<void> {
    return await this._toggleConfigBit(threeWire, 0x10);
  }

  /**
   * This bit selects the notch frequencies for the noise rejection filter. Write 0 to this
   * bit to reject 60Hz and its harmonics; write 1 to this bit to reject 50Hz and its harmonics.
   * Note: Do not change the notch frequency while in auto conversion mode.
   * @param setTo50 True if 50Hz is to be used, false if not (default 60 Hz).
   */
  public async set50Hz(setTo50: boolean): Promise<void> {
    return await this._toggleConfigBit(setTo50, 0x01);
  }

  /**
   * Write a 1 to this bit while writing 0 to bits D5, D3, and D2 to return all fault status bits (D[7:2])
   * in the Fault Status Register to 0. Note that bit D2 in the Fault Register, and subsequently bit D0 in
   * the RTD LSB register may be set again immediately after resetting if an over/undervoltage fault persists.
   * The fault status clear bit D1, self-clears to 0.
   */
  public async clearFaultStatus(): Promise<void> {
    return await this._toggleConfigBit(true, 0x02);
  }

  /**
   * Causes the single resistance conversion to take place.
   */
  public async setOneShot(): Promise<void> {
    return await this._toggleConfigBit(true, 0x20);
  }

  /**
   * Select automatic conversion mode, in which conversions occur continuously at a 50/60Hz rate.
   * Write 0 to this bit to exit automatic conversion mode and enter the “Normally Off” mode.
   * 1-shot conversions may be initiated from this mode.
   * @param autoConvert True if auto conversion is desired, false if not.
   */
  public async setAutoConversion(autoConvert: boolean): Promise<void> {
    return await this._toggleConfigBit(autoConvert, 0x40);
  }

  /**
   * When no conversions are being performed, VBIAS may be disabled to reduce power dissipation.
   * Write 1 to this bit to enable VBIAS before beginning a single (1-Shot) conversion.
   * When automatic (continuous) conversion mode is selected, VBIAS remains on continuously.
   * @param biasOn
   */
  public async setBiasVoltage(biasOn: boolean): Promise<void> {
    return await this._toggleConfigBit(biasOn, 0x80);
  }

  private async _toggleConfigBit(predicate: boolean, bitLocation: number) {
    let readConfig = await this._readUint8(MAX31865ReadRegister.CONFIG);
    if (predicate) {
      readConfig |= bitLocation;
    } else {
      readConfig &= ~bitLocation;
    }
    await this._writeUint8(MAX31865WriteRegister.CONFIG, readConfig);
  }

  private async _delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  private async _readUint8(register: MAX31865ReadRegister): Promise<number> {
    const message = [
      {
        sendBuffer: Buffer.from([register, 0x00]),
        receiveBuffer: Buffer.alloc(2),
        byteLength: 2,
      },
    ];
    return new Promise((resolve, reject) => {
      this._device.transfer(message, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res[0].receiveBuffer[1]);
        }
      });
    });
  }

  private async _readUint16(register: MAX31865ReadRegister): Promise<number> {
    const message = [
      {
        sendBuffer: Buffer.from([register, 0x00, 0x00]),
        receiveBuffer: Buffer.alloc(3),
        byteLength: 3,
      },
    ];
    return new Promise((resolve, reject) => {
      this._device.transfer(message, (err, res) => {
        if (err) {
          reject(err);
        } else {
          const [, msb, lsb] = res[0].receiveBuffer;
          resolve((msb << 8) | lsb);
        }
      });
    });
  }

  private async _writeUint8(
    register: MAX31865WriteRegister,
    data: number
  ): Promise<void> {
    const byte = data & 0x08;
    const message = [
      {
        sendBuffer: Buffer.from([register, byte]),
        byteLength: 2,
      },
    ];
    return new Promise((resolve, reject) => {
      this._device.transfer(message, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
