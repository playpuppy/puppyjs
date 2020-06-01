import { ParseTree, PuppyParser } from './parser';
import { Type, Symbol } from './types';
import { Module, EntryPoint, Language} from './modules';
import { Environment, FunctionContext } from './generator'
import { quote, normalToken, stringfy, isInfix } from './utils';

const VoidType = Type.of('void')
const BoolType = Type.of('bool')
const IntType = Type.of('int')
const FloatType = Type.of('float')
const StrType = Type.of('str')
const ObjectType = Type.of('object')
const AnyType = Type.of('any')
const InInfix = true
const Async = { isAsync: true }

export class JSGenerator extends Environment {
  constructor(parent?: Environment) {
    super(parent)
  }

  protected newEnv() {
    return new JSGenerator(this)
  }

  acceptTrue(pt: ParseTree) {
    this.pushS('true')
    return BoolType
  }

  acceptFalse(pt: ParseTree) {
    this.pushS('false')
    return BoolType
  }

  acceptInt(pt: ParseTree) {
    this.push(pt.getToken())
    return IntType
  }

  acceptFloat(pt: ParseTree) {
    this.push(pt.getToken())
    return FloatType
  }

  acceptDouble(pt: ParseTree) {
    this.push(pt.getToken())
    return FloatType
  }

  acceptQString(pt: ParseTree) {
    this.push(pt.getToken())
    return StrType
  }

  acceptMultiString(pt: ParseTree) {
    this.push(JSON.stringify(JSON.parse(pt.getToken())))
    return StrType
  }

  acceptFormat(pt: ParseTree) {
    const cs: string[][] = []
    for (const e of pt.subNodes()) {
      if (e.is('StringPart')) {
        cs.push([quote(e.getToken())])
      }
      else {
        const [code, type] = this.typeCheck(e)
        cs.push(code)
      }
    }
    this.pushS('strcat')
    this.pushP('(', cs, ')')
    return StrType
  }

  acceptList(pt: ParseTree) {
    var type: Type = this.newVarType(pt);
    const cs: string[][] = []
    for (const e of pt.subNodes()) {
      const [code, type2] = this.typeCheck(e, type)
      type = type2
      cs.push(code)
    }
    this.pushP('[', cs, ']')
    return Type.newParamType('list', type);
  }

  /* symbol */

  safeName(name: string) {
    if (this.inGlobal() && !this.inLocal()) {
      return this.safeGlobalName(name)
    }
    return this.safeLocalName(name)
  }

  safeGlobalName(name: string) {
    const global = this.getSymbol('$')
    if (global) {
      return global.format([name]);
    }
    return this.safeLocalName(name)
  }

  safeLocalName(name: string) {
    return name.replace('*', '')
  }

  checkSymbol(pt: ParseTree, declTy?: Type, isParam = false): Symbol {
    if(pt.is('Name') || pt.is('Var') || pt.is('Variable')) {
      const name = pt.getToken()
      const symbol = this.getSymbol(name)
      if (symbol) {
        return symbol;
      }
      if (declTy) {
        const safename = this.safeName(name)
        if (!isParam) {
          this.funcBase.declName(safename)
        }
        return this.setSymbol(name, new Symbol(declTy, safename))
      }
      else {
        const globalName = this.safeGlobalName(name)
        declTy = this.newVarType(pt)
        this.getRoot().funcBase.declName(globalName);
        return this.getRoot().setSymbol(name,
          new Symbol(declTy, globalName, { error: 'UndefinedName', 'source': pt }))
      }
    }
    else {
      // Index a[0] or Field a.x
      const [cs, ty] = this.typeCheck(pt);
      return new Symbol(ty, stringfy(cs))
    }
  }

  checkSymbols(pt: ParseTree, rightTy: Type): Symbol[] {
    //console.log(`checkSymbols ${pt}`)
    const nodeSize = pt.getNodeSize()
    if (nodeSize === 0) {
      return [this.checkSymbol(pt, rightTy)]
    }
    const nodes = pt.subNodes();
    if (nodes.length === 1) {
      return [this.checkSymbol(nodes[0], rightTy)]
    }
    const ss: Symbol[] = []
    for (const n of nodes) {
      ss.push(this.checkSymbol(n, rightTy))
    }
    return ss;
  }

  pushSymbol(symbol: Symbol) {
    this.push(symbol.code)
  }

