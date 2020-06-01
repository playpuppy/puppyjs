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

describe('built-in', () => {
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

describe('variable', () => {
  test('x', () => {
    const c = `
x = 1
x    
`
    expect(_eval(c)).toBe(1)
  })

  test('x,y', () => {
    const c = `
x,y=1,2
x+y
`
    expect(_eval(c)).toBe(3)
  })
  test('s[0]', () => {
    const c = `
s="abc"
s[0]
`
    expect(_eval(c)).toBe('a')
  })
  test('s[0]="z"', () => {
    const c = `
s="abc"
s[0]="z"
s[0]
`
    expect(_eval(c)).toBe('a')
  })
  test('d.x', () => {
    const c = `
d={"x": 1, "y": 2}
d.y
`
    expect(_eval(c)).toBe(2)
  })
  test('d.x=1', () => {
    const c = `
d={"x": 1, "y": 2}
d.y = d.x
d.y
`
    expect(_eval(c)).toBe(1)
  })

  test('s[-1]', () => {
    const c = `
s="abc"
s[-1]
`
    expect(_eval(c)).toBe('c')
  })

})


