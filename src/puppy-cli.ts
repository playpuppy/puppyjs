import * as fs from 'fs'  //fs = require('fs')
import * as readline from 'readline'
import { TransCompiler, site_package, Stopify } from "./index"
import { Language, EntryPoint, Context } from "./modules"

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
    Context.set(context, 'main', source)
    Context.set(context, 'e', e)
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

/* online judge */

const match = (a: any, b: any) => {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === b.length) {
      for (var i = 0; i < a.length; i++) {
        if(!match(a[i],b[i])) {
          return false
        }
      }
      return true
    }
  }
  if(typeof a === 'object' && typeof b === 'object') {
    for(const key of Object.keys(a)) {
      if(!match(a[key], b[key])) {
        return false
      }
    }
    return true
  }
  return false
}

type JudgeData = {
  name: string
  timeOut?: number
  input: any[]
  output: any
  elapsed: number
  status: string
  result: any
}

export class OnlineJudge {
  tc: TransCompiler

  public constructor() {
    this.tc = newPuppyCompiler()
    this.tc.install('', site_package('async'))
  }

  public createContext(source: string) {
    const code = this.tc.compile(source)
    console.log(code.compiled)
    const cx = code.newContext({})
    run(code.compiled, cx)
    return cx
  }
  
  judged = (cx: any, d: JudgeData) => {
    console.log(d)
  } 

  public judge(cx: any, d: JudgeData) {
    if (Context.get(cx, 'e')) {
      d.status = 'FE'
      return false
    }
    if (!cx[d.name]) {
      d.status = 'NE';
      return false
    }
    const startTime = Date.now()
    var result = cx[d.name](...d.input)
    if (result && result.next) {
      const stopify = new Stopify(result)
      stopify.setTimeOut(d.timeOut || 5000)
      stopify.start((ret) => {
        d.elapsed = Date.now() - startTime
        d.status = match(d.output, ret) ? 'AC' : 'WA'
        d.result = ret
        this.judged(cx, d)
      })
    }
    else {
      d.elapsed = Date.now() - startTime
      d.status = match(d.output, result) ? 'AC' : 'WA'
      d.result = result
      this.judged(cx, d)
    }
  }
}

const testGcd = `
def gcd(a,b):
  if b == 0: return a
  return gcd(b, a%b)
`

const dataGcd: JudgeData = {
      name: 'gcd',
      input: [1071,1029],
      output: 21,
      status: '',
      elapsed: -1,
      result: undefined,
}


export const testJudge = () => {
  const oj = new OnlineJudge()
  const cx = oj.createContext(testGcd)
  oj.judge(cx, dataGcd)
} 