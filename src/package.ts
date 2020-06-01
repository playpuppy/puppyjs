import { Module } from "./modules";
import { LibPython } from "./lib/python";
import { LibNode } from "./lib/node";
import { LibMath } from "./lib/math";
import { LibAsync } from "./lib/runtime";

export const site_package = (name: string): Module => {
  switch(name) {
    case 'python': return new LibPython()
    case 'node': return new LibNode()
    case 'math': return new LibMath()
    case 'asSync': return new LibAsync()
  }
  console.log(`undefined package ${name}`)
  return new Module([])
}