  pushSymbols(symbols: Symbol[]) {
    if (symbols.length === 1) {
      this.pushSymbol(symbols[0])
    }
    else {
      this.pushP('[', symbols.map(s => s.code), ']')
    }
  }

  pushLet(symbol: Symbol | Symbol[]) {
    if(symbol instanceof Symbol) {
      this.pushSymbol(symbol)
    }
    else {
      this.pushSymbols(symbol as Symbol[])
    }
    this.pushSP()
    this.push('=')
    this.pushSP()
  }

  acceptVar(pt: ParseTree) {
    const symbol = this.checkSymbol(pt)
    this.pushSymbol(symbol)
    return symbol.type
  }

  acceptVarDecl(pt: ParseTree) {
    const [right, rightType] = this.typeCheck(pt.get('right'), this.newVarType(pt.get('left')));
    const symbol = this.checkSymbol(pt.get('left'), rightType)
    this.pushLet(symbol)
    this.push(right)
      // if (this.autoPuppyMode && symbol1.isGlobal()) {
      //   out.push(`;puppy.v('${name}')`);
      // }
    return VoidType
  }

  acceptMultiAssignment(pt: ParseTree) {
    const [right, rightTy] = this.typeCheck(pt.get('right'))
    const symbols = this.checkSymbols(pt.get('left'), rightTy)
    this.pushLet(symbols)
    this.push(right)
    return VoidType
  }

  acceptTuple(pt: ParseTree) {
    const types: Type[] = []
    const cs: string[][] = []
    for (const e of pt.subNodes()) {
      const [code, type] = this.typeCheck(e)
      cs.push(code)
      types.push(type)
    }
    if (cs.length == 1) {
      this.pushP('(', [cs[0]], ')')
      return types[0];
    }
    this.pushP('[', cs, ']')
    return Type.newTupleType(...types)
  }

  /* Operator */

  pushOp(op: string) {
    this.pushSP()
    this.pushS(op)
    this.pushSP()
  }

  acceptAnd(pt: ParseTree) {
    this.pushT(pt.get2(0, 'left'), BoolType, InInfix)
    this.pushOp('&&')
    this.pushT(pt.get2(1, 'right'), BoolType, InInfix)
    return BoolType
  }

  acceptOr(pt: ParseTree) {
    this.pushT(pt.get2(0, 'left'), BoolType, InInfix)
    this.pushOp('||')
    this.pushT(pt.get2(1, 'right'), BoolType, InInfix)
    return BoolType
  }

  acceptNot(pt: ParseTree) {
    this.pushS('!')
    this.pushT(pt.get2(0, 'expr'), BoolType, InInfix)
    return BoolType
  }

  readonly CMPR = ['==', '!=', '<', '<=', '>', '>='];

  isComparator(pt: ParseTree) {
    if(pt.is('Infix')) {
      const op = normalToken(pt.getToken('op,name'))
      return this.CMPR.indexOf(op) !== -1
    }
    return false;
  }

  desugarTrinaryComparator(pt: ParseTree) {
      // (a < b) < c => a < b and b < c
    const left = pt.get('left')
    const right = new ParseTree('Infix')
    right.set('left', left.get('right'))
    right.set('op', left.get('op,name'))
    right.set('right', pt.get('right'))
    const and = new ParseTree('And')
    and.append(left)
    and.append(right)
    return and
  }

  acceptInfix(pt: ParseTree) {
    if(this.isComparator(pt) && this.isComparator(pt.get('left'))) {
      // (a < b) < c => a < b and b < c
      return this.pushT(this.desugarTrinaryComparator(pt))
    }
    const op = normalToken(pt.getToken('op,name'))
    const symbol = this.getSymbol(`${op}@2`)
    if (symbol) {
      const params = [pt.get('left'), pt.get('right')]
      return this.emitSymbolExpr(pt, symbol, params)
    }
    this.pushT(pt.get('left'), AnyType, InInfix)
    this.pushOp(op)
    this.pushT(pt.get('right'), AnyType, InInfix)
    return this.untyped();
  }

  acceptUnary(pt: ParseTree) {
    const op = normalToken(pt.getToken('op,name'))
    const symbol = this.getSymbol(`${op}@1`)
    if (symbol) {
      const params = [pt.get('expr')]
      return this.emitSymbolExpr(pt, symbol, params)
    }
    this.push(op)
    return this.pushT(pt.get2(0, 'expr'), AnyType, InInfix)
  }

