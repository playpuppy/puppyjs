import { ParseTree } from './parser';
import { Type, TypeEnv, TypeEnvSolver, Symbol } from './types';
import { Code, Language, Module } from './modules';
import { stringfy, isInfix } from './utils';

const AnyType = Type.of('any')

export abstract class Generator {
  protected code: Code
  protected lang: Language | undefined = undefined

  constructor(parent?: Generator) {
    if (parent) {
      this.code = parent.code
      this.lang = parent.lang
    }
    else {
      this.code = new Code()
    }
  }

  public setLanguage(lang: Language) {
    this.lang = lang
  }

  public installModule(name: string, module: Module) {
    this.lang?.installModule(name, module)
  }

  public init() {
    this.code = new Code()
    if(this.lang) {
      this.code.modules = this.lang.initDefaultModules()
      for (const module of this.code.modules) {
        for (const s of module.__symbols__) {
          const [key, type, code, options] = s
          this.define(key, type, Language.rewriteNameSpace(module.__entryKey__, code), options)
        }
      }
    }
  }

  protected loadModule(name: string) {
    if (this.lang) {
      const module = this.lang.loadModule(name)
      if (module) {
        this.code.modules.push(module)
        return module;
      }
    }
  }

  protected abstract visit(pt: ParseTree): Type
  public abstract generate(pt: ParseTree): Code
  public abstract define(key: string, type: string, code: string, option?: any): Symbol;
}

abstract class CodeWriter extends Generator {
  protected buffers: string[]
  protected indentLevel: number

  constructor(parent?: CodeWriter) {
    super(parent)
    if (parent) {
      this.indentLevel = parent.indentLevel
    }
    else {
      this.indentLevel = 0
    }
    this.buffers = []
  }

  public init() {
    super.init()
    this.buffers = []
    this.indentLevel = 0
  }

  //protected abstract visit(pt: ParseTree): Type

  protected abstract getSymbol(key: string): Symbol | undefined

  /* buffer */

  protected push(c: string | string[]) {
    if (Array.isArray(c)) {
      this.buffers = this.buffers.concat(c)
    }
    else {
      this.buffers.push(c)
    }
  }

  protected pushLF() {
    if (this.buffers.length === 0 || !this.buffers[this.buffers.length - 1].endsWith('\n')) {
      this.buffers.push('\n')
    }
  }

  protected pushSP() {
    if (this.buffers.length === 0 || !this.buffers[this.buffers.length - 1].endsWith(' ')) {
      this.buffers.push(' ')
    }
  }

  protected pushEOS() {
    if (this.buffers.length !== 0) {
      const tail = this.buffers[this.buffers.length - 1];
      if (tail.endsWith(';') || tail.endsWith('}') || tail.endsWith('\n')) {
        return;
      }
      this.pushS(';')
    }
  }

  protected token(key: string) {
    const symbol = this.getSymbol(key);
    return (symbol) ? symbol.format() : key
  }

  protected pushS(key: string) {
    this.push(this.token(key))
  }

  protected pushP(open: string, cs: string[] | string[][] | ParseTree[], close: string) {
    const delim = this.token(', ')
    this.pushS(open)
    for (var i = 0; i < cs.length; i += 1) {
      if (i > 0) this.push(delim)
      if (cs[i] instanceof ParseTree) {
        this.visit(cs[i] as ParseTree)
      }
      else {
        this.push(cs[i] as string)
      }
    }
    this.pushS(close)
  }

  protected pushIndent(msg='') {
    this.pushLF()
    if (this.indentLevel > 0) {
      const tab = this.token('\t')
      this.push(tab.repeat(this.indentLevel))
    }
    if(msg !== '') {
      this.push(msg)
    }
  }

  protected incIndent() {
    this.indentLevel += 1
  }

  protected decIndent() {
    this.indentLevel -=1
  }

  public generate(pt: ParseTree): Code {
    this.buffers = []
    this.visit(pt)
    this.code.compiled = this.rewrite(stringfy(this.buffers))
    return this.code
  }

  protected rewrite(source: string) {
    return source
  }
}

