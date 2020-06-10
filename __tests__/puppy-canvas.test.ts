import { PuppyCanvas, site_package } from '../src/index'

const source = `
print('hello,world')
`

test('puppy', () => {
  const puppy = new PuppyCanvas()
  puppy.install('node', '')
  puppy.load(source)
  puppy.start()
})

