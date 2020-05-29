import { ParseTree } from "./puppy-pasm"

export class Desugar {
  static ExpressionToReturn(pt: ParseTree, tag = 'Return') {
    if (pt.is('Expression')) {
      pt.tag_ = tag
      return pt
    }
    const trees = pt.subNodes()
    if (trees.length > 0) {
      Desugar.ExpressionToReturn(trees[trees.length - 1], tag)
    }
    return pt
  }
}
