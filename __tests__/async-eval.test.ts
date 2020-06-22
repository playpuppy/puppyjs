import { newPuppyCompiler } from '../src/puppy-cli'

const puppyjs = newPuppyCompiler()
puppyjs.install('async', '')

const tc = (s: string) => {
  const c = puppyjs.compile(s)
  return c.compiled
}

describe('literal', () => {
  test('True', () => {
    expect(tc('True')).toMatch('true')
  })
})
