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

describe('expression', () => {
  test('+1', () => {
    expect(tmin('+1')).toMatch('+1')
  })
  test('-1', () => {
    expect(tmin('-1')).toMatch('-1')
  })
  test('not True', () => {
    expect(tmin('not True')).toMatch('!true')
  })
  test('x', () => {
    expect(tmin('x')).toMatch('x')
  })
  test('a.x', () => {
    expect(tmin('a.x')).toMatch('a.x')
  })
  test('a[0]', () => {
    expect(tmin('a[0]')).toMatch('a[0]')
  })
  test('sin(x)', () => {
    expect(tmin('sin(x)')).toMatch('sin(x)')
  })
  test('a.append(x)', () => {
    expect(tmin('a.append(x)')).toMatch('a.push(x)')
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

describe('statement', () => {
  test('if', () => {
    const c = `
if True:
  x=1
`
    expect(tmin(c)).toMatch('varx')
    expect(tmin(c)).toMatch('if(true){')
  })

  test('if/elif', () => {
    const c = `
if True:
  x=1
elif True:
  pass
elif False:
  pass
else:
  y=1
`
    expect(tmin(c)).toMatch('varx,y')
    expect(tmin(c)).toMatch('if(true){')
    expect(tmin(c)).toMatch('elseif(false){')
    expect(tmin(c)).toMatch('else{')
  })

  test('while', () => {
    const c = `
while True:
  x=1
`
    expect(tmin(c)).toMatch('varx')
    expect(tmin(c)).toMatch('while(true){')
  })

  test('for', () => {
    const c = `
for i in [1,2,3]:
  x=1
`
    expect(tmin(c)).toMatch('vari,x')
    expect(tmin(c)).toMatch('for(iof[1,2,3]){')
  })

  test('for range', () => {
    const c = `
for i in range(10):
  x=1
`
    expect(tmin(c)).toMatch('vari,x')
    expect(tmin(c)).toMatch('for(i=0;i<10;i+=1){')
  })

})

describe('def', () => {
  test('succ', () => {
    const c=`
def succ(n):
  return n+1
`
    expect(tmin(c)).toMatch('succ=(n)=>{')
    expect(tmin(c)).toMatch('returnn+1')
  })
  test('fact', () => {
    const c = `
def fact(n):
  if n == 1: return 1
  return fact(n-1)*n
`
    expect(tmin(c)).toMatch('return1')
    expect(tmin(c)).toMatch('returnfact(n-1)*n')
  })
  test('add', () => {
    const c = `
def add(a,b):
  z = a+b
  return z
`
    expect(tmin(c)).toMatch('varz')
    expect(tmin(c)).toMatch('returnz')
  })
})

