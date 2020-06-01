import { Type, Symbol } from './types'
import { ParseTree } from './parser'
import { Stopify } from './stopify'

export const EntryPoint = '$v';

export type SymbolList = ([string, string, string] | [string, string, string, any])[]

export const VargNumber = {
  vargType: Type.parseOf('number')
}

export const VargAny = {
  vargType: Type.parseOf('any')
}

export class Context {

  public static safeSymbol(key:string) {
    return `$__${key}__`
  }

  public static set(cx: any, key: string, value: any) {
    const safekey = Context.safeSymbol(key)
    if (!cx[safekey]) {
      cx[safekey] = value
    }
    else {
      console.log(`overwritten ${key} ${value} on ${cx[safekey]}`)
    }
  }

  public static get(cx: any, key: string) {
    const safekey = Context.safeSymbol(key)
    return cx[safekey]
  }


  public static apply(cx: any, key: string, ...values: any[]) {
    const safekey = Context.safeSymbol(key)
    if (!cx[safekey]) {
      cx[safekey](...values)
    }
    else {
      console.log(`unknown ${key} on ${cx}`)
    }
  }

  // context utils

  static inRange(i: number, max: number, step: number) {
    if(step > 0) {
      return i < max;
    }
    if(step < 0) {
      return i > max;
    }
    return false;
  }

  static sync(runtime: IterableIterator<any>) {
    return new Stopify(runtime).syncExec()
  }
}

export class Language {
  uniqueModuleId = 0
  names: string[] = []
  defaultModules: Module[] = []
  installedModules: { [key: string]: Module } = {}

  public constructor(...defs: [string, Module][]) {
    for(const def of defs) {
      var [name, module] = def
      module = Object.create(module)
      module.__entryKey__ = `$${name}${this.uniqueModuleId++}`
      if(name === '') {
        this.defaultModules.push(module)
      }
      else{
        this.installedModules[name] = module
        this.names.push(name)
      }      
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
  __entryKey__: string = ''
  public __symbols__: SymbolList = []
  public __context__: any = undefined

  public constructor(symbols:SymbolList) {
    this.__symbols__ = symbols
  }

  __init__(context: any) {

  }

  __raise__(key: string, cmap: number|undefined, options : any = {}) {
    options['key'] = key
    if(this.__context__) {
      if(cmap) {
        options['source'] = Context.get(this.__context__, 'cmap')[cmap]
      }
      console.log(key, options)
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

export type Executable = (vars: any) => IterableIterator<any>

export const generate = (source: string) => {
  const main = `
return function* (${EntryPoint}) {
  ${source}
}
`
  try {
    return (new Function(main))() as Executable
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
  public compiled: string = ''
  public main: Executable | undefined = undefined

  public newContext(cx: any) {
    for (var module of this.modules) {
      module = Object.create(module)
      cx[module.__entryKey__] = module
      module.__context__ = cx
      module.__init__(cx)
    }
    Context.set(cx, 'codemap', this.codemap)
    Context.set(cx, 'sync', Context.sync)
    Context.set(cx, 'inRange', Context.inRange)
    return cx
  }

  public getExecutable() {
    if (!this.main) {
      this.main = generate(this.compiled)
    }
    return this.main
  }

}

