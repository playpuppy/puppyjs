import { Type, TypeEnv } from '../src/types';

const voidTy = Type.of('void')
const boolTy = Type.of('bool')
const intTy = Type.of('int')
const floatTy = Type.of('float')
const strTy = Type.of('str')
//const ObjectType = Type.of('object')
const anyTy = Type.of('any')

const testMatch = (ty1: Type, ty2: Type) => {
  const res = ty1.match(ty2);
  return res ? `${res.resolved()}` : `null`;
}

test(`Type.parseOf`, () => {
  const ty = Type.parseOf('a|b')
  const ty2 = Type.parseOf('int')
  const ty3 = Type.parseOf('int->int')
  const ty4 = Type.parseOf('(int,int)')
  expect(`${ty}`).toBe('$a|$b');
  expect(`${ty2}`).toBe('number');
  expect(`${ty3}`).toBe('number->number');
  expect(`${ty4}`).toBe('(number,number)');
  const ty5 = Type.parseOf('()')
  expect(`${ty5}`).toBe('()');
  const ty6 = Type.parseOf('(a,a)->a')
  expect(`${ty6}`).toBe('($a,$a)->$a');
  const ty7 = Type.parseOf('()->void')
  //console.log(ty7)
  expect(`${ty7}`).toBe('()->()');
});

test(`Type.is`, () => {
  const ty = Type.parseOf('int')
  const ty2 = Type.parseOf('int->int')
  const ty3 = Type.parseOf('(int,int)')
  expect(ty.isNumberType()).toBe(true);
  expect(ty.is('number')).toBe(true);
});

describe('match', () => {

  test(`BaseType`, () => {
    expect(`${intTy}`).toBe('number');
    expect(`${strTy}`).toBe('string');
    expect(testMatch(intTy, intTy)).toBe('number');
    expect(testMatch(strTy, strTy)).toBe('string');
    expect(testMatch(intTy, strTy)).toBe('null');
    expect(testMatch(strTy, intTy)).toBe('null');
  });

  test(`VoidType`, () => {
    expect(`${voidTy}`).toBe('()');
    expect(testMatch(voidTy, intTy)).toBe('()');
    expect(testMatch(intTy, voidTy)).toBe('null');
  });

  test(`AnyType`, () => {
    expect(`${anyTy}`).toBe('any');
    expect(testMatch(anyTy, anyTy)).toBe('any');
    expect(testMatch(anyTy, intTy)).toBe('number');
    //expect(testMatch(intTy, anyTy)).toBe('any');
  });

  test(`ArrayType`, () => {
    const strTy = Type.parseOf('str[]')
    const intTy = Type.parseOf('Array[int]')
    const aTy = Type.parseOf('a[]')
    const intintTy = Type.parseOf('Array[int][]')
    expect(`${strTy}`).toBe('Array[string]');
    expect(`${intTy}`).toBe('Array[number]');
    expect(`${intintTy}`).toBe('Array[Array[number]]');
    expect(`${aTy}`).toBe('Array[$a]');
    // string[] <: number[]
    expect(testMatch(strTy, intTy)).toBe('null');
    // a[] <: int[]
    expect(testMatch(aTy, intTy)).toBe('Array[number]');
    // a[] <: string[]
    expect(testMatch(aTy, strTy)).toBe('null');
  });

// test(`FuncType`, () => {
//   const tenv = new TypeEnv(null);
//   const strTy = Type.parseOf('str->str')
//   const intTy = Type.parseOf('int->int')
//   const aTy = Type.parseOf('a->a')
//   expect(`${strTy}`).toBe('string->string');
//   expect(`${intTy}`).toBe('number->number');
//   expect(`${aTy}`).toBe('a->a');
//   expect(testMatch(tenv, strTy, intTy)).toBe('null');
//   expect(testMatch(tenv, aTy, intTy)).toBe('number->number');
//   expect(testMatch(tenv, aTy, strTy)).toBe('null');
// });
});

