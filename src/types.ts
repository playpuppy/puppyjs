import { TypeParser, ParseTree } from './parser';

const TypeNames: {[key:string]:string} = {
  'bool': 'boolean',
  'int': 'number',
  'float': 'number',
  'str': 'string',
  'list': 'Array',
  'void': '()',
}

const normalTypeName = (name: string): string => {
  if (name in TypeNames) {
    return TypeNames[name];
  }
  return name;
}

/* Type System */

export class Type {
  public tid: string;
  memoed = false;
  value: any;

  public constructor(tid: string, value: any) {
    this.tid = tid;
    this.value = value;
  }

  public toString() {
    return this.tid;
  }

  static key(open: string, ts: Type[], close: string) {
    return open + ts.map(x => x.tid).join(',') + close;
  }

  public match(ty: Type): Type | null {
    const ty1 = this.resolved();
    const ty2 = ty.resolved();
    if (ty1.tid === ty2.tid) {
      return ty1;
    }
    if (ty2 instanceof VarType && !(ty1 instanceof VarType)) {
      return ty2.matchEach(ty1);
    }
    return ty1.matchEach(ty2);
  }

  matchEach(ty: Type): Type | null {
    return null;
  }

  resolved(): Type {
    return this;
  }

  containsResolvingType() {
    return this.tid.indexOf('#') !== -1 || this.tid.indexOf('$') !== -1;
  }

  public paramTypes(): Type[] {
    return [this];
  }

  public getReturnType(): Type {
    return this;
  }

  public getParameterSize() {
    return 0;
  }

  public getParameterType(index: number): Type {
    return this;
  }

  public getValue() {
    return this.value;
  }

  public isOptional() {
    return this.getValue() !== undefined
  }

  public is(name: string) {
    return this.resolved().tid === name
  }

  public isBoolType() {
    return this.is('boolean');
  }

  public isNumberType() {
    return this.is('number')
  }

  public isStringType() {
    return this.is('string')
  }

  public isFuncType() {
    return this.resolved() instanceof FuncType
  }

  public isUntypedType() {
    return false;
  }

  /* static */

  static memoType(key: string, makeType: () => Type) {
    if (key.indexOf('#') === -1) {
      if (!(key in TypeMemo)) {
        TypeMemo[key] = makeType();
        TypeMemo[key].memoed = true;
      }
      return TypeMemo[key];
    }
    return makeType();
  }

  // public static newVarType(varname: string, id: number) {
  //   return new VarType(varname, id);
  // }

  public static newFuncType(paramType: Type, returnType: Type) {
    const key = `${paramType}->${returnType}`;
    return Type.memoType(key, () => new FuncType(key, paramType, returnType));
  }

  public static newParamType(base: string, ...ts: Type[]) {
    base = normalTypeName(base);
    const key = Type.key(base + '[', ts, ']');
    return Type.memoType(key, () => new ParamType(key, base, ts));
  }

  public static newArrayType(ty: Type) {
    return Type.newParamType('Array', ty);
  }

  static newTupleType(...ts: Type[]) {
    const key = Type.key('(', ts, ')');
    return Type.memoType(key, () => new TupleType(key, ts));
  }

  public static newUnionType(...ts: Type[]) {
    if (ts.length === 1) {
      return ts[0];
    }
    ts.sort((x, y) => x.tid.localeCompare(y.tid))
    const key = ts.map(x => x.tid).join('|');
    return Type.memoType(key, () => new UnionType(key, ts));
  }

  public static of(s: string) {
    const ty = TypeMemo[normalTypeName(s)];
    if(!ty) {
      //console.log(`FIXME Type.of('${s}') is undefined`);
      return TypeMemo['any'];
    }
    return ty;
  }

  public static parseOf(s: string) {
    return typeVisitor.parse(s);
  }

}

class BaseType extends Type {
  constructor(name: string, value?: any) {
    super(name, value);
  }
}

class VoidType extends BaseType {
  constructor() {
    super('()');
  }
  
  matchEach(ty: Type): Type | null {
    return this;
  }
  
  public paramTypes(): Type[] {
    return [];
  }

}

