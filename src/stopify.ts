import { EventSubscription } from './event'

const HelloWorld = function*(vars: any) {
  console.log('Hello')
  yield 100;
  console.log('World')
  yield 100;
}

export class Stopify {

  private runtimeStack: IterableIterator<any>[];
  private cps: any = null
  private retval: any = undefined
  private paused = false
  private autoPause = false
  private timeScale = 1.0
  private timeOut = 0
  private events: EventSubscription | undefined
  private options: any

  public constructor(runtime: IterableIterator<any>, events?: EventSubscription, options?: any) {
    this.runtimeStack = [runtime]
    this.events = events
    this.options = options
  }

  public syncExec() {
    while (this.runtimeStack.length > 0) {
      const runtime = this.runtimeStack[this.runtimeStack.length - 1];
      const res = runtime.next(this.retval);
      if (res.done) {
        this.retval = res.value;
        this.runtimeStack.pop(); // FIXME
      }
      else {
        this.retval = undefined;
        var newRuntime = res.value;
        if (!(typeof newRuntime === 'number')) {
          this.runtimeStack.push(newRuntime());
        }
      }
    }
    return this.retval;
  }

  public setAutoPause(autoPause: boolean) {
    this.autoPause = autoPause
  }

  public setTimeOut(timeOut = 5000) {
    this.timeOut = timeOut;
  }

  public setTimeScale(timeScale = 1.0) {
    this.timeScale = timeScale;
  }

  public start() {
    if(!this.cps) {
      clearTimeout(this.cps);
      this.cps = undefined;
    }
    //this.runtimeStack = [runtime];
    this.paused = false;
    if(this.timeOut > 100) {
      setTimeout(() => { this.timeOut = -1 }, this.timeOut);
    }
    this.stepExec();
  }

  stepExec() {
    if (this.runtimeStack.length === 0) {
      if(this.events) {
        this.events.dispatch('ending', { result: this.retval, options: this.options})
      }
      return
    }
    if (this.paused === true) {
      this.cps = setTimeout(() => { this.stepExec() }, 100);
      return;
    }
    const runtime = this.runtimeStack[this.runtimeStack.length - 1];
    var time = 0;
    var res = runtime.next(this.retval);
    if (this.autoPause) {
      this.pause();
    }
    // console.log(res)
    if (res.done) {
      this.retval = res.value;
      this.runtimeStack.pop(); // FIXME
      //console.log(`returing ${this.retval}`);
      if (this.runtimeStack.length === 0) {
        if (this.events) {
          this.events.dispatch('ending', { result: this.retval, options: this.options })
        }
        return
      }
    }
    else {
      this.retval = undefined;
      //console.log(`yielding ${v}`);
      if (typeof res.value === 'number') {
        time = res.value % 1000;
        if (time !== 0 && this.events) {
          this.events.dispatch('lineTrack', res.value / 1000)
        }
      }
      else {
        var newRuntime = res.value;
        this.runtimeStack.push(newRuntime());
      }
    }
    if(this.timeOut !== -1) {
      //console.log(`time ${time}`)
      this.cps = setTimeout(() => (this.stepExec()), time * this.timeScale);
    }
    else {
      if (this.events) {
        this.events.dispatch('timeOut', { options: this.options })
      }
    }
  }

  public pause() {
    this.paused = true;
  }

  public resume() {
    if(this.paused === true) {
      this.paused = false
      this.stepExec()
    }
  }

  public stop() {
    if (!this.cps) {
      this.runtimeStack = []
      clearTimeout(this.cps)
      this.cps = null
    }
  }
}

