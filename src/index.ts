import { Parser, ParseTree } from "./puppy-pasm"
import { PuppyParser } from "./parser"
import { Desugar } from "./desugar"
import { Language, APIs, Module, Code, Context } from "./modules"
import { site_package } from "./lib/package"
import { Generator, Environment as Compiler } from "./generator"
import { JSGenerator } from "./compiler"
import { Events, EventCallback } from './event'
import { Stopify } from "./stopify"

export { Language, Module, Parser, Compiler, Code, ParseTree, Context, APIs}

export class TransCompiler {
  generator: Generator
  parsers: Parser[] = []

  public constructor(generator?: Generator) {
    this.generator = generator ? generator : new JSGenerator()
    this.generator.setLanguage(new Language())
  }

  public install(module: Module|string, name?: string) {
    if(typeof module === 'string') {
      name = name === undefined ? module : name
      module = site_package(module)
    }
    name = name === undefined ? module.__name__ : name
    //console.log(`loading ${name} ${module.__name__}`)
    this.generator.installModule(name, module)
  }

  public addParser(parser: Parser) {
    this.parsers.push(parser)
  }

  private parse(source: string) {
    const tree = PuppyParser(source)
    if (tree.isSyntaxError()) {
      for (const p of this.parsers) {
        const pt = p(source)
        if (!pt.isSyntaxError()) {
          return pt
        }
      }
    }
    return tree
  }

  public compile(source: string) {
    var tree = this.parse(source)
    tree = Desugar.ExpressionToReturn(tree, 'TopLevelReturn')
    this.generator.init()
    return this.generator.generate(tree)
  }
}

export type JudgeData = {
  index: number
  name: string
  input: any[]
  output: any
  timeOut?: number
  status?: string
  result?: any
  elapsedTime?: number
  log?: any
}

const match = (a: any, b: any) => {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === b.length) {
      for (var i = 0; i < a.length; i++) {
        if (!match(a[i], b[i])) {
          return false
        }
      }
      return true
    }
  }
  if (typeof a === 'object' && typeof b === 'object') {
    for (const key of Object.keys(a)) {
      if (!match(a[key], b[key])) {
        return false
      }
    }
    return true
  }
  return false
}

export class PuppyPlayer {
  tc: TransCompiler
  code: Code | undefined = undefined
  context: Context | undefined;
  events: Events;

  public constructor() {
    const tc = new TransCompiler()
    tc.install('python3', '')
    this.tc = tc
    this.events = new Events()
  }

  public addEventListener(key: string, callback: EventCallback) {
    this.events.addEventListener(key, callback)
  }

  public install(module: Module|string, name?: string) {
    this.tc.install(module, name)
  }

  public load(source: string) :boolean {
    if(this.code && this.code.source === source) {
      return true;
    }
    var noErrors = true;
    this.code = this.tc.compile(source)
    this.events.dispatch('compiled', this.code);
    if(this.code.errors) {
      for(const e of this.code.errors) {
        if(e.key.endsWith('Error')) {
          noErrors = false;
        }
        this.events.dispatch('error', e);
      }
    }
    return noErrors;
  }

  public start() {
    if (this.context) {
      this.stop()
      this.context = undefined;
    }
    if (this.code) {
      this.context = this.code.newContext(this.events)
    }
    if (this.context && this.code) {
      const cx = this.context
      const main = this.code.getExecutable()
      const stopify = new Stopify(main(cx), this.events)
      this.context.addPlayer(stopify)
      this.context.start()
    }
  }

  public pause() {
    if (this.context) {
      this.context.pause()
    }
  }

  public resume() {
    if (this.context) {
      this.context.resume()
    }
  }

  public stop() {
    if (this.context) {
      this.context.stop()
      this.context = undefined;
    }
  }

  public resize(width: number, height: number) {
    // if (this.context && Context.get(this.context, 'render')) {
    //   Context.get(this.context, 'render').resize(width, height)
    // }
  }

  // judge

  public judge(d: JudgeData) {
    if (!this.code) {
      console.log('load first')
      return;
    }
    if(this.events.hasRule('judge-ending')) {
      this.events.addEventListener('judge-ending', (e)=>{
        const d = e.ref;
        d.result = e.result;
        d.elapsedTime = e.elapsedTime;
        d.status = match(d.output, d.result) ? 'AC' : 'WA';
        this.events.dispatch('puppy-judged', d);
      })
    }
    if (this.events.hasRule('judge-timeout')) {
      this.events.addEventListener('judge-timeout', (e) => {
        const d = e.ref;
        d.elapsedTime = e.elapsedTime;
        d.status = 'TLE';
        this.events.dispatch('puppy-judged', d);
      })
    }
    if (this.events.hasRule('judge-catching')) {
      this.events.addEventListener('judge-catching', (e) => {
        const d = e.ref;
        d.log = e.caughtException;
        d.status = 'RE';
        this.events.dispatch('puppy-judged', d);
      })
    }
    this.context = this.code.newContext(this.events)
    if (this.context.caughtException) {
      d.status = 'CE';
      d.log = this.context.caughtException;
      this.events.dispatch('puppy-judged', d)
      return;
    }
    if (this.context.vars[d.name]) {
      d.status = 'NE';
      this.events.dispatch('puppy-judged', d);
      return;
    }
    try {
      const startTime = Date.now();
      var result = this.context.vars[d.name](...d.input);
      if (result && result.next) {
        const stopify = new Stopify(result, this.events, d);
        stopify.setTimeOut(d.timeOut || 5000)
        stopify.setNamespace('judge')
        stopify.start()
      }
      else {
        d.elapsedTime = Date.now() - startTime
        d.result = result
        d.status = match(d.output, d.result) ? 'AC' : 'WA'
        this.events.dispatch('puppy-judged', d);
      }
    }
    catch(e) {
      d.status = 'RE';
      d.log = e;
      this.events.dispatch('puppy-judged', d);
    }
  }
}

