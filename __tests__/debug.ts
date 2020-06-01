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

test('d', () => {
  const c = `
s="abc"
s[4]
`
  console.log(tc(c))
  expect(_eval(c)).toThrowError('IndexError')
})

