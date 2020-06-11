import { PuppyPlayer } from '../src/index'

const source = `
print('hello,world')
`

test('puppy', () => {
  const puppy = new PuppyPlayer()
  puppy.install('node', '')
  puppy.load(source)
  puppy.start()
})

