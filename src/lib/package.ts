import { Module } from "../modules";
import { LibPython } from "./python";
import { LibNode } from "./node";
import { LibMath } from "./math";
import { LibAsync, LibBreakPoint } from "./runtime";

export const site_package = (name: string): Module => {
  switch(name) {
    case 'python': 
    case 'python3': 
      return new LibPython()
    case 'node': 
      return new LibNode();
    case 'math': 
      return new LibMath();
    case 'async': 
      return new LibAsync();
    case 'breakpoint':
      return new LibBreakPoint();
  }
  console.log(`undefined package ${name}`)
  return new Module('unknown', [])
}