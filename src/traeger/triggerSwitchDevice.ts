import { EventEmitter } from "events";

/**
 * A device that toggles between states after the cycle time.
 */
export class TimedSwitchDevice extends EventEmitter {
  private _on: boolean;
  private _toggledTime: number;
  private _started: boolean;
  private _interruptInterval: number;
  private _toggleCallbackID: number | null;
  private _onCycleTime: number;
  private _offCycleTime: number;

  public get isOn(): boolean {
    return this._on;
  }

  public get onCycleTime() {
    return this._onCycleTime;
  }

  public get offCycleTime() {
    return this._offCycleTime;
  }

  constructor(
    onCycleTime: number,
    offCycleTime: number,
    loopInterval: number = 500
  ) {
    super();
    this._onCycleTime = onCycleTime;
    this._offCycleTime = offCycleTime;

    this._on = false;
    this._toggledTime = 0;
    this._toggleCallbackID = null;
    this._started = false;
    this._interruptInterval = loopInterval;
  }

  private _setToggledTime() {
    this._toggledTime = Date.now();
  }

  private _resetCallbackLoop() {
    this.stop();
    this.start();
  }

  public setOnCycleTime(time: number) {
    this._onCycleTime = time;
    this._resetCallbackLoop();
  }

  public setOffCycleTime(time: number) {
    this._offCycleTime = time;
    this._resetCallbackLoop();
  }

  public turnOn() {
    if (!this._on) {
      this._on = true;
      this.emit("on");
      this._setToggledTime();
      this._resetCallbackLoop();
    }
  }

  public turnOff() {
    if (this._on) {
      this._on = false;
      this.emit("off");
      this._setToggledTime();
      this._resetCallbackLoop();
    }
  }

  public start(stopAfterNext?: boolean) {
    if (!this._started) {
      this._started = true;
      const interruptMs = this._interruptInterval;
      const fn: TimerHandler = () => {
        if (this._on) {
          if (Date.now() - this._toggledTime > this._onCycleTime) {
            this.turnOff();
          }
        } else {
          if (Date.now() - this._toggledTime > this._offCycleTime) {
            this.turnOn();
          }
        }
        if (!!stopAfterNext) {
          this.start();
        }
      };
      this._toggleCallbackID = setTimeout(fn, interruptMs);
    }
  }

  public stop() {
    this._started = false;
    if (this._toggleCallbackID) {
      clearTimeout(this._toggleCallbackID);
    }
  }
}

export class LatchedSwitchDevice {
  private _timedDevice: TimedSwitchDevice;

  public get isOn(): boolean {
    return this._timedDevice.isOn;
  }

  public get cycleTime() {
    return this._timedDevice.onCycleTime;
  }

  constructor(cycleTime: number) {
    this._timedDevice = new TimedSwitchDevice(
      cycleTime,
      Number.POSITIVE_INFINITY
    );
  }

  public setCycleTime(ms: number) {
    this._timedDevice.setOnCycleTime(ms);
  }

  public turnOn() {
    this._timedDevice.turnOn();
  }

  public turnOff() {
    this._timedDevice.turnOff();
  }

  public start(stopAfterNext?: boolean) {
    this._timedDevice.start(stopAfterNext);
  }

  public stop() {
    this._timedDevice.stop();
  }
}
