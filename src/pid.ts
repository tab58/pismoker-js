const clamp = (v: number, min: number, max: number): number => {
  return Math.min(Math.max(v, min), max);
};

export class PIDController {
  private _Kp: number;
  private _Ki: number;
  private _Kd: number;

  private _lastTime: number;
  private _sumT: number;
  private _tempSetPoint: number;
  private _maxIntegrator: number;

  /**
   * Constructs a PID controller.
   * @param pb The proportional band of the controller.
   * @param ti The time desired to compensate for the sum of all errors.
   * @param td The number of seconds in the future desired to predict the error value
   */
  constructor(pb: number, ti: number, td: number) {
    this._Kp = -1.0 / pb;
    this._Ki = this._Kp / ti;
    this._Kd = this._Kp * td;

    this._maxIntegrator = Math.abs(0.5 / this._Ki);
    this._lastTime = 0;
    this._tempSetPoint = 0;
    this._sumT = 0;
  }

  public setDesiredTemp(T: number) {
    this._tempSetPoint = T;
    this._lastTime = 0;
    this._sumT = 0;
  }

  private _calculateIntegratorResponse(error: number, dt: number): number {
    const maxI = this._maxIntegrator;
    const dI = error * dt;
    const I = clamp(this._sumT + dI, -maxI, maxI);

    // update state
    this._sumT = I;

    return this._Ki * I;
  }

  private _calculateDerivativeResponse(error: number, dt: number): number {
    // derivative
    const dT = error / dt;
    return this._Kd * dT;
  }

  private _calculateProportionalResponse(error: number): number {
    return this._Kp * error + 0.5;
  }

  public getControllerResponse(
    T: number,
    cb?: (data: { [key: string]: number }) => void
  ): number {
    const currentTime = Date.now();
    const dt = currentTime - this._lastTime;
    const error = T - this._tempSetPoint;

    const P = this._calculateProportionalResponse(error);
    const I = this._calculateIntegratorResponse(error, dt);
    const D = this._calculateDerivativeResponse(error, dt);
    const u = P + I + D;

    // update state
    this._lastTime = currentTime;

    if (cb) {
      cb({
        error,
        target: this._tempSetPoint,
        current: T,
        P,
        I,
        D,
      });
    }
    return u;
  }
}