const DefaultMethodMap: { [key: string]: string } = {
  'Name': 'acceptVar',
  'TrueExpr': 'acceptTrue',
  'FalseExpr': 'acceptFalse',
  'IndexExpr': 'acceptIndex',
  'GetExpr': 'acceptField',
  'SelfAssign': 'SelfAssignment',
  'If': 'acceptIfStmt',
  'While': 'acceptWhileStmt',
  'For': 'acceptForStmt',
}

export class FunctionContext {
  isGlobalMain: boolean
  name: string
  params: string[] = []
  paramTypes: Type[] = []
  locals: string[] = []
  foundAsync = false
  returnType: Type
  hasReturnValue = false
  // type: Type
  loopLevel = 0
  constructor(name: string, paramTypes: Type[] = [], returnType: Type, isGlobalMain = false) {
    this.name = name
    this.paramTypes = paramTypes
    this.returnType = returnType
    this.isGlobalMain = isGlobalMain
  }

  declName(name: string) {
    if(!name.startsWith('$') && !(name in this.locals)) {
      this.locals.push(name)
    }
  }

  definedFuncType() {
    const ptype = Type.newTupleType(...this.paramTypes)
    return Type.newFuncType(ptype, this.returnType)
  }

  definedSymbol(name: string, checkVoid: boolean, options?: any) {
    if (checkVoid && !this.hasReturnValue) {
      this.returnType = Type.of('void')
    }
    if(options) {
      return new Symbol(this.definedFuncType(), name, options)
    }
    if(this.foundAsync) {
      return new Symbol(this.definedFuncType(), name, Symbol.Async)
    }
    return new Symbol(this.definedFuncType(), name)
  }

}

export class Environment extends CodeWriter implements TypeEnvSolver {
  parent: Environment | undefined
  env: { [key: string]: Symbol } = {}
  funcBase: FunctionContext

  typeEnv: TypeEnv

  constructor(parent?: Environment) {
    super(parent)
    this.parent = parent
    if (parent) {
      this.funcBase = parent.funcBase
      this.typeEnv = parent.typeEnv
    }
    else {
      this.funcBase = new FunctionContext('main', [], AnyType, true)
      this.typeEnv = new TypeEnv()
    }
  }

  public init() {
    this.env = {}
    super.init()
    this.funcBase = new FunctionContext('main', [], AnyType, true)
    this.typeEnv = new TypeEnv()
  }

  protected getRoot() :Environment {
    return this.parent === undefined ? this : this.parent.getRoot()
  }

  protected getAcceptMethod(pt: ParseTree): string {
    var tag = pt.getTag();
    const method = DefaultMethodMap[tag];
    if (!method) {
      const newmethod = `accept${tag}`;
      DefaultMethodMap[tag] = newmethod;
      return newmethod;
    }
    return method;
  }

  protected visit(pt: ParseTree): Type {
    const method = this.getAcceptMethod(pt);
    if (method in this) {
      const ty = (this as any)[method](pt);
      return ty;
    }
    return this.undefinedParseTree(pt);
  }

  undefinedParseTree(pt: ParseTree) {
    this.push(`${pt}`)
    return this.untyped();
  }

  public getSymbol(key: string): Symbol | undefined {
    var cur: Environment | undefined = this
    while (cur) {
      const symbol = cur.env[key];
      if (symbol) {
        return symbol;
      }
      cur = cur.parent;
    }
    return undefined;
  }

  public hasSymbol(key: string) {
    return this.getSymbol(key) !== undefined
  }

  public setSymbol(key: string, symbol: Symbol) {
    //console.log(`setSymbol ${key}, ${symbol.code}`)
    this.env[key] = symbol;
    return symbol;
  }

  public define(key: string, type: Type | string, code?: string, options?: any) {
    if (typeof type === 'string') {
      type = Type.parseOf(type)
    }
    const symbol = new Symbol(type, code, options)
    if (type.isFuncType()) {
      // var a = code!.indexOf('{');
      // console.log(`type ${key} ${type} ${a}`)
      if (code && code.indexOf('{') === -1) {
        this.setSymbol(key, symbol)
      }
      key = `${key}@${type.paramTypes().length}`
    }
    return this.setSymbol(key, symbol)
  }

