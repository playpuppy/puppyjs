import { main } from '../src/puppy-cli'

test(`main`, () => {
  main(['-s', '__tests__/hello.py'])
  expect(1).toStrictEqual(1)//dummy
})

