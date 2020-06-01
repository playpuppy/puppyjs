import * as fs from 'fs'  //fs = require('fs')
import * as readline from 'readline'
import { TransCompiler, site_package } from "./index"
import { Language, EntryPoint } from "./modules"

const run = (source: string, context: any) => {
  const main = `
return function (${EntryPoint}) {
  ${source}
}
`
  try {
    return (new Function(main))()(context)
  }
  catch (e) {
    console.log(main);
    console.log(e);
  }
}

export const newPuppyCompiler = () => {
  return new TransCompiler(new Language(
    site_package('node', ''),
    site_package('math')
  ))
}

const load = (file: string, isSource = false) => {
  var source = ''
  try {
    source = fs.readFileSync(file, 'utf-8')
  } catch (error) {
    console.log(`failed to read ${error}`)
    return
  }
  const origami = newPuppyCompiler()
  const code = origami.compile(source)
  if (isSource) {
    console.log(code.compiled)
  }
  else {
    run(code.compiled, code.newContext({}))
  }
}

export const evaluate = (source: string) => {
  const origami = newPuppyCompiler()
  const code = origami.compile(source)
  return run(code.compiled, code.newContext({}))
}

const inter = (isSource: boolean) => {
  const origami = newPuppyCompiler()
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  var context: any = {}
  rl.question('>>> ', (line: string) => {
    const code = origami.compile(line)
    if (isSource) {
      console.log(code.compiled)
    }
    else {
      context = code.newContext(context)
      run(code.compiled, context)
    }
    rl.close()
  });
}

export const main = (args: string[]) => {
  var isSource = false
  var hasFile = false
  for (const file of args) {
    if (file === '-c' || file === '-s') {
      isSource = true
    }
    if (file.endsWith('.py')) {
      hasFile = true
      load(file, isSource)
    }
  }
  if (!hasFile) {
    inter(isSource)
  }
}
