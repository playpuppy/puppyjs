import { Module, SymbolList, EntryPoint } from '../modules'
import { Stopify } from '../stopify'
//import * as fs from 'fs'

const DefineContinuation: SymbolList = [
  ['$', 'void', `${EntryPoint}['{0}']`],
  ['yield-async', 'void', 'yield'],
  ['check-sync', 'any', '$$sync'],
]

export class LibContinuation extends Module {
  public constructor() {
    super(DefineContinuation)
  }

  public sync(result: any) {
    if(result && result.next) {
      return new Stopify(result).syncExec()
    }
    return result
  }

}

