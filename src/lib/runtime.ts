import { Module, SymbolList, EntryPoint } from '../modules'
import { Stopify } from '../stopify'
//import * as fs from 'fs'

const DefineAsync: SymbolList = [
  ['$', 'void', `${EntryPoint}['{0}']`],
  ['yield-async', 'void', 'yield'],
  ['check-sync', 'any', '$$sync'],
]

export class LibAsync extends Module {
  public constructor() {
    super(DefineAsync)
  }

  public sync(result: any) {
    if(result && result.next) {
      return new Stopify(result).syncExec()
    }
    return result
  }
}

