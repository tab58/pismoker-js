import { TypeState } from "typestate";
const { FiniteStateMachine } = TypeState;
import {
  LatchedSwitchDevice,
  TimedSwitchDevice,
} from "./traeger/triggerSwitchDevice";

export enum TraegerState {
  Off = "off",
  Shutdown = "shutdown",
  Start = "start",
  Smoke = "smoke",
  Ignite = "ignite",
  Hold = "hold",
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

export class Traeger {
  private _relays: {
    auger: number;
    fan: number;
    igniter: number;
  };

  private _fsm: TypeState.FiniteStateMachine<TraegerState>;

  private _fan: LatchedSwitchDevice;
  private _igniter: LatchedSwitchDevice;
  private _auger: TimedSwitchDevice;

  private _pMode: number;
  private _pidCycleTime: number;

  constructor(config: TraegerConfig) {
    const { pMode, cycleTime } = config;
    this._relays = config.relayPins;

    this._pidCycleTime = cycleTime;
    this._auger = new TimedSwitchDevice(15 * 1000, 45 * 1000);
    this._fan = new LatchedSwitchDevice(10 * 60 * 1000);
    this._igniter = new LatchedSwitchDevice(20 * 60 * 1000);

    this._pMode = pMode;

    const fsm = new FiniteStateMachine<TraegerState>(TraegerState.Off);
    fsm.from(TraegerState.Off).to(TraegerState.Start);
    fsm.from(TraegerState.Start).to(TraegerState.Hold);
    fsm.from(TraegerState.Start).to(TraegerState.Smoke);

    this._fsm = fsm;
  }

  public setState(state: TraegerState) {}

  // public setMode(mode: TraegerState) {
  //   if (mode === TraegerState.Off) {
  //     this._initialize();
  //   } else if (mode === TraegerState.Shutdown) {
  //     this._initialize();
  //     if (this._fan.isOn) {
  //       this._fan.stop();
  //       this._fan.start(true);
  //     } else {
  //       this._fan.start(true);
  //     }
  //   } else if (mode === TraegerState.Start) {
  //     this._fan.start();
  //     this._igniter.start();

  //     this._auger.setOnCycleTime(15 * 1000);
  //     this._auger.setOffCycleTime(45 * 1000);
  //     this._auger.start();
  //   } else if (mode === TraegerState.Smoke) {
  //     this._setFan(true);
  //     this._setAuger(true);
  //     this._checkIgniter();
  //     const on = 15;
  //     const off = 45 + this._pMode * 10;
  //     this._cycleTime = on + off;
  //     this._u = on / (on + off);
  //   } else if (mode === TraegerState.Ignite) {
  //     this._setFan(true);
  //     this._setAuger(true);
  //     this._setIgniter(true);
  //     const on = 15;
  //     const off = 45 + this._pMode * 10;
  //     this._cycleTime = on + off;
  //     this._u = on / (on + off);
  //   } else if (mode === TraegerState.Hold) {
  //     this._setFan(true);
  //     this._setAuger(true);
  //     this._checkIgniter();
  //     this._cycleTime = this._pidCycleTime;
  //     this._u = this._minU;
  //   } else {
  //     throw new Error(`Invalid state for Traeger: ${mode}`);
  //   }
  // }
}
