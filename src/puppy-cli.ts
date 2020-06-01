import * as fs from 'fs'  //fs = require('fs')
import * as readline from 'readline'
import { TransCompiler, site_package, Stopify } from "./index"
import { Language, EntryPoint } from "./modules"

const generate = (source: string) => {
  const main = `
return function (${EntryPoint}) {
  ${source}
}
`
  try {
    return (new Function(main))()
  }
  catch (e) {
    return e;
  }
}

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
  const tc = new TransCompiler();
  tc.install('', site_package('node'))
  tc.install('math', site_package('math'))
  return tc
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

type JudgeData = {
  name: string
  timeOut?: number
  input: any[]
  output: any
}

const judgeData: JudgeData = {
  name: 'gcd',
  input: [10, 7],
  output: 10,
}

type JudgeStatus = {
  serial: number
  name: string
  input: any[]
  output: any
  result: any
  elapsed: number
}

export const judge = (source: string, data: JudgeData[]) => {
  const tc = new TransCompiler()
  const code = tc.compile(source)
  const vars = code.newContext({})
  run(code.compiled, vars)
  if(main instanceof Error) {

  }
  for(var i = 0; i < data.length; i+=1) {
    const d = data[i]
    if(vars[d.name]) {
      const startTime = Date.now()
      var result = vars[d.name](...d.input)
      if(result && result.next) {
        const stopify = new Stopify(result)
        stopify.setTimeOut(d.timeOut || 5000)
        stopify.start()
      }
    }
  }
}
