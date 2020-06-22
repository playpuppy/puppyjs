import { newPuppyCompiler } from '../src/puppy-cli'

const puppyjs = newPuppyCompiler()
puppyjs.install('async', '')

const tc = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled
}
const tmin = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled.replace(/\s/g, '')
}

describe('def', () => {
  test('succ', () => {
    const c = `
def succ(n):
  return n+1
`
    expect(tmin(c)).toMatch(`['succ']=(n)=>{`)
    expect(tmin(c)).toMatch('returnn+1')
  })
  test('fact', () => {
    const c = `
def fact(n):
  if n == 1: return 1
  return fact(n-1)*n
`
    expect(tmin(c)).toMatch(`['fact']=function*(n)`)
    expect(tmin(c)).toMatch(`return(yield()=>$v.vars['fact'](n-1))*n`)
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
  test('fwhile', () => {
    const c = `
def fwhile(a,b):
  while a < b:
    a+=1
`
    expect(tmin(c)).toMatch(`['fwhile']=function*(a,b){`)
    expect(tmin(c)).toMatch(`if(Math.random()<0.01)yield0`)
  })
  test('before fuse', () => {
    const c = `
def fwhile():
  while a < b:
    a+=1

def fuse():
    fwhile()

`
    expect(tmin(c)).toMatch(`['fuse']=function*(){`)
    expect(tmin(c)).toMatch(`(yield()=>$v.vars['fwhile']())`)
  })

  test('after fuse', () => {
    const c = `
def fuse():
    fwhile()

def fwhile():
  while a < b:
    a+=1
`
    expect(tmin(c)).toMatch(`v.vars['fuse']=()=>{`)
    expect(tmin(c)).toMatch(`fwhile()`)
    expect(tmin(c)).toMatch(`varfwhile=()=>`)
  })

})