class AnyType extends BaseType {
  constructor() {
    super('any');
  }
  matchEach(ty: Type): Type | null {
    return ty instanceof VoidType ? null : ty;
  }

  public isUntypedType() {
    return true;
  }

}

class FuncType extends Type {
  private paramType: Type;
  private returnType: Type;

  constructor(tid: string, paramType: Type, returnType: Type) {
    super(tid, undefined)
    this.paramType = paramType;
    this.returnType = returnType;
  }

  public paramTypes(): Type[] {
    return this.paramType.paramTypes();
  }

  public getReturnType() {
    return this.returnType;
  }

  public getParameterSize() {
    return this.paramType.getParameterSize();
  }

  public getParameterType(index: number) {
    return this.paramType.getParameterType(index);
  }

  matchEach(ty: Type): Type | null {
    if (ty instanceof FuncType) {
      const p = this.paramType.match(ty.paramType);
      if (p === null) {
        return p;
      }
      const r = this.returnType.match(ty.returnType);
      if (r === null) {
        return r;
      }
      return Type.newFuncType(p, r);
    }
    return null;
  }

  resolved(): Type {
    if (this.containsResolvingType()) {
      const p = this.paramType.resolved();
      const r = this.returnType.resolved();
      return Type.newFuncType(p, r);
    }
    return this;
  }
}

class TupleType extends Type {
  types: Type[];

  constructor(tid: string, types: Type[]) {
    super(tid, undefined)
    this.types = types
  }

  public paramTypes(): Type[] {
    return this.types;
  }

  public getParameterSize() {
    return this.types.length;
  }

  public getParameterType(index: number) {
    return this.types[index];
  }

  matchEach(ty: Type): Type | null {
    if (ty instanceof TupleType && this.getParameterSize() === ty.getParameterSize()) {
      var ts = []
      for (var i = 0; i < this.getParameterSize(); i++) {
        var res = this.getParameterType(i).match(ty.getParameterType(i));
        if (res === null) {
          return res;
        }
        ts.push(res)
      }
      return this.newMatched(ts);
    }
    return null;
  }

  newMatched(ts: Type[]): Type {
    return Type.newTupleType(...ts);
  }

  resolved(): Type {
    if (this.containsResolvingType()) {
      const ts = this.types.map(t => t.resolved());
      return Type.newTupleType(...ts);
    }
    return this;
  }
}

class ParamType extends TupleType {
  public base: string;

  constructor(tid: string, base: string, types: Type[]) {
    super(tid, types)
    this.base = base
  }

  matchEach(ty: Type): Type | null {
    if (ty instanceof ParamType && this.base === ty.base) {
      return super.matchEach(ty);
    }
    return null;
  }

  newMatched(ts: Type[]): Type {
    return Type.newParamType(this.base, ...ts);
  }

  resolved(): Type {
    if (this.containsResolvingType()) {
      const ts = this.types.map(t => t.resolved());
      return Type.newParamType(this.base, ...ts);
    }
    return this;
  }

}

class UnionType extends TupleType {
  constructor(key: string, types: Type[]) {
    super(key, types);
  }

  matchEach(ty: Type): Type | null {
    if (ty instanceof UnionType) {
      const ts: Type[] = []
      for (const t of ty.types) {
        const res = UnionType.matchUnion(this.types, t);
        if (res !== null) {
          UnionType.appendUnion(ts, res);
        }
      }
      if (ts.length === 0) {
        return null;
      }
      return Type.newUnionType(...ts);
    }
    return UnionType.matchUnion(this.types, ty);
  }

  resolved(): Type {
    if (this.containsResolvingType()) {
      const ts = this.types.map(t => t.resolved());
      return Type.newUnionType(...ts);
    }
    return this;
  }

  static appendUnion(ts: Type[], ty: Type) {
    if (ty instanceof UnionType) {
      for (const t of ty.types) {
        UnionType.appendUnion(ts, t);
      }
    }
    else {
      for (const t of ts) {
        if (ty.tid === t.tid) {
          return;
        }
      }
      ts.push(ty);
    }
  }

  static matchUnion(ts: Type[], ty: Type) {
    for (const t of ts) {
      const res = t.match(ty);
      if (res !== null) {
        return res;
      }
    }
    return null;
  }
}

