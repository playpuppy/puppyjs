import { evaluate as _eval, newPuppyCompiler } from '../src/puppy-cli'

const puppyjs = newPuppyCompiler()
const tc = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled
}
const tmin = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled.replace(/\s/g, '')
}

//var x, y, z;
//x = 1;
//y = 1;
//z = x + y;


test('max(1,2)', () => {
  expect(tmin('max(1,2)')).toMatch('Math.max(1,2)')
})

describe('function', () => {
  test('abs(-1)', () => {
    expect(tmin('abs(-1)')).toMatch('1+2')
  })
  test('print("hello")', () => {
    expect(tmin('print("hello")')).toMatch(`.print(["hello"])`)
  })
  test('max([1,2])', () => {
    expect(tmin('max([1,2])')).toMatch('Math.max(...[1,2])')
  })
  test('max(1,2)', () => {
    expect(tmin('max(1,2)')).toMatch('Math.max(1,2)')
  })
  test('max(1,2,3)', () => {
    expect(tmin('max(1,2,3)')).toMatch('Math.max(1,2,3)')
  })
  test('range(10)', () => {
    expect(tmin('range(10)')).toMatch('.range(0,10,1)')
  })
  test('range(1,10)', () => {
    expect(tmin('range(1,10)')).toMatch('.range(1,10,1)')
  })
  test('range(1,10,2)', () => {
    expect(tmin('range(1,10,2)')).toMatch('.range(1,10,2)')
  })
})
