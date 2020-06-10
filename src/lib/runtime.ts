import { Module, APIs, EntryPoint } from '../modules'
import { Stopify } from '../stopify'

const DefineAsync: APIs = [
  ['$', 'void', `${EntryPoint}['{0}']`],
  ['yield-async', 'void', 'yield'],
  ['check-sync', 'any', '$$sync'],
]

export class LibAsync extends Module {
  public constructor() {
    super('', DefineAsync)
  }

  public sync(result: any) {
    if(result && result.next) {
      return new Stopify(result).syncExec()
    }
    return result
  }
}

const DefineBreakPoint: APIs = [
  ['yield-time', 'void', 'yield'],
]

export class LibBreakPoint extends Module {
  public constructor() {
    super('', DefineBreakPoint)
  }
}

