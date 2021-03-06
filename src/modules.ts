import { Type, Symbol } from './types'
import { ParseTree } from './parser'
import { Events } from './event';
import { syncExec } from './stopify';

export const EntryPoint = '$v';

export type APIs = ([string, string, string] | [string, string, string, any])[]

export class APIOption {

  public static VariableArguments = {
    vargType: Type.of('any')
  }

  public static VariableNumberArguments = {
    vargType: Type.of('number')
  }

  public static CodeRef = {
    coderef: true
  }

  public static hasCodeRef(symbol: Symbol) {
    return (symbol.options && symbol.options)
  }

}





const NOP = () => { }

type Player = {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export class Context {
  public vars: any = {}
  public players: Player[] = []
  public events: Events
  public codemap: ParseTree[]
  public caughtException: any

  public constructor(events: Events | undefined, codemap: ParseTree[]) {
    this.events = events || new Events()
    this.codemap = codemap
  }

  addPlayer(play: Player) {
    this.players.push(play)
  }

  public start() {
    for(const p of this.players) {
      p.start()
    }
  }

  public pause() {
    for (const p of this.players) {
      p.pause()
    }
  }

  public resume() {
    for (const p of this.players) {
      p.resume()
    }
  }

  public stop() {
    for (const p of this.players) {
      p.stop()
    }
  }

  public ffiCall(name: string, ...args: any[]) {
    if(this.vars[name]) {
      try {
        return syncExec(this.vars[name](...args));
      }
      catch(e) {
        this.events.dispatch('caught', {
          ffiCall: name,
          arguments: args,
          e: e,
        });
      }
    }
  }
}

export class Language {
  uniqueModuleId = 0
  names: string[] = []
  defaultModules: Module[] = []
  installedModules: { [key: string]: Module } = {}

  public constructor(...defs: [string, Module][]) {
    for(const def of defs) {
      const [name, module] = def
      this.installModule(name, module)
    }
  }

  public installModule(name: string, module: Module) {
    module = Object.create(module)
    module.__entryKey__ = `$${name}${this.uniqueModuleId++}`
    if (name === '') {
      this.defaultModules.push(module)
    }
    else {
      this.installedModules[name] = module
      this.names.push(name)
    }      
  }

  public initDefaultModules() {
    return Array.from(this.defaultModules)
  }

  public loadModule(name: string) {
    return this.installedModules[name]
  }

  public findModuleFromSymbol(name: string) {
    for (const pname of this.names) {
      for (const symbol of this.installedModules[pname].__symbols__) {
        if (symbol[0] === name) {
          return pname;
        }
      }
    }
    return undefined;
  }

  // module utils 

  static rewriteNameSpace = (key: string, code: string) => {
    if (code.startsWith('$$')) {
      return `${EntryPoint}.${key}.` + code.substring(2)
    }
    return code
  }

  static rewriteParamSize = (code: string, oldSize: number, newSize: number) => {
    if(code.indexOf(`{${oldSize}}`) !== -1) {
      console.log(`TODO: ${code}`)
    }
    return code
  }

  public static symbolMap = (module: Module, names?: { [key: string]: string }) => {
    const ss: { [key: string]: Symbol } = {}
    for (const symbol of module.__symbols__) {
      const name = symbol[0]
      if (names && !(name in names)) {
        continue
      }
      const type = Type.parseOf(symbol[1])
      const code = Language.rewriteNameSpace(module.__entryKey__, symbol[2])
      const key = type.isFuncType() ? `${name}@${type.paramTypes().length}` : name
      if (symbol.length === 3) {
        ss[key] = (new Symbol(type, code))
      }
      else {
        ss[key] = (new Symbol(type, code, symbol[3]))
      }
    }
    return ss
  }
}

export class Module {
  public __name__: string = ''
  __entryKey__: string = ''
  public __symbols__: APIs = []
  public __context__: Context | undefined

  public constructor(name: string, symbols: APIs) {
    this.__name__ = name;
    this.__symbols__ = symbols
  }

  __init__(cx: Context) {

  }

  __raise__(key: string, cmap: number|undefined, options : any = {}) {
    options['key'] = key
    if(this.__context__) {
      if(cmap) {
        options['source'] = this.__context__.codemap[cmap]
      }
    }
    const e: Error = new Error(key);
    (e as any)['options'] = options
    throw e;
  }
}

export type SourceEvent = {
  key: string
  source: ParseTree
}

export type Main = (cx: any) => IterableIterator<any>

export const generate = (source: string) => {
  console.log(source)
  const main = `
return function* (${EntryPoint}) {
  ${source}
}
`
  try {
    return (new Function(main))() as Main
  }
  catch (e) {
    console.log(main);
    console.log(e);
    return function*($v:any) {
      console.log(main);
      console.log(e);
    }
  }
} 

export class Code {
  public symbols: any
  public modules: Module[] = []
  public codemap: ParseTree[] = []
  public errors: SourceEvent[] = []
  public source: string=''
  public compiled: string = ''
  public main: Main | undefined = undefined

  public newContext(event?: Events) {
    const cx = new Context(event, this.codemap)
    for (var module of this.modules) {
      module = Object.create(module);
      (cx as any)[module.__entryKey__] = module;
      module.__init__(cx);
      module.__context__ = cx;
    }
    return cx
  }

  public getExecutable() {
    if (!this.main) {
      this.main = generate(this.compiled)
    }
    return this.main
  }
}