export interface TypeEnvSolver {
  getTypeEnv(): TypeEnv;
}

export class TypeEnv implements TypeEnvSolver {
  parent: TypeEnv | null;
  env: { [key: string]: TypeRef } = {};
  serial = 0;

  constructor(parent: TypeEnv | null = null) {
    this.parent = parent;
    if (parent) {
      this.serial = parent.serial;
    }
  }

  pop() : TypeEnv {
    this.parent!.serial = this.serial
    return this.parent!;
  }
  
  getTypeEnv(): TypeEnv {
    return this
  }

  public newVarType(name: string, env?: TypeEnvSolver) {
    this.serial += 1;
    return new VarType(env === undefined ? this : env, `${name}#${this.serial}`, this.serial);
  }

  setTypeRef(key: string, tref: TypeRef) {
    this.env[key] = tref;
  }

  getTypeRef(key: string, parent: VarType): TypeRef {
    var tref = this.env[key];
    if (!tref) {
      if(this.serial < AlphaSerial) {
        this.serial += 1;
      }
      tref = new TypeRef(parent, this.serial);
      this.env[key] = tref;
    }
    return tref;
  }
}

class TypeRef {
  serial: number
  key: VarType;
  resolved: Type | null = null;
  
  constructor(key: VarType, serial: number) {
    this.serial = serial;
    this.key = key;
    this.resolved = null;
  }

  match(ty: Type) : Type | null{
    if (ty instanceof VarType) {
      const r1 = this.key.getTypeRef()
      const r2 = ty.getTypeRef()
      const u = TypeRef.merge(r1, r2);
      if(u) {
        this.key.setTypeRef(u);
        ty.setTypeRef(u);
        return this.key.resolved();
      }
      return null;
    }
    if (this.resolved === null) {
      this.resolved = ty;
      return ty;
    }
    const matched = this.resolved.match(ty);
    if (matched !== null) {
      this.resolved = ty;
    }
    return null;
  }

  static merge(r1: TypeRef, r2: TypeRef) {
    if(r1 === r2) {
      return r1;
    }
    if (r1.resolved === null && r2.resolved === null) {
      return r1.serial < r2.serial ? r1 : r2;
    }
    if (r1.resolved !== null && r2.resolved === null) {
      r2.resolved = r1.resolved;
      return r1.serial < r2.serial ? r1 : r2;
    }
    if(r1.resolved === null && r2.resolved !== null) {
      r1.resolved = r2.resolved;
      return r1.serial < r2.serial ? r1 : r2;
    }
    const matched = r1.resolved?.match(r2.resolved!);
    if(matched) {
      r1.resolved = matched;
      r2.resolved = matched;
      return r1.serial < r2.serial ? r1 : r2;
    }
    return null;
  }

}

class VarType extends Type {
  tenvSolver: TypeEnvSolver;
  tenv:TypeEnv;

  constructor(tenvSolver: TypeEnvSolver, varname: string, serial: number) {
    super(varname, undefined);
    this.tenvSolver = tenvSolver;
    this.tenv = tenvSolver.getTypeEnv();
    this.tenv.setTypeRef(this.tid, new TypeRef(this, serial))
  }

  private getTypeEnv() {
    if (this.tid.startsWith('$')) {
      return this.tenvSolver.getTypeEnv();
    }
    else {
      return this.tenv;
    }
  }

  getTypeRef(): TypeRef {
    var tenv = this.getTypeEnv();
    return tenv.getTypeRef(this.tid, this);
  }

  setTypeRef(u: TypeRef) {
    const tenv = this.getTypeEnv();
    tenv.setTypeRef(this.tid, u);
  }

  matchEach(ty: Type): Type | null {
    const tref = this.getTypeRef();
    return tref.match(ty.resolved());
  }


  resolved() {
    const tref = this.getTypeRef();
    return tref.resolved ? tref.resolved : this;
  }

  public toString(): string {
    const ty = this.resolved();
    if(ty === this) {
      return this.tid.startsWith('$') ? this.tid : 'any';
    }
    return ty.toString()
  }

