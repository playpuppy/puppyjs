import { LibPython } from "./lib/python";
import { LibNode } from "./lib/node";
import { LibMath } from "./lib/math";
import { Module } from "./modules";

export const site_package = (name: string, alias?: string): [string, Module] => {
  if(alias === undefined) {
    alias = name
  }
  if(name === 'python') {
    return [alias, new LibPython()]
  }
  if (name === 'node') {
    return [alias, new LibNode()]
  }
  if(name === 'math') {
    return [alias, new LibMath()]
  }
  console.log(`undefined package ${name}`)
  return [alias, new Module([])]
}