describe('VarType', ()=> {
  test(`VarType/BaseType`, () => {
    const tenv = new TypeEnv();
    const xTy = tenv.newVarType('x');
    const yTy = tenv.newVarType('y');
    expect(testMatch(xTy, intTy)).toBe('number');
    expect(testMatch(xTy, intTy)).toBe('number');
    expect(testMatch(xTy, boolTy)).toBe('null');
    expect(testMatch(intTy, yTy)).toBe('number');
    expect(testMatch(intTy, yTy)).toBe('number');
    expect(testMatch(boolTy, yTy)).toBe('null');
    expect(testMatch(xTy, yTy)).toBe('number');
    expect(testMatch(yTy, xTy)).toBe('number');
    expect(`${xTy}`).toBe('number');
    expect(`${yTy}`).toBe('number');
  });

  test(`VarType/VarType`, () => {
    const tenv = new TypeEnv();
    const xTy = tenv.newVarType('x');
    const yTy = tenv.newVarType('y');
    expect(testMatch(xTy, yTy)).toBe('any');
    expect(testMatch(yTy, intTy)).toBe('number');
    expect(testMatch(xTy, intTy)).toBe('number');
    expect(`${xTy}`).toBe('number');
    expect(`${yTy}`).toBe('number');
  });
});

// test(`VarType x y`, () => {
//   const xTy = Type.newVarType('x', 0);
//   const yTy = Type.newVarType('y', 1);
//   const intTy = Type.parseOf('int')
//   const tenv = new TypeEnv(null);
//   expect(testMatch(tenv, xTy, yTy)).toBe('x#0');
//   expect(`${xTy}`).toBe('x#0');
//   expect(`${yTy}`).toBe('x#0');
//   expect(testMatch(tenv, intTy, yTy)).toBe('number');
//   expect(`${xTy}`).toBe('number');
//   expect(`${yTy}`).toBe('number');
// });

// test(`VarType x y z`, () => {
//   const xTy = Type.newVarType('x', 0);
//   const yTy = Type.newVarType('y', 1);
//   const zTy = Type.newVarType('z', 2);
//   const intTy = Type.parseOf('int')
//   const tenv = new TypeEnv(null);
//   expect(testMatch(tenv, xTy, zTy)).toBe('x#0');
//   expect(testMatch(tenv, yTy, zTy)).toBe('x#0');
//   expect(testMatch(tenv, xTy, yTy)).toBe('x#0');
//   expect(testMatch(tenv, yTy, intTy)).toBe('number');
//   expect(`${xTy}`).toBe('number');
//   expect(`${yTy}`).toBe('number');
//   expect(`${zTy}`).toBe('number');
// });

// test(`UnionType`, () => {
//   const u1Ty = Type.parseOf('int')
//   const u2Ty = Type.parseOf('int|str')
//   const u3Ty = Type.parseOf('int|str|bool')
//   const u4Ty = Type.parseOf('bool|object')
//   expect(`${u1Ty}`).toBe('number');
//   expect(`${u2Ty}`).toBe('number|string');
//   expect(`${u3Ty}`).toBe('boolean|number|string');
//   const tenv = new TypeEnv(null);
//   // number|string
//   expect(testMatch(tenv, u2Ty, u1Ty)).toBe('number');
//   expect(testMatch(tenv, u3Ty, u2Ty)).toBe('number|string');
//   expect(testMatch(tenv, u2Ty, u4Ty)).toBe('null');
//   // expect(testMatch(tenv, u1Ty, u2Ty)).toBe('number');
//   // expect(testMatch(tenv, u2Ty, u3Ty)).toBe('number');
// });

// test(`UnionAlphaType`, () => {
//   const intTy = Type.parseOf('int')
//   const intATy = Type.parseOf('int[]')
//   const u2Ty = Type.parseOf('str|a[]')
//   const aTy = Type.parseOf('a')
//   const tenv = new TypeEnv(null);
//   // number|string
//   expect(testMatch(tenv, u2Ty, intATy)).toBe('Array[number]');
//   expect(testMatch(tenv, aTy, intTy)).toBe('number');
//   expect(testMatch(tenv, intTy, aTy)).toBe('number');
// });


// test(`UnionVarType`, () => {
//   const intTy = Type.parseOf('int')
//   const u2Ty = Type.parseOf('int|str')
//   const u3Ty = Type.parseOf('int|str|bool')
//   const xTy = Type.newVarType('x', 0);
//   const yTy = Type.newVarType('y', 1);

//   const tenv = new TypeEnv(null);
//   // number|string
//   expect(testMatch(tenv, u2Ty, xTy)).toBe('number|string');
//   expect(testMatch(tenv, u3Ty, yTy)).toBe('boolean|number|string');
//   expect(testMatch(tenv, yTy, xTy)).toBe('number|string');
//   expect(`${xTy}`).toBe('number|string')
//   expect(`${yTy}`).toBe('number|string')
//   expect(testMatch(tenv, intTy, xTy)).toBe('number');
//   expect(`${xTy}`).toBe('number')
//   expect(`${yTy}`).toBe('number')
// });