  /* apply */

  splitArguments(pt: ParseTree): [ParseTree[], ParseTree|undefined] {
    const params = pt.subNodes()
    if(params.length > 0) {
      const option = params[params.length-1]
      if (option.is('Data') || option.is('ListArgument')) {
        const p: ParseTree[] = []
        for(var i=0; i < params.length-1; i+=1) {
          p.push(params[i])
        }
        return [p, option]
      }
    }
    return [params, undefined];
  }

  pushArguments(params: ParseTree[], options: ParseTree | undefined) {
    this.pushP('(', params, '')
    if (options) {
      if (params.length > 0) {
        this.pushS(',')
      }
      this.pushT(options)
    }
    this.push(')')
  }

  findSymbol(name: ParseTree, paramSize: number) {
    const keyname = name.getToken()
    const key = `${keyname}@${paramSize}`
    var symbol = this.getSymbol(key)
    //console.log(`finding symbol ${key} ${symbol}`)
    if(symbol) {
      return symbol;
    }
    for (var i = paramSize-1; i >= 0; i -= 1) {
      const key2 = `${keyname}@${i}`
      symbol = this.getSymbol(key2)
      if (symbol && symbol.options && symbol.options.vargType) {
        const vargType = symbol.options.vargType
        var p = symbol.type.paramTypes()
        for(var j = i; j < paramSize; j++) {
          p = p.concat([vargType])
        }
        const retType = Type.newFuncType(Type.newTupleType(...p), 
          symbol.type.getReturnType())
        symbol = this.setSymbol(key, new Symbol(retType, 
          Language.rewriteParamSize(symbol.code, i-1, paramSize-1)))
        //console.log(`generating symbol ${key} ${symbol.code}:: ${symbol.type}`)
        return symbol;
      }
    }
    if (this.lang) {
      const moduleName = this.lang.findModuleFromSymbol(key)
      if (moduleName) {
        this.importAutoModule(moduleName, { keyname })
        symbol = this.getSymbol(key)
        if (symbol) {
          this.perror(name, 'AutomatedImport', { 'module': moduleName })
        }
        console.log(symbol)
        return symbol
      }
    }
    return symbol;
  }

  acceptApplyExpr(pt: ParseTree): Type {
    const name = pt.getToken('name')
    const [params, options] = this.splitArguments(pt.get('params'))
    const symbol = this.findSymbol(pt.get('name'), params.length)
    if (symbol) {
      return this.emitSymbolExpr(pt, symbol, params, options)
    }
    // symbol = this.getSymbol(name);
    // if (symbol) {
    //   if (symbol.type.isFuncType() && symbol.type.paramTypes().length === params.length) {
    //     return this.emitSymbolExpr(pt, symbol, params, options)
    //   }
    // }
    this.push(name)
    this.pushArguments(params, options)
    return this.untyped()
  }

  acceptMethodExpr(pt: ParseTree) {
    const name = pt.getToken('name')
    const recv = pt.get('recv')
    const [params, options] = this.splitArguments(pt.get('params'))
    const mkey = `${name}@${params.length}`;
    const msymbol = this.getModuleSymbol(recv.getToken(), mkey, pt.get('name'))
    if(msymbol) {
      return this.emitSymbolExpr(pt, msymbol, params, options);
    }
    const key = `.${name}@${params.length+1}`;
    const symbol = this.getSymbol(key);
    //console.log(`${pt} ${name} ${key} ${symbol}`)
    if (symbol) {
      //params.unshift(recv);  // recvを先頭に追加する
      return this.emitSymbolExpr(pt, symbol, [recv].concat(params), options);
    }
    this.visit(recv)
    this.push('.')
    this.push(name)
    this.pushArguments(params, options);
    return this.untyped()
  }

