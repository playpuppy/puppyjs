import { Parser, ParseTree } from "./puppy-pasm"
import { PuppyParser } from "./parser"
import { Desugar } from "./desugar"
import { Language, Module, Code } from "./modules"
import { site_package } from "./package"
import { Generator, Environment as Compiler } from "./generator"
import { JSGenerator } from "./compiler"
import { Stopify } from "./stopify"

export { Language, Module, Parser, Compiler, Code, ParseTree, Stopify, site_package}

export class Origami {
  lang: Language
  generator: Generator
  parsers: Parser[] = []

  public constructor(lang: Language, generator?: Generator) {
    this.lang = lang
    this.generator = generator ? generator : new JSGenerator()
    this.generator.setLanguage(this.lang)
  }

  public addParser(parser: Parser) {
    this.parsers.push(parser)
  }

  private parse(source: string) {
    const tree = PuppyParser(source)
    if (tree.isSyntaxError()) {
      for (const p of this.parsers) {
        const pt = p(source)
        if (!pt.isSyntaxError()) {
          return pt
        }
      }
    }
    return tree
  }

  public compile(source: string) {
    var tree = this.parse(source)
    tree = Desugar.ExpressionToReturn(tree, 'TopLevelReturn')
    this.generator.init()
    return this.generator.generate(tree)
  }
}

