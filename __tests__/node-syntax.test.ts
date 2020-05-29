import { newPuppyCompiler } from '../src/puppy-cli'

const puppyjs = newPuppyCompiler()
const tc = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled
}
const tmin = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled.replace(/\s/g, '')
}

describe('literal', ()=>{
  test('True', () => {
    expect(tc('True')).toMatch('true')
  })
  test('False', () => {
    expect(tc('False')).toMatch('false')
  })
  test('1', () => {
    expect(tc('1')).toMatch('1')
  })
  test('.1', () => {
    expect(tc('.1')).toMatch('.1')
  })
  test(`'a'`, () => {
    expect(tc(`'a'`)).toMatch(`'a'`)
  })
  test(`"a"`, () => {
    expect(tc(`"a"`)).toMatch(`"a"`)
  })
  test(`[]`, () => {
    expect(tmin(`[]`)).toMatch(`[]`)
  })
  test(`[1,]`, () => {
    expect(tmin(`[1,]`)).toMatch(`[1]`)
  })
  test(`[1, 2]`, () => {
    expect(tmin(`[1, 2]`)).toMatch(`[1,2]`)
  })
  test(`(1)`, () => {
    expect(tmin(`(1)`)).toMatch(`(1)`)
  });
  test(`(1,2)`, () => {
    expect(tmin('(1,2)')).toMatch(`[1,2]`)
  });
  test(`(1,2,3)`, () => {
    expect(tmin('(1,2,3)')).toMatch(`[1,2,3]`)
  });
  test(`{}`, () => {
    expect(tmin('{}')).toMatch(`{}`)
  });
  test(`{key: "a", value: 1}`, () => {
    expect(tmin('{key: "a", value: 1}')).toMatch(`{'key':"a",'value':1}`)
  });
})

describe('infix', () => {
  test('1+1', () => {
    expect(tmin('1+2')).toMatch('1+2')
  })
  test('1-2-3', () => {
    expect(tmin('1-2-3')).toMatch('(1-2)-3')
  })
  test('1*2+3', () => {
    expect(tmin('1*2+3')).toMatch('(1*2)+3')
  })
  test('1*(2+3)', () => {
    expect(tmin('1*(2+3)')).toMatch('1*(2+3)')
  })
  test('2**3', () => {
    expect(tmin('2**3')).toMatch('Math.pow(2,3)')
  })
  test('7//2', () => {
    expect(tmin('7//2')).toMatch('((7/2)|0)')
  })
})

describe('assignment', () => {
  test('x', () => {
    expect(tc('x')).toMatch('var x')
    expect(tc('x')).toMatch('x')
  })
  test('x=1', () => {
    expect(tc('x=1')).toMatch('var x')
    expect(tmin('x=1')).toMatch('x=1')
  })
  test('x+=1', () => {
    expect(tc('x+=1')).toMatch('var x')
    expect(tmin('x+=1')).toMatch('x=x+1')
  })
  test('a,b=1,2', () => {
    expect(tc('a,b=1,2')).toMatch('var a,b')
    expect(tmin('a,b=1,2')).toMatch('[a,b]=[1,2]')
  })
})