  emitSymbolExpr(pt: ParseTree, symbol: Symbol, params: ParseTree[], options?:ParseTree): Type {
    const paramTypes: Type[] = symbol.type.paramTypes()
    const retType = symbol.type.getReturnType()
    const InInfix = '+-*%<>=&|~@!?^'.indexOf(symbol.code[0]) !== -1
    //console.log(`infix ${InInfix} ${symbol.code}`)
    var yieldFlag=false
    if(symbol.options && symbol.options.isAsync === true) {
      if (this.hasSymbol('yield-async')) {
        this.funcBase.foundAsync = true
        this.push('(yield ()=>')
        yieldFlag = true
      }
    }
    const cs: string[] = []
    const tenv = this.newTypeEnv();
    for (var i = 0; i < params.length; i++) {
      const [e,] = this.typeCheck(params[i], paramTypes[i], tenv)
      if(InInfix && isInfix(params[i])) {
        cs.push(`(${stringfy(e)})`)
      }
      else {
        cs.push(stringfy(e))
      }
    }
    var code = symbol.format(cs)
    if(options && code.endsWith(')')) {
      this.push(code.substring(0, code.length-1))
      if(params.length > 0) {
        this.pushS(',')
      }
      this.pushT(options)
      this.pushS(')')
    }
    else {
      this.push(code)
    }
    if (yieldFlag) {
      this.push(')')
    }
    return retType.resolved(tenv);
  }

  acceptDataArgument(pt: ParseTree) {
    return this.visit(pt.get2(0, 'expr'))
  }

  acceptListArgument(pt: ParseTree) {
    this.pushS('...')
    return this.visit(pt.get2(0, 'expr'))
  }

  acceptData(pt: ParseTree) {
    const delim = this.token(',')
    var c = 0
    this.pushS('{')
    for (const e of pt.subNodes()) {
      const key = e.getToken('key,name');
      if(c > 0) {
        this.push(delim)
      }
      if(key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
        this.push(key)
      }
      else {
        this.push(quote(key))
      }
      this.pushS(':')
      this.pushSP()
      this.visit(e.get('value'))
      c += 1
    }
    this.pushS('}')
    return ObjectType
  }

  /* expression */

  acceptExpression(pt: ParseTree) {
    return this.visit(pt.get2(0, 'expr'));
  }

  /* assignment */

  acceptAssignment(pt: ParseTree) {
    this.visit(pt.get('left,name'))
    this.pushSP()
    this.pushS('=')
    this.pushSP()
    this.visit(pt.get('right,expr'))
  }

  //"[#SelfAssign left=[#Name 'a'] name=[# '+='] right=[#Int '1']]"
  acceptSelfAssignment(pt: ParseTree) {
    const left = pt.get('left')
    const infix = new ParseTree('Infix', pt.inputs_, pt.spos_, pt.epos_, pt.urn_);
    infix.set('left', left)
    infix.set('op', pt.get('name,op').trim(0,-1))
    infix.set('right', pt.get('right'))
    const assign = new ParseTree('Assignment', pt.inputs_, pt.spos_, pt.epos_, pt.urn_)
    assign.set('left', left)
    assign.set('right', infix)
    return this.visit(assign)
  }

  sourceMap(pt: ParseTree) {
    return '0'
  }

  intValue(pt: ParseTree): number | undefined {
    if (pt.is('Int')) {
      return Number.parseInt(pt.getToken())
    }
    if (pt.is('Minus')) {
      const n = this.intValue(pt.get2(0, 'expr'))
      if (n) {
        return -n;
      }
    }
    return undefined;
  }

  fieldType(baseTy: Type, name: string): Type {
    const symbol = this.getSymbol(`#${name}`)
    if (symbol) {
      return symbol.type
    }
    const symbol2 = this.getSymbol(name)
    if (symbol2) {
      return symbol2.type
    }
    return AnyType
  }

  guessType(name: string, type: Type) {
    const key = `#${name}`
    const symbol = this.getSymbol(key)
    if (!symbol) {
      return this.setSymbol(key, new Symbol(type, name))
    }
  }

  elementType(ty: Type, index?: number) {
    if (ty.isStringType()) {
      return StrType
    }
    if (ty.is('list')) {
      return ty.getParameterType(0)
    }
    return AnyType
  }

  /* index */

  acceptIndex(pt: ParseTree) {
    const [base, baseTy] = this.typeCheck(pt.get('recv'))
    const [index, indexTy] = this.typeCheck(pt.get('index'))
    if (this.hasSymbol('check-index') && !this.hasSymbol('fast-index')) {
      const check_index = this.token('check-index')
      this.push(base)
      this.pushP(`[${check_index}(`, [base, index, [this.sourceMap(pt)]], ')]')
    }
    else {
      this.push(base)
      this.pushP('[', [index], ']')
    }
    return this.elementType(baseTy, this.intValue(pt.get('index')))
  }

  /* field */

