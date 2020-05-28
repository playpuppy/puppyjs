import { LibPython } from "./lib/python";
import { LibNode } from "./lib/node";
import { LibMath } from "./lib/math";
import { Module } from "./modules";

export const site_package = (name: string) => {
  if(name === 'python') {
    return new LibPython()
  }
  if(name === 'math') {
    return new LibMath()
  }
  if (name === 'node') {
    return new LibNode()
  }
  console.log(`undefined package ${name}`)
  return new Module([]);
}