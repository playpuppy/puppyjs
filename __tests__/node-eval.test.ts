import { evaluate as _eval } from '../src/puppy-cli'

describe('literal', () => {
  test('True', () => {
    expect(_eval('True')).toBe(true)
  })
  test('False', () => {
    expect(_eval('False')).toBe(false)
  })
  test('1', () => {
    expect(_eval('1')).toBe(1)
  })
  test('.1', () => {
    expect(_eval('.1')).toBe(.1)
  })
  test(`'a'`, () => {
    expect(_eval(`'a'`)).toBe('a')
  })
  test(`"a"`, () => {
    expect(_eval(`"a"`)).toBe('a')
  })
})

describe('infix', () => {
  test('1+2', () => {
    expect(_eval('1+2')).toBe(1+2)
  })
  test('1-2-3', () => {
    expect(_eval('1-2-3')).toBe(1-2-3)
  })
  test('1*2+3', () => {
    expect(_eval('1*2+3')).toBe(1*2+3)
  })
  test('1*(2+3)', () => {
    expect(_eval('1*(2+3)')).toBe(1*(2+3))
  })
  test('2**3', () => {
    expect(_eval('2**3')).toBe(8)
  })
  test('7//2', () => {
    expect(_eval('7//2')).toBe(3)
  })
  test('7%2', () => {
    expect(_eval('7%2')).toBe(1)
  })
  test('2==1+1', () => {
    expect(_eval('2==1+1')).toBe(true)
  })
  test('1!=1+1', () => {
    expect(_eval('1!=1+1')).toBe(true)
  })
  test('1<=2 and 1<=1', () => {
    expect(_eval('1<=2 and 1<=1')).toBe(true)
  })
  test('2>=1 and 1>=1', () => {
    expect(_eval('2>=1 and 1>=1')).toBe(true)
  })
  test('2>=1 and 1>=1', () => {
    expect(_eval('2>=1 and 1>=1')).toBe(true)
  })
  test('1<2 or 1<1', () => {
    expect(_eval('1<2 or 1<1')).toBe(true)
  })
  test('2>1 or 1>1', () => {
    expect(_eval('1>1 or 2>1')).toBe(true)
  })
  test('1 is 2', () => {
    expect(_eval('1 is 2')).toBe(false)
  })
  test('1 is not 2', () => {
    expect(_eval('1 is not 2')).toBe(true)
  })
  test('1<2<3', () => {
    expect(_eval('1<2<3')).toBe(true)
  })
})

describe('function', () => {
  test('print("hello")', () => {
    expect(_eval('print("hello")')).toBe(undefined)
  })
  test('max(1,2)', () => {
    expect(_eval('max(1,2)')).toBe(2)
  })
  test('max(1,3,2)', () => {
    expect(_eval('max(1,3,2)')).toBe(3)
  })
  test('max([1,3,2])', () => {
    expect(_eval('max([1,3,2])')).toBe(3)
  })
})

// describe('assignment', () => {
//   test('x', () => {
//     expect(tc('x')).toMatch('var x')
//     expect(tc('x')).toMatch('x')
//   })
//   test('x=1', () => {
//     expect(tc('x=1')).toMatch('var x')
//     expect(tmin('x=1')).toMatch('x=1')
//   })
//   test('x+=1', () => {
//     expect(tc('x+=1')).toMatch('var x')
//     expect(tmin('x+=1')).toMatch('x=x+1')
//   })
//   test('a,b=1,2', () => {
//     expect(tc('a,b=1,2')).toMatch('var a,b')
//     expect(tmin('a,b=1,2')).toMatch('[a,b]=[1,2]')
//   })
// })


