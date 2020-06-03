import { newPuppyCompiler } from '../src/puppy-cli'
import { site_package } from '../src'

const puppyjs = newPuppyCompiler()
puppyjs.install('', site_package('async'))

const tc = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled
}
const tmin = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled.replace(/\s/g, '')
}

describe('literal', () => {
  test('True', () => {
    expect(tc('True')).toMatch('true')
  })
})