  acceptField(pt: ParseTree) {
    const name = pt.getToken('name');
    const [base, baseTy] = this.typeCheck(pt.get('recv'), ObjectType);
    if (this.hasSymbol('check-field')) {
      const check_index = this.token('check-field')
      this.push(base)
      this.pushP(`[${check_index}(`, [base, [`'${name}'`], [this.sourceMap(pt)]], ')]')
    }
    else {
      this.push(base)
      this.push(`.${name}`)
    }
    return this.fieldType(baseTy, name);
  }

  pushYield(pt: ParseTree) {
    if (this.inGlobal() && this.hasSymbol('yield-time')) {
      const pos = pt.getPosition()
      const rowTime = pos.row * 1000 + 100
      this.pushIndent()
      this.push(`yield ${rowTime}`)
      return;
    }
    if(this.hasSymbol('yield-async') && pt.is('WhileStmt')) {
      this.pushIndent()
      this.push(`if (Math.random() < 0.01) yield 0`)
    }
  }

  /* statements */

  makeBlock(pt: ParseTree, parent?: ParseTree) {
    if (pt.is('Else')) {
      pt = pt.get(0)
    }
    if(!pt.is('Block')) {
      const block = new ParseTree('Block');
      block.append(pt)
      pt=block
    }
    if(parent) {
      pt.set('parent', parent)
    }
    return pt;
  }

  pushCondition(symbol: string, cond: ParseTree) {
    const [cs,] = this.typeCheck(cond, BoolType)
    this.pushS(symbol)
    this.pushSP()
    this.pushP('(', [cs], ')')
    this.pushSP()
  }

  pushLoopBody(body: ParseTree, parent: ParseTree) {
    const loopLevel = this.funcBase.loopLevel
    this.funcBase.loopLevel = loopLevel + 1
    this.visit(this.makeBlock(body, parent))
    this.funcBase.loopLevel = loopLevel
  }

  checkRanges(pt: ParseTree) {
    if (pt.is('ApplyExpr') && pt.getToken('name') === 'range') {
      var ranges = pt.get('params').subNodes()
      if (ranges.length === 1) {
        ranges = [new ParseTree('Int', '0'), ranges[0]]
      }
      if (ranges.length === 2) {
        ranges.push(new ParseTree('Int', '1'))
      }
      return ranges;
    }
    return undefined;
  }

  pushForOf(symbols: Symbol[], range: ParseTree, modifier?:string) {
    const ranges = this.checkRanges(range);
    this.pushS('for')
    this.push('(')
    if (modifier) {
      this.pushS(modifier)
      this.pushSP()
    }
    this.pushSymbols(symbols)
    if (ranges) {
      this.push('=')
      this.pushT(ranges[0])
      this.push(';')
      if(ranges[2].is('Int')) {
        this.pushSymbols(symbols)
        this.push('<')
        this.pushT(ranges[1])
      }
      else {
        this.push(`${EntryPoint}.$check_range(`)
        this.pushSymbols(symbols)
        this.push(',')
        this.pushT(ranges[1])
        this.push(',')
        this.pushT(ranges[2])
        this.push(')')
      }
        this.push(';')
        this.pushSymbols(symbols)
        this.push('+=')
        this.pushT(ranges[2])
    }
    else {
      this.pushOp('of')
      this.visit(range)
    }
    this.push(')')
    this.pushSP()
  }

  acceptIfStmt(pt: ParseTree) {
    const [cs,] = this.typeCheck(pt.get('cond'), BoolType)
    this.pushS('if')
    this.pushSP()
    this.pushP('(', [cs], ')')
    this.pushSP()
    this.visit(this.makeBlock(pt.get('then'), pt.get('cond')))
    if (pt.has('elif')) {
      for (const stmt of pt.get('elif').subNodes()) {
        this.pushLF()
        this.pushIndent()
        this.pushS('else')
        this.pushSP()
        this.acceptIfStmt(stmt)
      }
    }
    if (pt.has('else')) {
      this.pushLF()
      this.pushIndent()
      this.pushS('else')
      this.pushSP()
      this.visit(this.makeBlock(pt.get('else'), pt.get('cond')))
      //this.visit(pt.get('else'))
    }
    return VoidType;
  }
 
