import { ParseTree } from "./puppy-pasm"

export const stringfy = (buffers: string[]) => {
  return buffers.join('')
}

export const quote = (s: string) => {
  s = s.replace(/'/g, "\\'")
  return `'${s}'`
}

const TOKENS: {[key:string]: string} = {
  'is': '==',
  'is not': '!=',
  '＋': '+', '＊': '+', 
  '×': '*', '÷': '/',
}

export const normalToken = (s: string) => {
  if (s in TOKENS) return TOKENS[s]
  return s
}

export const isInfix = (pt: ParseTree) => {
  const tag = pt.getTag()
  if (tag === 'Infix' || tag === 'And' || tag === 'Or') {
    return true;
  }
  return false;
}