  public testModule(modules: any[]) {
    for (const mod of modules) {
      const name = mod[0]
      const ty = Type.parseOf(mod[1])
      const code = mod[2]
      const options = mod[3]
      const symbol = new Symbol(ty, code, options)
      if (ty.isFuncType()) {
        const key = `${name}@${ty.paramTypes().length}`
        this.setSymbol(key, symbol)
      }
      else {
        this.setSymbol(name, symbol)
      }
    }
  }

  protected inGlobal() {
    return this.funcBase.isGlobalMain
  }

  protected inLocal() {
    return !this.funcBase.isGlobalMain
  }

  protected inLoop() {
    return this.funcBase.loopLevel > 0
  }

  /* typeEnv */

  getTypeEnv(): TypeEnv {
    return this.typeEnv;
  }

  protected pushTypeEnv(funcType: Type) {
    if(funcType.tid.indexOf('$') >= 0) {
      console.log(`DEBUG: ${funcType}`)
      this.typeEnv = new TypeEnv(this.typeEnv);
    }
  }

  protected popTypeEnv(funcType: Type) {
    if (funcType.tid.indexOf('$') >= 0) {
      this.typeEnv = this.typeEnv.pop();
    }
  }

  protected newVarType(pt: ParseTree) : Type {
    return this.typeEnv.newVarType(pt.getToken(), this);
  }

  public typeCheck(pt: ParseTree, pat?: Type, options?: any): [string[], Type] {
    if (pat && pat.isBoolType()) {
      // if (t.tag === 'Infix' && t.tokenize('name') === '=') {
      //   this.pwarn(t, 'BadAssign');
      //   t.tag = 'Eq';
      // }
    }
    const buffers = this.buffers;
    this.buffers = []
    const vat = this.visit(pt)
    const code = this.buffers;
    this.buffers = buffers;
    if (pat) {
      const matched = pat.match(vat);
      if (matched === null) {
        if(!vat.isUntypedType()) {
          options = options || {}
          options.requestType = pat
          options.resultType = vat
          this.perror(pt, 'TypeError', options);
          console.log(`type error ${pat} ${vat.tid} @ ${code}`)
        }
        return [code, pat];
      }

      return [code, matched.resolved()];
    }
    return [code, vat];
  }

  typeCoercion(pat: Type, code: string[], vat: Type, pt: ParseTree) {
      if(pat.isNumberType() && !vat.isNumberType() && this.hasSymbol('check-number')) {
        const symbol = this.getSymbol('check-number')!
        return [[symbol.format([code.join(''), this.codeRef(pt)])], symbol.type];
      }
      return [code, pat]
  }

  codeRef(pt: ParseTree) {
    const coderef = this.code.codemap.length;
    this.code.codemap.push(pt);
    return `${coderef}`
  }

  private prevRow = -1;

  protected pushT(pt: ParseTree, ty?: Type, infix = false) {
    const [cs, ty2] = this.typeCheck(pt, ty)
    if (infix && isInfix(pt)) {
      this.pushP('(', [cs], ')')
    }
    else {
      this.push(cs)
    }
    return ty2
  }

  // error, handling
  public perror(pt: ParseTree, key: string, options?: any) {
    const e = { key: key, source: pt };
    if (options) {
      Object.assign(e, options);
    }
    this.code.errors.push(e);
    //console.log(e);
  }

  untyped(): Type {
    return AnyType
  }

  public testHasError(key: string) {
    for (const e of this.code.errors) {
      if (e.key.startsWith(key)) {
        return true
      }
    }
    return false
  }

  public rewrite(source: string) {
    if (this.funcBase.locals.length > 0) {
      const decls = this.token('var') + ' ' + this.funcBase.locals.join(',') +';'
      return source.replace('//@names', decls)
    }
    return source
  }

  public stringfy(pt?: ParseTree): string {
    const buffers = this.buffers
    if(pt) {
      this.buffers = []
      this.visit(pt)
    }
    const cs = this.buffers
    this.buffers = buffers
    return this.rewrite(stringfy(cs))
  }


}