  acceptWhileStmt(pt: ParseTree) {
    this.funcBase.foundAsync = true
    this.pushCondition('while', pt.get('cond'))
    this.pushLoopBody(pt.get('body'), pt)
    return VoidType
  }

 
  acceptForStmt(pt: ParseTree) {
    const [range, rangeTy] = this.typeCheck(pt.get('list'))
    const symbols = this.checkSymbols(pt.get('each'), this.elementType(rangeTy))
    this.pushForOf(symbols, pt.get('list'))
    this.pushLoopBody(pt.get('body'), pt)
    return VoidType
  }

  acceptListForExpr(pt: ParseTree) {
    const lenv = this.newFunctionContext(pt, '')
    lenv.push('{ const $xs = [];')
    for(const foreach of pt.subNodes()) {
      const [range, rangeTy] = lenv.typeCheck(foreach.get('list'))
      const symbols = lenv.checkSymbols(foreach.get('each'), this.elementType(rangeTy))
      lenv.pushForOf(symbols, foreach.get('list'), 'var')
      if(foreach.has('cond')) {
        lenv.pushCondition('if', foreach.get('cond'))
      }
    }
    const [cs, ty] = lenv.typeCheck(pt.get('append'))
    lenv.pushP('$xs.push(', [cs], ');return $xs; }')
    this.pushFunction(lenv, ')()');
    return Type.newParamType('list', ty)
  }

  acceptContinue(pt: ParseTree) {
    if (this.funcBase.loopLevel > 0) {
      this.pushS('continue')
    }
    else {
      this.perror(pt, 'OnlyInLoop')
    }
    return VoidType
  }

  acceptBreak(pt: ParseTree) {
    if (this.funcBase.loopLevel > 0) {
      this.pushS('break')
    }
    else {
      this.perror(pt, 'OnlyInLoop')
    }
    return VoidType
  }

  acceptReturn(pt: ParseTree) {
    if(this.inGlobal()) {
      this.perror(pt, 'OnlyInFunction')
      return VoidType
    }
    this.funcBase.hasReturn = true
    if(pt.has('expr')) {
      this.pushS('return')
      this.pushSP()
      this.pushT(pt.get('expr'), this.funcBase.returnType);
    }
    else {
      this.pushS('return');
    }
    return VoidType
  }

  /* Function Decl */

  protected newFunctionContext(parent: ParseTree, name: string = '') {
    const lenv = this.newEnv()
    lenv.funcBase = new FunctionContext(name, [], lenv.newVarType(parent))
    return lenv
  }

  protected addParameter(pt: ParseTree, ptype?: Type) {
    const pname = pt.has('name')? pt.getToken('name') : pt.getToken()
    if(!ptype) {
      ptype = this.newVarType(pt)
    }
    const symbol = this.setSymbol(pname, new Symbol(ptype, this.safeLocalName(pname)))
    this.funcBase.params.push(symbol.code)
    this.funcBase.paramTypes.push(ptype)
    //console.log(`param ${pname}, ${this.funcBase.params}`)
  }

  defineSymbol(name: string, symbol: Symbol, source?: ParseTree) {
    if (source) {
      const defined = this.getSymbol(name)
      if (defined) {
        this.perror(source.get('name'), 'RedefinedName')
      }
    }
    this.setSymbol(name, symbol)
    this.funcBase.declName(symbol.code)
  }

  pushFunction(body: JSGenerator, suffix?:string) {
    if(suffix) {
      this.push('(')
    }
    if (this.funcBase.foundAsync) {
      this.pushS('function*');
      this.pushP('(', body.funcBase.params, ')')
      this.pushSP()
    }
    else {
      this.pushP('(', body.funcBase.params, ')')
      this.pushOp('=>')
    }
    this.push(body.stringfy())
    if (suffix) {
      this.push(suffix)
    }
  }

  acceptFuncDecl(pt: ParseTree) {
    const name = pt.getToken('name')
    const lenv = this.newFunctionContext(pt, name)
    for (const p of pt.get('params').subNodes()) {
      lenv.addParameter(p.get('name'))
    }
    const funcBase = lenv.funcBase
    lenv.setSymbol(name, funcBase.definedSymbol(this.safeName(name), Async))
    lenv.visit(this.makeBlock(pt.get('body'), pt))
    const defun = lenv.funcBase.definedSymbol(this.safeName(name))
    this.defineSymbol(name, defun, pt)
    //
    this.pushLet(defun)
    this.pushFunction(lenv)
    // if(defun.code.startsWith('$')) {
    //   this.pushLF()
    //   this.pushIndent()
    //   this.push(`var ${name} = `)
    //   this.pushP('(', funcBase.params, ')')
    //   this.push(' => ');
    //   if (funcBase.foundAsync) {
    //     this.pushP(`${EntryPoint}.$__sync__(${defun.format()}(`, funcBase.params, '))')      
    //   }
    //   else{
    //     this.pushP(`${defun.format()}(`, funcBase.params, ')')      
    //   }
    // }
    //console.log(`DEFINED ${name} :: ${defun.type}`)
    return VoidType;
  }

