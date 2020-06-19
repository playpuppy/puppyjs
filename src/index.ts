import { Parser, ParseTree } from "./puppy-pasm"
import { PuppyParser } from "./parser"
import { Desugar } from "./desugar"
import { Language, APIs, Module, Code, Context } from "./modules"
import { site_package } from "./lib/package"
import { Generator, Environment as Compiler } from "./generator"
import { JSGenerator } from "./compiler"
import { EventSubscription, EventCallback } from './event'
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

export class PuppyPlayer {
  tc: TransCompiler
  code: Code | undefined = undefined
  context: Context | undefined;
  events: EventSubscription;

  public constructor() {
    const tc = new TransCompiler()
    tc.install('python3', '')
    this.tc = tc
    this.events = new EventSubscription()
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
  
}
