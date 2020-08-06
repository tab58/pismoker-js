import { LatchedSwitchDevice, TimedSwitchDevice } from "./triggerSwitchDevice";

export enum TraegerState {
  Off = "off",
  Start = "start",
  Smoke = "smoke",
  Ignite = "ignite",
  Hold = "hold",
  Shutdown = "shutdown",
}

interface TraegerConfig {
  relayPins: {
    auger: number;
    fan: number;
    igniter: number;
  };
  pMode: number;
  cycleTime: number;
}

/**
 * Converts the three variable devices (fan, igniter, heater).
 */
export class TraegerHeater {
  private _relays: {
    auger: number;
    fan: number;
    igniter: number;
  };

  private _pidCycleTime: number;
  private _pMode: number;
  private _fan: LatchedSwitchDevice;
  private _igniter: LatchedSwitchDevice;
  private _auger: TimedSwitchDevice;

  constructor(config: TraegerConfig) {
    const { pMode, cycleTime, relayPins } = config;
    this._relays = relayPins;
    this._pMode = pMode;
    this._pidCycleTime = cycleTime;
    this._auger = new TimedSwitchDevice(15 * 1000, 45 * 1000);
    this._fan = new LatchedSwitchDevice(10 * 60 * 1000);
    this._igniter = new LatchedSwitchDevice(20 * 60 * 1000);
  }
}