  public paramTypes(): Type[] {
    return this.resolved().paramTypes();
  }

  public getReturnType(): Type {
    return this.resolved().getReturnType();
  }

  public getParameterSize() : number {
    return this.resolved().getParameterSize();
  }

  public getParameterType(index: number): Type {
    return this.resolved().getParameterType(index);
  }

  public getValue() : any {
    return this.resolved().getValue();
  }

  public isUntypedType(): any {
    const ty = this.resolved()
    if(ty !== this) {
      return ty.isUntypedType()
    }
    return true;
  }
}

const AlphaSerial = (Number.MAX_SAFE_INTEGER - 26);
const AlphaTypeEnv = new TypeEnv()

const TypeMemo: { [key: string]: Type } = {
  'any': new AnyType(),
  '()': new VoidType(),
  'boolean': new BaseType('boolean'),
  'number': new BaseType('number'),
  'string': new BaseType('string'),
  'a': new VarType(AlphaTypeEnv, '$a', AlphaSerial),
  'b': new VarType(AlphaTypeEnv, '$b', AlphaSerial + 1),
  'c': new VarType(AlphaTypeEnv, '$c', AlphaSerial + 2),
}

class TypeVisitor {

  public parse(s: string) {
    if (s in TypeMemo) {
      return TypeMemo[s]
    }
    const t = TypeParser(s);
    return this.visit(t);
  }

  visit(pt: ParseTree): Type {
    // console.log(`${pt}`)
    // const key = normalName(pt.getToken());
    // console.log(`key='${key}'`)
    // if (key in TypeMemo) {
    //   return TypeMemo[key];
    // }
    const method = `accept${pt.getTag()}`;
    if (method in this) {
      const ty = (this as any)[method](pt);
      // if (!(key in TypeMemo)) {
      //   TypeMemo[key] = ty;
      // }
      return ty;
    }
    return TypeMemo['any'];
  }

  acceptBaseType(pt: ParseTree) {
    const uname = normalTypeName(pt.getToken());
    if (!(uname in TypeMemo)) {
      TypeMemo[uname] = new BaseType(uname);
    }
    return TypeMemo[uname];
  }

  acceptFuncType(pt: ParseTree) {
    const p = this.visit(pt.get(0))
    const r = this.visit(pt.get(1))
    //console.log(`${pt}`)
    //console.log(`${pt.get(0)} ${p}`)
    return Type.newFuncType(p, r);
  }

  acceptTupleType(pt: ParseTree) {
    const pts = pt.subNodes();
    if (pts.length === 0) {
      return TypeMemo['()'];
    }
    if (pts.length === 1) {
      return this.visit(pts[0]);
    }
    const ts: Type[] = pts.map((x) => this.visit(x));
    return Type.newTupleType(...ts);
  }

  acceptParamType(pt: ParseTree) {
    const pts = pt.subNodes();
    if (pts.length === 1) {
      const ty = this.visit(pts[0]);
      return Type.newArrayType(ty);
    }
    const ts: Type[] = []
    for (var i = 1; i < pts.length; i += 1) {
      ts.push(this.visit(pts[i]));
    }
    return Type.newParamType(pts[0].getToken(), ...ts);
  }

  acceptUnionType(pt: ParseTree) {
    const ts: Type[] = []
    for (const tt of pt.subNodes()) {
      UnionType.appendUnion(ts, this.visit(tt));
    }
    return Type.newUnionType(...ts);
  }
}

const typeVisitor = new TypeVisitor();

/* symbol */

export class Symbol {
  type: Type;
  source: ParseTree | null = null;
  code: string;
  options: any | undefined;
  constructor(type: Type, code = '', options?: any) {
    this.type = type
    this.code = code
    this.options = options
  }
  format(params?: string[]): string {
    if (!params) {
      return this.code
    }
    if (this.code.indexOf('{0}') !== -1) {
      var s = this.code
      for (var i = 0; i < params.length; i++) {
        s = s.replace(`{${i}}`, params[i]);
      }
      return s;
    }
    return this.code + '(' + params.join(',') + ')'
  }

  // options 
  public static Async = { isAsync: true }

}