  acceptFuncExpr(pt: ParseTree) {
    const lenv = this.newFunctionContext(pt, '')
    for (const p of pt.get('params').subNodes()) {
      //lenv.addParameter(p.get('name'))
      lenv.addParameter(p)
    }
    lenv.visit(pt.get('body'))
    this.pushFunction(lenv, ')')
    return lenv.funcBase.definedFuncType()
  }

  /* modules */

  getModule(pt: ParseTree) {
    const name = pt.getToken()
    // if (name === 'puppy2d') {
    //   this.autoPuppyMode = false;
    // }
    const module = this.loadModule(name)
    if(module) {
      return module;
    }
    this.perror(pt, 'UnknownModuleName');
    return undefined;
  }

  newModuleSymbol(name: string, module: Module) {
    const symbols = Language.symbolMap(module)
    return new Symbol(AnyType, name, { symbols })
  }

  getModuleSymbol(name: string, key: string, keyTree: ParseTree) {
    const symbol = this.getSymbol(name)
    if(symbol && symbol.options && symbol.options.symbols) {
      const moduleSymbol = symbol.options.symbols[key]
      if(!moduleSymbol) {
        this.perror(keyTree, 'UndefinedName')
      }
      return moduleSymbol;
    }
    return undefined
  }

  acceptImportDecl(pt: ParseTree) {
    const module = this.getModule(pt.get('name'))
    if (module) {
      const alias = pt.has('alias') ? pt.get('alias') : pt.get('name');
      const name = alias.getToken()
      const symbol = this.newModuleSymbol(`${EntryPoint}.${module.__entryKey__}`, module);
      this.setSymbol(name, symbol);
      // this.pushLet(symbol)
      // this.push(`${EntryPoint}.${module.entryKey}`)
    }
    return VoidType
  }

  importAutoModule(name: string, names?: { [key: string]: string }) {
    const module = this.loadModule(name)
    if (module) {
      return this.newModuleSymbol(name, module)
    }
    return undefined;
  }

  acceptFromDecl(pt: ParseTree, out: string[]) {
    const module = this.getModule(pt.get('name'));
    if(module) {
      const symbols = Language.symbolMap(module)
      const names = pt.get('names')
      if (names.getToken() !== '*') {
        for (const name of names.subNodes()) {
          const prefix = name.getToken()
          var unfound = true
          for (const key of Object.keys(symbols)) {
            if(key.startsWith(prefix)) {
              this.setSymbol(key, symbols[key])
              unfound = false
            } 
          }
          if(unfound) {
            this.perror(name, 'UndefinedName')
          }
        }
      }
      else {
        for (const key of Object.keys(symbols)) {
          this.setSymbol(key, symbols[key])
        }
      }
    }
    return VoidType
  }



  // Block
  acceptBlock(pt: ParseTree) {
    // const env = this.newEnv();
    this.pushS('{')
    this.incIndent()
    this.acceptSource(pt)
    this.decIndent()
    this.pushIndent()
    this.pushS('}')
    return VoidType
  }

  acceptTopLevelReturn(pt: ParseTree) {
    this.pushS('return')
    this.pushSP()
    this.pushT(pt.get(0));
    return VoidType
  }

  // Source
  acceptSource(pt: ParseTree) {
    if (pt.is('Source')) {
      this.pushIndent('//@names')
    }
    if (pt.has('parent')) {
      const parent = pt.get('parent');
      if(parent.is('FuncDecl')) {
        this.pushIndent('//@names')
      }
      this.pushYield(pt.get('parent'))
    }
    for (const stmt of pt.subNodes()) {
      this.pushYield(stmt)
      this.pushIndent()
      this.visit(stmt)
      this.pushEOS()
    }
    return VoidType
  }
  
  acceptSyntaxError(pt: ParseTree) {
    this.perror(pt, 'SyntaxError')
  }

}
