// PContext

class PContext {
  readonly x: string;
  pos: number;
  epos: number;
  headpos: number;
  ptree: PTree | null;
  state: PState | null;
  readonly memos: PMemo[];
  constructor(inputs: string, pos: number, epos: number) {
    this.x = inputs;
    this.pos = pos;
    this.epos = epos;
    this.headpos = pos
    this.ptree = null
    this.state = null
    this.memos = [];
    for (var i = 0; i < 1789; i += 1) {
      this.memos.push(new PMemo());
    }
  }
}

export type PFunc = (px: PContext) => boolean;

const match_empty: PFunc = (px: PContext) => true

const pEmpty = () => {
  return match_empty;
}

const match_fail: PFunc = (px: PContext) => false

const pFail = () => {
  return match_fail;
}

const match_any: PFunc = (px: PContext) => {
  if (px.pos < px.epos) {
    px.pos += 1
    return true
  }
  return false;
}

const pAny = () => {
  return match_any;
}

const match_skip: PFunc = (px: PContext) => {
  px.pos = Math.min(px.headpos, px.epos)
  return true
}

const pSkip = () => {
  return match_skip;
}

/* Char */

const CharCache: { [key: string]: PFunc } = {
  '': match_empty
}

const store = (cache: { [key: string]: PFunc }, key: string, gen: () => PFunc) => {
  if (!(key in cache)) {
    cache[key] = gen();
  }
  return cache[key];
}

const pChar = (text: string) => {
  const clen = text.length;
  return store(CharCache, text, () => (px: PContext) => {
    if (px.x.startsWith(text, px.pos)) {
      px.pos += clen
      return true
    }
    return false
  });
}

/* Range */

const range_max = (chars: string, ranges: string) => {
  const s = chars + ranges;
  var min = 0;
  for (var i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    min = Math.max(min, c);
  }
  return min;
}

const range_bitmap = (chars: string, ranges: string) => {
  const codemax = range_max(chars, ranges) + 1;
  const bitmap = new Uint8Array(((codemax / 8) | 0) + 1);
  bitmap[0] = 2;
  for (var i = 0; i < chars.length; i += 1) {
    const c = chars.charCodeAt(i);
    const n = (c / 8) | 0;
    const mask = 1 << ((c % 8) | 0);
    bitmap[n] |= mask;
  }
  for (var i = 0; i < ranges.length; i += 2) {
    for (var c = ranges.charCodeAt(i); c <= ranges.charCodeAt(i + 1); c += 1) {
      const n = (c / 8) | 0;
      const mask = 1 << ((c % 8) | 0);
      bitmap[n] |= mask;
    }
  }
  return bitmap;
}

const RANGETBL: { [key: string]: string } = {
  '\n': '\\n', '\t': '\\t', '\r': '\\r', '\v': '\\v', '\f': '\\f',
  '\\': '\\\\', ']': '\\]', '-': '\\-'
}

export const keyRange = (chars: string, ranges: string) => {
  const sb = []
  sb.push('[')
  sb.push(translate(chars, RANGETBL))
  const r = ranges
  for (var i = 0; i < r.length; i += 2) {
    sb.push(translate(r[i], RANGETBL))
    sb.push('-')
    sb.push(translate(r[i + 1], RANGETBL))
  }
  sb.push(']')
  return sb.join('')
}

const Bitmaps: { [key: string]: Uint8Array } = {}

const toBitmap = (chars: string, ranges: string) => {
  const key = keyRange(chars, ranges);
  if (!(key in Bitmaps)) {
    Bitmaps[key] = range_bitmap(chars, ranges);
  }
  return Bitmaps[key];
}

const bitmatch = (c: number, bitmap: Uint8Array) => {
  const n = (c / 8) | 0;
  const mask = 1 << ((c % 8) | 0);
  return (n < bitmap.length && (bitmap[n] & mask) === mask);
}

const pRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    if (px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap)) {
      px.pos += 1;
      return true;
    }
    return false;
  }
}

/* And */

const pAnd = (pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    if (pf(px)) {
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      return true
    }
    return false
  }
}

const pNot = (pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ptree = px.ptree
    if (!pf(px)) {
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      px.ptree = ptree
      return true
    }
    return false
  }
}

const pMany = (pf: PFunc) => {
  return (px: PContext) => {
    var pos = px.pos
    var ptree = px.ptree
    while (pf(px) && pos < px.pos) {
      pos = px.pos
      ptree = px.ptree
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    return true
  }
}

const pOneMany = (pf: PFunc) => {
  return (px: PContext) => {
    if (!pf(px)) {
      return false;
    }
    var pos = px.pos
    var ptree = px.ptree
    while (pf(px) && pos < px.pos) {
      pos = px.pos
      ptree = px.ptree
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    return true
  }
}

const pOption = (pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ptree = px.ptree
    if (!pf(px)) {
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      px.ptree = ptree
    }
    return true
  }
}


const pSeq2 = (pf: PFunc, pf2: PFunc) => {
  return (px: PContext) => {
    return pf(px) && pf2(px)
  }
}

const pSeq3 = (pf: PFunc, pf2: PFunc, pf3: PFunc) => {
  return (px: PContext) => {
    return pf(px) && pf2(px) && pf3(px);
  }
}

const pSeq4 = (pf: PFunc, pf2: PFunc, pf3: PFunc, pf4: PFunc) => {
  return (px: PContext) => {
    return pf(px) && pf2(px) && pf3(px) && pf4(px);
  }
}

const pSeq = (...pfs: PFunc[]) => {
  return (px: PContext) => {
    for (const pf of pfs) {
      if (!pf(px)) {
        return false;
      }
    }
    return true;
  }
}

/* Ore */

const pOre2 = (pf: PFunc, pf2: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ptree = px.ptree
    if (pf(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    return pf2(px);
  }
}

const pOre3 = (pf: PFunc, pf2: PFunc, pf3: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ptree = px.ptree
    if (pf(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    if (pf2(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    return pf3(px);
  }
}

const pOre4 = (pf: PFunc, pf2: PFunc, pf3: PFunc, pf4: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    const ptree = px.ptree
    if (pf(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    if (pf2(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    if (pf3(px)) {
      return true;
    }
    px.headpos = Math.max(px.pos, px.headpos)
    px.pos = pos
    px.ptree = ptree
    return pf4(px);
  }
}

const pOre = (...pfs: PFunc[]) => {
  return (px: PContext) => {
    const pos = px.pos
    const ptree = px.ptree
    for (const pf of pfs) {
      if (pf(px)) {
        return true;
      }
      px.headpos = Math.max(px.pos, px.headpos)
      px.pos = pos
      px.ptree = ptree
    }
    return false;
  }
}

/* Dict */

const make_words = (ss: string[]) => {
  const dic: { [key: string]: string[] } = {}
  const sss: string[] = [];
  dic[''] = sss;
  for (const w of ss) {
    sss.push(w);
    if (w.length === 0) {
      return dic;
    }
    const key = w.substring(0, 1);
    if (!(key in dic)) {
      dic[key] = [];
    }
    dic[key].push(w.substring(1));
  }
  return dic;
}

type trie = string[] | { [key: string]: string[] | string };

const make_trie = (ss: string[]): trie => {
  const dic = make_words(ss);
  ss = dic[''];
  if (ss.length < 10) {
    return ss;
  }
  delete dic[''];
  for (const key of Object.keys(dic)) {
    ss = dic[key];
    if (ss.length === 1) {
      (dic as any)[key] = ss[0];
    }
    else {
      (dic as any)[key] = make_trie(ss);
    }
  }
  return dic;
}

export const match_trie = (px: PContext, d: trie): boolean => {
  if (Array.isArray(d)) {
    const inputs = px.x;
    const pos = px.pos;
    for (const w of d) {
      if (inputs.startsWith(w, pos)) {
        px.pos += w.length;
        return true
      }
    }
    return false;
  }
  else if (px.pos < px.epos) {
    const c = px.x[px.pos++];
    const suffix = d[c];
    if (typeof suffix === 'string') {
      if (px.x.startsWith(suffix, px.pos)) {
        px.pos += (suffix.length);
        return true
      }
      return false;
    }
    return suffix !== undefined ? match_trie(px, suffix) : false;
  }
  return false
}

const pDict = (words: string) => {
  const trie = make_trie(words.split(' '));
  if (Array.isArray(trie)) {
    const ss: string[] = trie;
    return (px: PContext) => {
      const pos = px.pos
      for (const s of ss) {
        if (px.x.startsWith(s, pos)) {
          px.pos += s.length;
          return true;
        }
      }
      return false;
    }
  }
  else {
    return (px: PContext) => match_trie(px, trie);
  }
}

/* Ref */

const pRef = (generated: any, uname: string) => {
  if (!(uname in generated)) {
    generated[uname] = (px: PContext) => generated[uname](px);
  }
  return generated[uname];
}

class PMemo {
  key: number;
  pos: number;
  treeState: boolean;
  prev: PTree | null;
  ptree: PTree | null;
  result: boolean;
  constructor() {
    this.key = -1
    this.pos = 0
    this.ptree = null
    this.prev = null
    this.result = false
    this.treeState = false
  }
}

const pMemo = (pf: PFunc, mp: number, mpsize: number) => {
  var disabled = false
  var hit = 0
  var miss = 0
  return (px: PContext) => {
    if (disabled) return pf(px)
    const key = (mpsize * px.pos) + mp
    const m = px.memos[(key % 1789) | 0]
    if (m.key == key) {
      if (m.treeState) {
        if (m.prev === px.ptree) {
          px.pos = m.pos
          px.ptree = m.ptree
          hit += 1
          return m.result
        }
      }
      else {
        px.pos = m.pos;
        return m.result;
      }
    }
    const prev = px.ptree;
    m.result = pf(px);
    m.pos = px.pos
    m.key = key
    if (m.result && prev != px.ptree) {
      m.treeState = true
      m.prev = prev
      m.ptree = px.ptree
    }
    else {
      m.treeState = false
    }
    miss += 1;
    if (miss % 100 === 0 && (hit / miss) < 0.05) {
      disabled = false
    }
    return m.result
  }
}

/* Tree Construction */

class PTree {
  readonly prev: PTree | null;
  readonly tag: string;
  readonly spos: number;
  readonly epos: number;
  readonly child: PTree | null;
  constructor(prev: PTree | null, tag: string, spos: number, epos: number, child: PTree | null) {
    this.prev = prev
    this.tag = tag
    this.spos = spos
    this.epos = epos
    this.child = child
  }

  isEdge() {
    return (this.epos < 0);
  }

  dump(inputs: string) {
    const sb: string[] = []
    if (this.prev !== null) {
      sb.push(this.prev.dump(inputs))
      sb.push(',')
    }
    sb.push(`{#${this.tag} `)
    if (this.child === null) {
      sb.push("'")
      sb.push(inputs.substring(this.spos, this.epos))
      sb.push("'")
    }
    else {
      sb.push(this.child.dump(inputs))
    }
    sb.push('}')
    return sb.join('')
  }
}

const pNode = (pf: PFunc, tag: string, shift: number) => {
  return (px: PContext) => {
    const pos = px.pos
    const prev = px.ptree
    px.ptree = null;
    if (pf(px)) {
      px.ptree = new PTree(prev, tag, pos + shift, px.pos, px.ptree);
      return true;
    }
    return false;
  }
}

const pEdge = (edge: string, pf: PFunc, shift: number) => {
  if (edge === '') {
    return pf;
  }
  return (px: PContext) => {
    const pos = px.pos
    const prev = px.ptree
    px.ptree = null;
    if (pf(px)) {
      if (px.ptree === null) {
        px.ptree = new PTree(null, '', pos + shift, px.pos, px.ptree)
      }
      px.ptree = new PTree(prev, edge, -1, -1, px.ptree)
      return true;
    }
    return false;
  }
}

const pFold = (edge: string, pf: PFunc, tag: string, shift: number) => {
  if (edge !== '') {
    return (px: PContext) => {
      const pos = px.pos
      var pt = px.ptree;
      const prev = pt ? pt.prev : null;
      pt = pt ? (prev ? new PTree(null, pt.tag, pt.spos, pt.epos, pt.child) : pt) : null;
      px.ptree = new PTree(null, edge, -1, -1, pt);
      if (pf(px)) {
        px.ptree = new PTree(prev, tag, pos, px.pos + shift, px.ptree);
        return true;
      }
      return false;
    }
  }
  else {
    return (px: PContext) => {
      const pos = px.pos
      const pt = px.ptree;
      const prev = (pt !== null) ? pt.prev : null;
      px.ptree = pt ? (prev ? new PTree(null, pt.tag, pt.spos, pt.epos, pt.child) : pt) : null;
      if (pf(px)) {
        px.ptree = new PTree(prev, tag, pos, px.pos + shift, px.ptree);
        return true;
      }
      return false;
    }
  }
}

const pAbs = (pf: PFunc) => {
  return (px: PContext) => {
    const ptree = px.ptree
    if (pf(px)) {
      px.ptree = ptree;
      return true;
    }
    return false;
  }
}

// State 

class PState {
  sid: number;
  val: any;
  prev: PState | null;
  constructor(sid: number, val: any, prev: PState | null) {
    this.sid = sid;
    this.val = val;
    this.prev = prev;
  }
}

const getstate = (state: PState | null, sid: number) => {
  while (state !== null) {
    if (state.sid === sid) {
      return state;
    }
    state = state.prev;
  }
  return state;
}

const pSymbol = (pf: PFunc, sid: number) => {
  return (px: PContext) => {
    const pos = px.pos;
    if (pf(px)) {
      px.state = new PState(sid, px.x.substring(pos, px.pos), px.state);
      return true;
    }
    return false;
  }
}

const pScope = (pf: PFunc) => {
  return (px: PContext) => {
    const state = px.state;
    if (pf(px)) {
      px.state = state;
      return true;
    }
    return false;
  }
}

const pExists = (sid: number) => {
  return (px: PContext) => {
    return getstate(px.state, sid) !== null;
  }
}

const pMatch = (sid: number) => {
  return (px: PContext) => {
    const state = getstate(px.state, sid);
    if (state !== null && px.x.startsWith(state.val, px.pos)) {
      px.pos += state.val.length;
      return true;
    }
    return false;
  }
}

const pDef = (name: string, pf: PFunc) => {
  return (px: PContext) => {
    const pos = px.pos
    if (pf(px)) {
      const s = px.x.substring(pos, px.pos);
      if (s.length === 0) {
        return true;
      }
      const ss: string[] = (px as any)[name] || [];
      ss.push(s)
      ss.sort((x, y) => x.length - y.length);
      (px as any)[name] = ss;
      console.log('@TODO ss');
      return true;
    }
    return false;
  }
}

const pIn = (name: string) => {
  return (px: PContext) => {
    const ss = (px as any)[name]
    if (ss) {
      for (const s of ss) {
        if (px.x.startsWith(s, px.pos)) {
          px.pos += s.length;
          return true;
        }
      }
    }
    return false;
  }
}

// Optimized

const pAndChar = (text: string) => {
  return (px: PContext) => {
    return px.x.startsWith(text, px.pos);
  };
}

const pNotChar = (text: string) => {
  return (px: PContext) => {
    return !px.x.startsWith(text, px.pos);
  };
}

const pOptionChar = (text: string) => {
  const clen = text.length;
  return (px: PContext) => {
    if (px.x.startsWith(text, px.pos)) {
      px.pos += clen;
    }
    return true;
  };
}

const pManyChar = (text: string) => {
  const clen = text.length;
  return (px: PContext) => {
    while (px.x.startsWith(text, px.pos)) {
      px.pos += clen;
    }
    return true;
  };
}

const pOneManyChar = (text: string) => {
  const clen = text.length;
  return (px: PContext) => {
    if (!px.x.startsWith(text, px.pos)) {
      return false;
    }
    px.pos += clen;
    while (px.x.startsWith(text, px.pos)) {
      px.pos += clen;
    }
    return true;
  };
}

const pAndRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    return (px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap));
  }
}

const pNotRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    return !(px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap));
  }
}

const pOptionRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    if (px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap)) {
      px.pos += 1;
    }
    return true;
  }
}

const pManyRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    while (px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap)) {
      px.pos += 1;
    }
    return true;
  }
}

const pOneManyRange = (chars: string, ranges = '') => {
  const bitmap = toBitmap(chars, ranges);
  return (px: PContext) => {
    if (px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap)) {
      px.pos += 1;
      while (px.pos < px.epos && bitmatch(px.x.charCodeAt(px.pos), bitmap)) {
        px.pos += 1;
      }
      return true;
    }
    return false;
  }
}

// 
export type Position = {
  position: number;
  column: number;  /* column >=0 */
  row: number;   /* row >= 1 */
}

const getpos = (s: string, pos: number): Position => {
  pos = Math.min(pos, s.length);
  var row = 0;
  var col = 0;
  for (var i = 0; i <= pos; i += 1) {
    if (s.charCodeAt(i) == 10) {
      row += 1;
      col = 0;
    }
    else {
      col += 1;
    }
  }
  return { position: pos, column: col, row: row }
}

// ParseTree

export class ParseTree {
  static readonly EMPTY: ParseTree[] = [];
  tag_: string;
  inputs_: string;
  spos_: number;
  epos_: number;
  urn_: string;
  subs_: ParseTree[];

  public constructor(tag: string, inputs: string='', spos = 0, epos = -1, urn = '(unknown source)') {
    this.tag_ = tag
    this.inputs_ = inputs
    this.spos_ = spos
    this.epos_ = (epos === -1) ? (inputs.length - spos) : epos
    this.urn_ = urn
    this.subs_ = ParseTree.EMPTY;
  }

  public getTag() {
    return this.tag_;
  }

  public is(tag: string) {
    return this.tag_ === tag;
  }

  public has(key: string | number): boolean {
    if (typeof key === 'string') {
      const t = (this as any)[key];
      return (t instanceof ParseTree);
    }
    return (key < this.subs_.length);
  }

  public isEmpty() {
    return this.tag_ === 'empty';
  }

  private newEmpty() {
    return new ParseTree('empty', this.inputs_, this.epos_, this.epos_, this.urn_);
  }

  public get(key: string | number): ParseTree {
    if (typeof key === 'string') {
      if(key.indexOf(',') > 0) {
        const keys = key.split(',')
        for(const k of keys) {
          if(this.has(k)) {
            key = k
            break
          }
        }
      }
      const t = (this as any)[key];
      return (t instanceof ParseTree) ? t as ParseTree : this.newEmpty();
    }
    if (key < this.subs_.length) {
      return this.subs_[key];
    }
    return this.newEmpty();
  }

  public set(key: string, t: ParseTree) {
    if (key === '') {
      if (this.subs_ === ParseTree.EMPTY) {
        this.subs_ = [];
      }
      this.subs_.push(t)
    }
    else {
      (this as any)[key] = t;
    }
  }

  public get2(key: number | string, key2: number | string, perror = (s:string)=>{}) {
    const e = this.get(key)
    if (!e.isEmpty()) {
      return e
    }
    const e2 = this.get(key2)
    if (!e2.isEmpty()) {
      return e2
    }
    //this.perror(pt, 'UndefinedParseTree')
    perror(`${key},${key2}`)
    return e2
  }



  public getNodeSize() {
    return this.subs_.length;
  }

  public subNodes() {
    return this.subs_;
  }

  public append(t: ParseTree, edge: string = '') {
    this.set(edge, t);
  }

  public isSyntaxError() {
    return this.tag_ === 'err'
  }

  public getPosition() : Position {
    return getpos(this.inputs_, this.spos_);
  }

  public getEndPosition(): Position {
    return getpos(this.inputs_, this.epos_);
  }

  public length() {
    return this.epos_ - this.spos_;
  }

  public keys() {
    return Object.keys(this).filter(x => !x.endsWith('_'));
  }

  public getToken(key?: string | number): string {
    if (!key) {
      return this.inputs_.substring(this.spos_, this.epos_);
    }
    return this.get(key).getToken();
  }

  public trim(shift=0, end_shift=0): ParseTree {
    if(shift!==0) {
      const pos = this.spos_ + shift
      if(0<= pos && pos < this.inputs_.length) {
        this.spos_ = pos
      }
    }
    if (end_shift !== 0) {
      const pos = this.epos_ + end_shift
      if (0 <= pos && pos < this.inputs_.length) {
        this.epos_ = pos
      }
    }
    return this
  }


  public toString() {
    const sb: string[] = [];
    this.strOut(sb);
    return sb.join('');
  }

  protected strOut(sb: string[]) {
    var c = 0;
    sb.push("[#")
    sb.push(this.tag_)
    for (const node of this.subNodes()) {
      c += 1;
      sb.push(` `);
      node.strOut(sb);
    }
    for (const key of this.keys()) {
      c += 1;
      sb.push(` ${key} = `);
      (this as any)[key].strOut(sb);
    }
    if (c == 0) {
      sb.push(' ');
      sb.push(quote(this.inputs_.substring(this.spos_, this.epos_)))
    }
    sb.push("]")
  }

  public message(msg = 'Syntax Error') {
    const p = this.getPosition();
    const pos = p.position;
    const row = p.row
    const col = p.column;
    return `(${this.urn_}:${row}+${col}) ${msg}`
  }
}

const PTreeConv = (pt: PTree, urn: string, inputs: string): ParseTree => {
  if (pt.prev !== null) {
    var ct = pt
    while (ct.prev !== null) {
      ct = ct.prev
    }
    return PTree2ParseTree('', urn, inputs, ct.spos, pt.epos, pt)
  }
  if (pt.isEdge()) {
    const ct = PTreeConv(pt.child!, urn, inputs)
    const t = new ParseTree('', inputs, ct.spos_, ct.epos_, urn)
    t.set(pt.tag, ct)
    return t
  }
  else {
    return PTree2ParseTree(pt.tag, urn, inputs, pt.spos, pt.epos, pt.child)
  }
}

const PTree2ParseTree = (tag: string, urn: string, inputs: string, spos: number, epos: number, sub: PTree | null) => {
  const t = new ParseTree(tag, inputs, spos, epos, urn);
  while (sub !== null) {
    if (sub.isEdge()) {
      const tt = PTreeConv(sub.child!, urn, inputs);
      t.set(sub.tag, tt);
    }
    else {
      t.set('', PTree2ParseTree(sub.tag, urn, inputs,
        sub.spos, sub.epos, sub.child))
    }
    sub = sub.prev;
  }
  const tail = t.subs_.length - 1
  for (var i = 0; i < (tail + 1) / 2; i += 1) {
    const t0 = t.subs_[i];
    t.subs_[i] = t.subs_[tail - i]
    t.subs_[tail - i] = t0;
  }
  return t;
}

const translate = (s: string, dic: { [key: string]: string }) => {
  var foundESC = false;
  for (const c of Object.keys(dic)) {
    if (s.indexOf(c) !== -1) {
      foundESC = true;
      break;
    }
  }
  if (foundESC) {
    const sb = []
    for (const c of s) {
      if (c in dic) {
        sb.push(dic[c]);
      }
      else {
        sb.push(c);
      }
    }
    return sb.join('')
  }
  return s;
}

const ESCTBL = { '\n': '\\n', '\t': '\\t', '\r': '\\r', '\v': '\\v', '\f': '\\f', '\\': '\\\\', "'": "\\'" }

export const quote = (s: string) => {
  return "'" + translate(s, ESCTBL) + "'"
}

export type Parser = (inputs: string, options?: any) => ParseTree;

const pRule = (peg: { [key: string]: PFunc }, name: string, e: PFunc) => {
  peg[name] = e;
}

export class PAsm {

  public static pRule = pRule;
  public static pEmpty = pEmpty;
  public static pFail = pFail;
  public static pAny = pAny;
  public static pSkip = pSkip;
  public static pChar = pChar;
  public static pRange = pRange;
  public static pRef = pRef;
  public static pMemo = pMemo;

  public static pAnd = pAnd;
  public static pNot = pNot;
  public static pMany = pMany;
  public static pOneMany = pOneMany;
  public static pOption = pOption;

  public static pSeq = pSeq;
  public static pSeq2 = pSeq2;
  public static pSeq3 = pSeq3;
  public static pSeq4 = pSeq4;

  public static pOre = pOre;
  public static pOre2 = pOre2;
  public static pOre3 = pOre3;
  public static pOre4 = pOre4;
  public static pDict = pDict;

  public static pNode = pNode;
  public static pEdge = pEdge;
  public static pFold = pFold;
  public static pAbs = pAbs;

  /* Symbol */
  public static pSymbol = pSymbol;
  public static pScope = pScope;
  public static pExists = pExists;
  public static pMatch = pMatch;

  /* Optimize */

  public static pAndChar = pAndChar;
  public static pNotChar = pNotChar;
  public static pOptionChar = pOptionChar;
  public static pManyChar = pManyChar;
  public static pOneManyChar = pOneManyChar;

  public static pAndRange = pAndRange;
  public static pNotRange = pNotRange;
  public static pOptionRange = pOptionRange;
  public static pManyRange = pManyRange;
  public static pOneManyRange = pOneManyRange;

  public static pDef = pDef;
  public static pIn = pIn;

  public static generate = (generated: { [key: string]: PFunc }, start: string): Parser => {
    const pf = generated[start];
    return (inputs: string, options?: any) => {
      options = options || {};
      const pos: number = options.pos || options.spos || 0;
      const epos: number = options.epos || (inputs.length - pos);
      const px = new PContext(inputs, pos, epos);
      if (pf(px)) {
        if (!px.ptree) {
          px.ptree = new PTree(null, "", pos, px.pos, null);
        }
      }
      else {
        px.ptree = new PTree(null, "err", px.headpos, px.headpos, null);
      }
      const conv: ((t: PTree, urn: string, inputs: string) => ParseTree) = options.conv || PTreeConv;
      const urn = options.urn || '(unknown source)';
      return conv(px.ptree!, urn, inputs);
    }
  }

  public static example = (generated: { [key: string]: PFunc }, start: string, input: string) => {
    const p = PAsm.generate(generated, start);
    const t = p(input)
    console.log(t.toString())
  }
}


//-------------------------------------------------------------- 
//import { PAsm, ParseTree } from 'pegtree';

export const generate = PAsm.generate;

export const TPEG = (peg?: any) => {
  if (peg === undefined) {
    peg = {}
  }
  pRule(peg,"S",pRange(" \t​\v\r　",""));
  pRule(peg,"BLOCKCOMMENT",pSeq3(pChar("/*"),pMany(pSeq2(pNotChar("*/"),pAny())),pChar("*/")));
  pRule(peg,"EOF",pNot(pAny()));
  pRule(peg,"W",pRange("_","AZaz09"));
  pRule(peg,"Defined",pSeq3(pChar("「"),pNode(pOneMany(pSeq2(pNotChar("」"),pAny())),"Name",0),pChar("」")));
  pRule(peg,"KATA",pRange("","ァヶ"));
  pRule(peg,"KANJI",pRange("々〇〻ー","㐀䶵一龠"));
  pRule(peg,"HIRA",pRange("","ぁん"));
  pRule(peg,"INDENT",pSeq2(pChar("\n"),pOneManyRange(" \t　","")));
  pRule(peg,"PRE",pRange("+-~＋ー〜",""));
  pRule(peg,"HEX",pRange("","afAF09"));
  pRule(peg,"DQ",pRange("\"”“＂",""));
  pRule(peg,"SQ",pRange("\'’‘＇",""));
  pRule(peg,"DIGIT",pRange("_","09０９"));
  pRule(peg,"BINARY",pSeq4(pChar("0"),pRange("bB",""),pRange("01",""),pMany(pSeq2(pManyChar("_"),pRange("01","")))));
  pRule(peg,"PROD",pOre(pChar("//"),pChar("<<"),pChar(">>"),pChar("／／"),pChar("＜＜"),pChar("＞＞"),pRange("*/%^&＊・／％＾＆×÷","")));
  pRule(peg,"SUM",pRange("+-|＋ー｜",""));
  pRule(peg,"LF",pOre2(pChar("\n"),pRef(peg,"EOF")));
  pRule(peg,"NAME",pSeq2(pRange("_","AZaz"),pManyRange("_","AZaz09")));
  pRule(peg,"NOT",pOre2(pSeq2(pChar("not"),pNotRange("_","AZaz09")),pRange("!！","")));
  pRule(peg,"ESCAPE",pSeq2(pChar("\\"),pOre(pSeq2(pEmpty(),pRange("\'\"\\bfnrt","")),pSeq4(pEmpty(),pRange("","03"),pRange("","07"),pRange("","07")),pSeq3(pEmpty(),pRange("","07"),pRange("","07")),pSeq2(pEmpty(),pRange("","07")),pSeq(pEmpty(),pRange("uU",""),pRange("","afAF09"),pRange("","afAF09"),pRange("","afAF09"),pRange("","afAF09")))));
  pRule(peg,"EXPONENT",pSeq4(pRange("eE",""),pOptionRange("+-",""),pNotChar("_"),pOneManyRange("_","09０９")));
  pRule(peg,"HEXADECIMAL",pSeq4(pChar("0"),pRange("xX",""),pRange("","afAF09"),pMany(pSeq2(pManyChar("_"),pRange("","afAF09")))));
  pRule(peg,"DECIMAL",pSeq3(pNotChar("_"),pRange("_","09０９"),pManyRange("_","09０９")));
  pRule(peg,"AND",pOre3(pSeq2(pChar("and"),pNotRange("_","AZaz09")),pChar("&&"),pChar("＆＆")));
  pRule(peg,"OR",pOre3(pSeq2(pChar("or"),pNotRange("_","AZaz09")),pChar("||"),pChar("｜｜")));
  pRule(peg,"LINECOMMENT",pSeq2(pRange("#＃",""),pMany(pSeq2(pNot(pRef(peg,"LF")),pAny()))));
  pRule(peg,"STRING",pOre2(pRef(peg,"ESCAPE"),pSeq2(pNotRange("\"\n\\",""),pAny())));
  pRule(peg,"ZSTRING",pOre2(pRef(peg,"ESCAPE"),pSeq3(pNotRange("\"”“＂",""),pNotRange("\n\\",""),pAny())));
  pRule(peg,"CHAR",pOre2(pRef(peg,"ESCAPE"),pSeq2(pNotRange("\'\n\\",""),pAny())));
  pRule(peg,"ZCHAR",pOre2(pRef(peg,"ESCAPE"),pSeq3(pNotRange("\'’‘＇",""),pNotRange("\n\\",""),pAny())));
  pRule(peg,"_",pMany(pOre3(pRange(" \t​\v\r　",""),pRef(peg,"BLOCKCOMMENT"),pRef(peg,"LINECOMMENT"))));
  pRule(peg,"__",pMany(pOre3(pRange("\r ​　","\t\v"),pRef(peg,"BLOCKCOMMENT"),pRef(peg,"LINECOMMENT"))));
  pRule(peg,"EOL",pSeq3(pRef(peg,"_"),pRef(peg,"LF"),pMany(pSeq2(pRef(peg,"_"),pRef(peg,"LF")))));
  pRule(peg,"Identifier",pSeq2(pNode(pRef(peg,"NAME"),"Name",0),pRef(peg,"_")));
  pRule(peg,"UIdentifier",pSeq2(pNode(pSeq2(pOneManyRange("_々〇〻ー","ぁんァヶ㐀䶵一龠"),pManyRange("_","AZaz09")),"UName",0),pRef(peg,"_")));
  pRule(peg,"\"(\"",pSeq2(pRange("(（",""),pRef(peg,"__")));
  pRule(peg,"\")\"",pSeq2(pRange(")）",""),pRef(peg,"_")));
  pRule(peg,"\":\"",pSeq2(pRange(":：",""),pRef(peg,"_")));
  pRule(peg,"\";\"",pOneMany(pSeq2(pRange(";；",""),pRef(peg,"_"))));
  pRule(peg,"ModuleName",pSeq3(pRange("_","AZaz"),pNode(pManyRange("._","09AZaz"),"ModuleName",-1),pRef(peg,"_")));
  pRule(peg,"Wildcard",pSeq3(pChar("*"),pNode(pEmpty(),"",-1),pRef(peg,"_")));
  pRule(peg,"\",\"",pSeq2(pRange(",，、",""),pRef(peg,"_")));
  pRule(peg,"\"[\"",pSeq2(pRange("[［",""),pRef(peg,"__")));
  pRule(peg,"\"]\"",pSeq2(pRange("]］",""),pRef(peg,"_")));
  pRule(peg,"\"{\"",pSeq2(pRange("{｛",""),pRef(peg,"__")));
  pRule(peg,"StringExpr",pOre2(pSeq3(pChar("\""),pNode(pSeq2(pMany(pRef(peg,"STRING")),pChar("\"")),"QString",-1),pRef(peg,"_")),pSeq4(pRange("\"”“＂",""),pNode(pMany(pRef(peg,"ZSTRING")),"ZString",0),pRange("\"”“＂",""),pRef(peg,"_"))));
  pRule(peg,"CharExpr",pOre2(pSeq3(pChar("\'"),pNode(pSeq2(pMany(pRef(peg,"CHAR")),pChar("\'")),"QString",-1),pRef(peg,"_")),pSeq4(pRange("\'’‘＇",""),pNode(pMany(pRef(peg,"ZCHAR")),"ZChar",0),pRange("\'’‘＇",""),pRef(peg,"_"))));
  pRule(peg,"\"}\"",pSeq2(pRange("}｝",""),pRef(peg,"_")));
  pRule(peg,"LongString",pOre2(pSeq4(pChar("\'\'\'"),pNode(pSeq2(pMany(pOre3(pRef(peg,"ESCAPE"),pSeq2(pNotRange("\\\'",""),pAny()),pSeq2(pNotChar("\'\'\'"),pChar("\'")))),pChar("\'")),"MultiString",-1),pChar("\'\'"),pRef(peg,"_")),pSeq4(pChar("\"\"\""),pNode(pSeq2(pMany(pOre3(pRef(peg,"ESCAPE"),pSeq2(pNotRange("\\\"",""),pAny()),pSeq2(pNotChar("\"\"\""),pChar("\"")))),pChar("\"")),"MultiString",-1),pChar("\"\""),pRef(peg,"_"))));
  pRule(peg,"\".\"",pSeq2(pRange(".．。",""),pRef(peg,"_")));
  pRule(peg,"IntExpr",pSeq2(pNode(pOre3(pRef(peg,"HEXADECIMAL"),pRef(peg,"BINARY"),pRef(peg,"DECIMAL")),"Int",0),pRef(peg,"_")));
  pRule(peg,"TrueExpr",pSeq4(pRange("Tt",""),pChar("rue"),pNode(pEmpty(),"TrueExpr",-4),pRef(peg,"_")));
  pRule(peg,"FalseExpr",pSeq4(pRange("Ff",""),pChar("alse"),pNode(pEmpty(),"FalseExpr",-5),pRef(peg,"_")));
  pRule(peg,"NullExpr",pSeq2(pNode(pDict("None null"),"Null",0),pRef(peg,"_")));
  pRule(peg,"EQ",pOre(pSeq2(pChar("="),pOre2(pSeq2(pChar("="),pOptionChar("=")),pSeq2(pEmpty(),pNotChar("=")))),pSeq2(pChar("＝"),pOre2(pChar("＝"),pSeq2(pEmpty(),pNotChar("＝")))),pSeq2(pChar("!="),pOptionChar("=")),pChar("！＝"),pChar("≠"),pSeq2(pChar("<"),pOre2(pSeq2(pChar("="),pNotChar("=")),pSeq2(pEmpty(),pNotChar("<")))),pSeq2(pChar("＜"),pOre2(pChar("＝"),pSeq2(pEmpty(),pNotChar("＜")))),pChar("≦"),pSeq2(pChar(">"),pOre2(pSeq2(pChar("="),pNotChar("=")),pSeq2(pEmpty(),pNotChar(">")))),pSeq2(pChar("＞"),pOre2(pChar("＝"),pSeq2(pEmpty(),pNotChar("＞")))),pChar("≧"),pSeq2(pChar(":="),pNotChar("=")),pSeq3(pOption(pSeq3(pChar("not"),pNotRange("_","AZaz09"),pRef(peg,"_"))),pChar("in"),pNotRange("_","AZaz09")),pSeq3(pChar("is"),pNotRange("_","AZaz09"),pOption(pSeq3(pRef(peg,"_"),pChar("not"),pNotRange("_","AZaz09"))))));
  pRule(peg,"\"=\"",pSeq3(pRange("=＝",""),pNotRange("=＝",""),pRef(peg,"_")));
  pRule(peg,"\"[<\"",pSeq2(pRange("<[［＜",""),pRef(peg,"_")));
  pRule(peg,"\">]\"",pSeq2(pRange("]>］＞",""),pRef(peg,"_")));
  pRule(peg,"\"->\"",pSeq3(pRange("=-",""),pChar(">"),pRef(peg,"_")));
  pRule(peg,"BreakStatement",pSeq3(pChar("break"),pNotRange("_","AZaz09"),pNode(pRef(peg,"_"),"Break",-5)));
  pRule(peg,"ContinueStatement",pSeq3(pChar("continue"),pNotRange("_","AZaz09"),pNode(pRef(peg,"_"),"Continue",-8)));
  pRule(peg,"PassStatement",pSeq3(pChar("pass"),pNotRange("_","AZaz09"),pNode(pRef(peg,"_"),"Pass",-4)));
  pRule(peg,"YieldStatement",pSeq3(pChar("yield"),pNotRange("_","AZaz09"),pNode(pRef(peg,"_"),"Yield",-5)));
  pRule(peg,"VarType",pSeq3(pNode(pDict("const let var"),"",0),pNotRange("_","AZaz09"),pRef(peg,"_")));
  pRule(peg,"SelfAssignOp",pSeq2(pNode(pSeq2(pOre(pChar("<<"),pChar(">>"),pChar("**"),pChar("//"),pRange("+=*/%&|^＋＝＊／％＆｜＾×÷","")),pRange("=＝","")),"",0),pRef(peg,"_")));
  pRule(peg,"Name",pOre3(pRef(peg,"Identifier"),pRef(peg,"Defined"),pRef(peg,"UIdentifier")));
  pRule(peg,"FRACTION",pOre2(pSeq4(pManyRange("_","09０９"),pRef(peg,"\".\""),pNotChar("_"),pOneManyRange("_","09０９")),pSeq4(pRange("_","09０９"),pManyRange("_","09０９"),pRef(peg,"\".\""),pNotChar("."))));
  pRule(peg,"ImportDecl",pSeq3(pChar("import"),pNotRange("_","AZaz09"),pNode(pSeq3(pRef(peg,"_"),pEdge("name",pRef(peg,"ModuleName"),0),pOption(pSeq4(pChar("as"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("alias",pRef(peg,"Name"),0)))),"ImportDecl",-6)));
  pRule(peg,"Names",pNode(pSeq2(pRef(peg,"Name"),pMany(pSeq3(pChar(","),pRef(peg,"_"),pRef(peg,"Name")))),"",0));
  pRule(peg,"LambdaParams",pNode(pSeq2(pOption(pRef(peg,"Name")),pMany(pSeq2(pRef(peg,"\",\""),pRef(peg,"Name")))),"Param",0));
  pRule(peg,"FLOAT",pSeq2(pNotChar("_"),pOre2(pSeq2(pRef(peg,"FRACTION"),pOption(pRef(peg,"EXPONENT"))),pSeq2(pOneManyRange("_","09０９"),pRef(peg,"EXPONENT")))));
  pRule(peg,"FromImportDecl",pSeq3(pChar("from"),pNotRange("_","AZaz09"),pNode(pSeq(pRef(peg,"_"),pEdge("name",pRef(peg,"ModuleName"),0),pChar("import"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("names",pOre2(pRef(peg,"Names"),pRef(peg,"Wildcard")),0)),"FromDecl",-4)));
  pRule(peg,"FloatExpr",pSeq2(pNode(pRef(peg,"FLOAT"),"Double",0),pRef(peg,"_")));
  pRule(peg,"Number",pOre2(pRef(peg,"FloatExpr"),pRef(peg,"IntExpr")));
  pRule(peg,"Block",pNode(pScope(pSeq3(pSymbol(pRef(peg,"INDENT"),0),pOre2(pSeq3(pRef(peg,"Statement"),pMany(pSeq2(pRef(peg,"\";\""),pRef(peg,"Statement"))),pOption(pRef(peg,"\";\""))),pSeq2(pRef(peg,"_"),pAnd(pRef(peg,"EOL")))),pMany(pSeq2(pMatch(0),pOre2(pSeq3(pRef(peg,"Statement"),pMany(pSeq2(pRef(peg,"\";\""),pRef(peg,"Statement"))),pOption(pRef(peg,"\";\""))),pSeq2(pRef(peg,"_"),pAnd(pRef(peg,"EOL")))))))),"Block",0));
  pRule(peg,"NLExpr",pOre2(pSeq(pChar("(*"),pRef(peg,"_"),pNode(pOneMany(pSeq2(pNot(pSeq2(pManyRange(" \t​\v\r　",""),pChar("*)"))),pAny())),"NLExpr",0),pManyRange(" \t​\v\r　",""),pChar("*)"),pRef(peg,"_")),pSeq2(pChar("[*"),pNode(pSeq(pRef(peg,"_"),pRef(peg,"Expression"),pMany(pSeq3(pRef(peg,"\",\""),pRef(peg,"__"),pRef(peg,"Expression"))),pChar("*]"),pRef(peg,"_")),"NLSuffixExpr",-2))));
  pRule(peg,"GroupExpr",pNode(pSeq(pRef(peg,"\"(\""),pRef(peg,"Expression"),pMany(pSeq3(pRef(peg,"\",\""),pRef(peg,"__"),pRef(peg,"Expression"))),pRef(peg,"__"),pRef(peg,"\")\"")),"Tuple",0));
  pRule(peg,"ForExpr",pSeq3(pChar("for"),pNotRange("_","AZaz09"),pNode(pSeq(pRef(peg,"_"),pEdge("each",pRef(peg,"Name"),0),pRef(peg,"__"),pChar("in"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("list",pRef(peg,"Expression"),0),pRef(peg,"__"),pOption(pSeq4(pChar("if"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("cond",pRef(peg,"Expression"),0))),pRef(peg,"__")),"ForExpr",-3)));
  pRule(peg,"ListExpr",pNode(pSeq(pRef(peg,"\"[\""),pOption(pSeq2(pRef(peg,"Expression"),pMany(pSeq3(pRef(peg,"\",\""),pRef(peg,"__"),pRef(peg,"Expression"))))),pOption(pRef(peg,"\",\"")),pRef(peg,"__"),pRef(peg,"\"]\"")),"List",0));
  pRule(peg,"KeyValue",pNode(pSeq3(pEdge("name",pOre3(pRef(peg,"Name"),pRef(peg,"StringExpr"),pRef(peg,"CharExpr")),0),pRef(peg,"\":\""),pEdge("value",pRef(peg,"Expression"),0)),"KeyValue",0));
  pRule(peg,"DataExpr",pNode(pSeq(pRef(peg,"\"{\""),pOption(pSeq2(pRef(peg,"KeyValue"),pMany(pSeq3(pRef(peg,"\",\""),pRef(peg,"__"),pRef(peg,"KeyValue"))))),pOption(pRef(peg,"\",\"")),pRef(peg,"__"),pRef(peg,"\"}\"")),"Data",0));
  pRule(peg,"FormatContent3",pOre2(pSeq3(pChar("{"),pRef(peg,"Expression"),pChar("}")),pNode(pMany(pSeq3(pNotChar("\'\'\'"),pNotChar("{"),pAny())),"StringPart",0)));
  pRule(peg,"FormatContent1",pOre2(pSeq3(pChar("{"),pRef(peg,"Expression"),pChar("}")),pNode(pMany(pSeq3(pNotChar("\'"),pNotChar("{"),pAny())),"StringPart",0)));
  pRule(peg,"FormatContent3D",pOre2(pSeq3(pChar("{"),pRef(peg,"Expression"),pChar("}")),pNode(pMany(pSeq3(pNotChar("\"\"\""),pNotChar("{"),pAny())),"StringPart",0)));
  pRule(peg,"FormatContent1D",pOre2(pSeq3(pChar("{"),pRef(peg,"Expression"),pChar("}")),pNode(pMany(pSeq3(pNotChar("\""),pNotChar("{"),pAny())),"StringPart",0)));
  pRule(peg,"PowExpr",pSeq2(pRef(peg,"UnaryExpr"),pMany(pSeq2(pChar("**"),pFold("left",pSeq3(pEdge("name",pNode(pEmpty(),"Name",-2),-2),pRef(peg,"_"),pEdge("right",pRef(peg,"UnaryExpr"),0)),"Infix",-2)))));
  pRule(peg,"ProdExpr",pSeq2(pRef(peg,"PowExpr"),pMany(pFold("left",pSeq3(pEdge("name",pNode(pRef(peg,"PROD"),"Name",0),0),pRef(peg,"_"),pEdge("right",pRef(peg,"PowExpr"),0)),"Infix",0))));
  pRule(peg,"SumExpr",pSeq2(pRef(peg,"ProdExpr"),pMany(pSeq2(pRange("+-|＋ー｜",""),pFold("left",pSeq3(pEdge("name",pNode(pEmpty(),"Name",-1),-1),pRef(peg,"_"),pEdge("right",pRef(peg,"ProdExpr"),0)),"Infix",-1)))));
  pRule(peg,"EqExpr",pSeq2(pRef(peg,"SumExpr"),pMany(pFold("left",pSeq3(pEdge("name",pNode(pRef(peg,"EQ"),"Name",0),0),pRef(peg,"_"),pEdge("right",pRef(peg,"SumExpr"),0)),"Infix",0))));
  pRule(peg,"AndExpr",pSeq2(pRef(peg,"NotExpr"),pMany(pFold("left",pSeq3(pRef(peg,"AND"),pRef(peg,"_"),pEdge("right",pRef(peg,"NotExpr"),0)),"And",0))));
  pRule(peg,"Operator",pSeq2(pRef(peg,"AndExpr"),pMany(pFold("left",pSeq3(pRef(peg,"OR"),pRef(peg,"_"),pEdge("right",pRef(peg,"AndExpr"),0)),"Or",0))));
  pRule(peg,"ListArgument",pSeq2(pChar("*"),pNode(pSeq2(pRef(peg,"_"),pRef(peg,"Expression")),"ListArgument",-1)));
  pRule(peg,"NamedArgument",pNode(pSeq3(pEdge("name",pRef(peg,"Name"),0),pRef(peg,"\"=\""),pEdge("value",pRef(peg,"Expression"),0)),"KeyValue",0));
  pRule(peg,"NamedArguments",pNode(pSeq3(pOption(pSeq2(pRef(peg,"\",\""),pRef(peg,"__"))),pRef(peg,"NamedArgument"),pMany(pSeq3(pRef(peg,"\",\""),pRef(peg,"__"),pRef(peg,"NamedArgument")))),"Data",0));
  pRule(peg,"Decorator",pSeq2(pChar("@"),pNode(pSeq3(pEdge("name",pRef(peg,"Name"),0),pOption(pSeq3(pRef(peg,"\"(\""),pEdge("params",pRef(peg,"Arguments"),0),pRef(peg,"\")\""))),pRef(peg,"__")),"Decorator",-1)));
  pRule(peg,"_ParamType",pFold("",pSeq3(pRef(peg,"\"[<\""),pOption(pSeq2(pRef(peg,"Type"),pMany(pSeq2(pRef(peg,"\",\""),pRef(peg,"Type"))))),pRef(peg,"\">]\"")),"ParamType",0));
  pRule(peg,"FuncParams",pNode(pSeq(pRef(peg,"\"(\""),pOption(pRef(peg,"FuncParam")),pMany(pSeq3(pRef(peg,"\",\""),pRef(peg,"__"),pRef(peg,"FuncParam"))),pRef(peg,"__"),pRef(peg,"\")\"")),"FuncParam",0));
  pRule(peg,"ElifStatements",pNode(pOneMany(pRef(peg,"ElifStatement")),"",0));
  pRule(peg,"Expressions",pNode(pSeq2(pRef(peg,"Expression"),pOneMany(pSeq2(pRef(peg,"\",\""),pRef(peg,"Expression")))),"Tuple",0));
  pRule(peg,"ControlStatement",pOre(pRef(peg,"ReturnStatement"),pRef(peg,"BreakStatement"),pRef(peg,"ContinueStatement"),pRef(peg,"PassStatement"),pRef(peg,"YieldStatement")));
  pRule(peg,"LeftHand",pSeq2(pRef(peg,"Name"),pMany(pOre2(pFold("recv",pSeq2(pRef(peg,"\".\""),pEdge("name",pRef(peg,"Name"),0)),"GetExpr",0),pFold("recv",pSeq3(pRef(peg,"\"[\""),pEdge("index",pRef(peg,"Expression"),0),pRef(peg,"\"]\"")),"IndexExpr",0)))));
  pRule(peg,"Source",pSeq3(pOption(pRef(peg,"EOL")),pNode(pMany(pSeq4(pRef(peg,"Statement"),pMany(pSeq2(pRef(peg,"\";\""),pRef(peg,"Statement"))),pOption(pRef(peg,"\";\"")),pRef(peg,"EOL"))),"Source",0),pRef(peg,"EOF")));
  pRule(peg,"FormatString",pSeq3(pRange("Ff",""),pOre2(pSeq2(pChar("\'"),pOre2(pSeq3(pChar("\'\'"),pNode(pMany(pRef(peg,"FormatContent3")),"Format",0),pChar("\'\'\'")),pSeq3(pEmpty(),pNode(pMany(pRef(peg,"FormatContent1")),"Format",0),pChar("\'")))),pSeq2(pChar("\""),pOre2(pSeq3(pChar("\"\""),pNode(pMany(pRef(peg,"FormatContent3D")),"Format",0),pChar("\"\"\"")),pSeq3(pEmpty(),pNode(pMany(pRef(peg,"FormatContent1D")),"Format",0),pChar("\""))))),pRef(peg,"_")));
  pRule(peg,"ClassDecl",pSeq3(pChar("class"),pNotRange("_","AZaz09"),pNode(pSeq(pRef(peg,"_"),pEdge("name",pRef(peg,"Name"),0),pOption(pSeq3(pRef(peg,"\"(\""),pEdge("extends",pRef(peg,"Name"),0),pRef(peg,"\")\""))),pRef(peg,"\":\""),pOre2(pRef(peg,"Block"),pRef(peg,"Statement"))),"ClassDecl",-5)));
  pRule(peg,"LambdaExpression",pSeq3(pChar("lambda"),pNotRange("_","AZaz09"),pNode(pSeq4(pRef(peg,"_"),pOption(pEdge("params",pRef(peg,"LambdaParams"),0)),pRef(peg,"\":\""),pEdge("body",pOre2(pRef(peg,"Block"),pRef(peg,"Expression")),0)),"FuncExpr",-6)));
  pRule(peg,"ListForExpr",pNode(pSeq(pRef(peg,"\"[\""),pRef(peg,"__"),pEdge("append",pRef(peg,"Expression"),0),pRef(peg,"__"),pOneMany(pRef(peg,"ForExpr")),pRef(peg,"\"]\"")),"ListForExpr",0));
  pRule(peg,"Constant",pOre(pRef(peg,"FormatString"),pRef(peg,"LongString"),pSeq2(pRef(peg,"StringExpr"),pOption(pSeq2(pChar("*"),pFold("",pSeq2(pRef(peg,"_"),pRef(peg,"Expression")),"Mul",-1)))),pRef(peg,"CharExpr"),pRef(peg,"Number"),pRef(peg,"TrueExpr"),pRef(peg,"FalseExpr"),pRef(peg,"NullExpr")));
  pRule(peg,"NotExpr",pOre2(pNode(pSeq3(pRef(peg,"NOT"),pRef(peg,"_"),pRef(peg,"NotExpr")),"Not",0),pRef(peg,"EqExpr")));
  pRule(peg,"Arguments",pNode(pSeq3(pOption(pSeq2(pNot(pSeq3(pRef(peg,"NAME"),pRef(peg,"_"),pChar("="))),pRef(peg,"Expression"))),pMany(pSeq4(pRef(peg,"\",\""),pRef(peg,"__"),pNot(pSeq3(pRef(peg,"NAME"),pRef(peg,"_"),pChar("="))),pRef(peg,"Expression"))),pOption(pOre2(pRef(peg,"ListArgument"),pRef(peg,"NamedArguments")))),"Arguments",0));
  pRule(peg,"PrimaryType",pOre2(pSeq2(pNode(pSeq3(pRef(peg,"\"(\""),pOption(pSeq2(pRef(peg,"Type"),pMany(pSeq2(pRef(peg,"\",\""),pRef(peg,"Type"))))),pRef(peg,"\")\"")),"TupleType",0),pMany(pRef(peg,"_ParamType"))),pSeq3(pNode(pRef(peg,"NAME"),"BaseType",0),pRef(peg,"_"),pMany(pRef(peg,"_ParamType")))));
  pRule(peg,"FuncDecl",pNode(pSeq(pOption(pEdge("deco",pRef(peg,"Decorator"),0)),pOption(pSeq3(pChar("async"),pNotRange("_","AZaz09"),pEdge("async",pRef(peg,"_"),-5))),pChar("def"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("name",pRef(peg,"Name"),0),pEdge("params",pRef(peg,"FuncParams"),0),pRef(peg,"\":\""),pEdge("body",pOre2(pRef(peg,"Block"),pRef(peg,"Statement")),0)),"FuncDecl",0));
  pRule(peg,"ElseStatement",pNode(pSeq(pOre2(pMatch(0),pRef(peg,"LF")),pChar("else"),pNotRange("_","AZaz09"),pRef(peg,"_"),pRef(peg,"\":\""),pOre2(pRef(peg,"Block"),pRef(peg,"Statement"))),"Else",0));
  pRule(peg,"ReturnStatement",pSeq3(pChar("return"),pNotRange("_","AZaz09"),pNode(pSeq2(pRef(peg,"_"),pOption(pEdge("expr",pOre2(pRef(peg,"Expressions"),pRef(peg,"Expression")),0))),"Return",-6)));
  pRule(peg,"MultiAssignment",pNode(pSeq3(pEdge("left",pNode(pSeq2(pRef(peg,"LeftHand"),pOneMany(pSeq2(pRef(peg,"\",\""),pRef(peg,"LeftHand")))),"",0),0),pRef(peg,"\"=\""),pEdge("right",pOre2(pRef(peg,"Expressions"),pRef(peg,"Expression")),0)),"MultiAssignment",0));
  pRule(peg,"VarDecl",pNode(pSeq(pOption(pEdge("anno",pRef(peg,"Decorator"),0)),pOption(pEdge("type",pRef(peg,"VarType"),0)),pEdge("left",pRef(peg,"Name"),0),pRef(peg,"\"=\""),pEdge("right",pRef(peg,"Expression"),0)),"VarDecl",0));
  pRule(peg,"Assignment",pNode(pSeq4(pEdge("left",pRef(peg,"LeftHand"),0),pOption(pRef(peg,"\":\"")),pRef(peg,"\"=\""),pEdge("right",pRef(peg,"Expression"),0)),"Assignment",0));
  pRule(peg,"SelfAssignment",pNode(pSeq3(pEdge("left",pRef(peg,"LeftHand"),0),pEdge("name",pRef(peg,"SelfAssignOp"),0),pEdge("right",pRef(peg,"Expression"),0)),"SelfAssignment",0));
  pRule(peg,"AssignmentStatement",pOre4(pRef(peg,"MultiAssignment"),pRef(peg,"VarDecl"),pRef(peg,"Assignment"),pRef(peg,"SelfAssignment")));
  pRule(peg,"Primary",pOre(pRef(peg,"NLExpr"),pRef(peg,"GroupExpr"),pRef(peg,"ListForExpr"),pSeq2(pRef(peg,"ListExpr"),pOption(pSeq2(pChar("*"),pFold("",pSeq2(pRef(peg,"_"),pRef(peg,"Expression")),"Mul",-1)))),pRef(peg,"DataExpr"),pRef(peg,"Constant"),pRef(peg,"Name")));
  pRule(peg,"Expression",pOre2(pRef(peg,"LambdaExpression"),pSeq2(pRef(peg,"Operator"),pOption(pSeq3(pChar("if"),pNotRange("_","AZaz09"),pFold("then",pSeq(pRef(peg,"_"),pEdge("cond",pRef(peg,"Expression"),0),pChar("else"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("else",pRef(peg,"Expression"),0)),"IfExpr",-2))))));
  pRule(peg,"FuncType",pSeq2(pRef(peg,"PrimaryType"),pMany(pFold("",pSeq2(pRef(peg,"\"->\""),pRef(peg,"Type")),"FuncType",0))));
  pRule(peg,"SuffixExpr",pSeq2(pRef(peg,"Primary"),pMany(pOre(pFold("recv",pSeq(pRef(peg,"\".\""),pEdge("name",pRef(peg,"Name"),0),pRef(peg,"\"(\""),pEdge("params",pRef(peg,"Arguments"),0),pRef(peg,"__"),pRef(peg,"\")\"")),"MethodExpr",0),pFold("recv",pSeq2(pRef(peg,"\".\""),pEdge("name",pRef(peg,"Name"),0)),"GetExpr",0),pFold("name",pSeq4(pRef(peg,"\"(\""),pEdge("params",pRef(peg,"Arguments"),0),pRef(peg,"__"),pRef(peg,"\")\"")),"ApplyExpr",0),pFold("recv",pSeq(pRef(peg,"\"[\""),pOption(pEdge("left",pRef(peg,"Expression"),0)),pRef(peg,"\":\""),pOption(pEdge("right",pRef(peg,"Expression"),0)),pRef(peg,"\"]\"")),"Slice",0),pFold("recv",pSeq3(pRef(peg,"\"[\""),pEdge("index",pRef(peg,"Expression"),0),pRef(peg,"\"]\"")),"IndexExpr",0)))));
  pRule(peg,"UnaryExpr",pOre2(pSeq2(pRange("+-~＋ー〜",""),pNode(pSeq3(pEdge("name",pNode(pEmpty(),"Name",-1),-1),pRef(peg,"_"),pEdge("expr",pRef(peg,"UnaryExpr"),0)),"Unary",-1)),pRef(peg,"SuffixExpr")));
  pRule(peg,"Type",pSeq2(pRef(peg,"FuncType"),pOption(pFold("",pOneMany(pSeq3(pChar("|"),pRef(peg,"_"),pRef(peg,"Type"))),"UnionType",0))));
  pRule(peg,"FuncParam",pNode(pSeq3(pEdge("name",pRef(peg,"Name"),0),pOption(pSeq2(pRef(peg,"\":\""),pEdge("type",pRef(peg,"Type"),0))),pOption(pSeq2(pRef(peg,"\"=\""),pEdge("value",pRef(peg,"Expression"),0)))),"Param",0));
  pRule(peg,"ElifStatement",pNode(pSeq(pOre2(pMatch(0),pRef(peg,"LF")),pChar("elif"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("cond",pRef(peg,"Expression"),0),pRef(peg,"\":\""),pEdge("then",pOre2(pRef(peg,"Block"),pRef(peg,"Statement")),0)),"Elif",0));
  pRule(peg,"IfStatement",pSeq3(pChar("if"),pNotRange("_","AZaz09"),pNode(pSeq(pRef(peg,"_"),pEdge("cond",pRef(peg,"Expression"),0),pRef(peg,"\":\""),pEdge("then",pOre2(pRef(peg,"Block"),pRef(peg,"Statement")),0),pOption(pEdge("elif",pRef(peg,"ElifStatements"),0)),pOption(pEdge("else",pRef(peg,"ElseStatement"),0))),"If",-2)));
  pRule(peg,"ForStatement",pSeq3(pChar("for"),pNotRange("_","AZaz09"),pNode(pSeq(pRef(peg,"_"),pEdge("each",pRef(peg,"Names"),0),pChar("in"),pNotRange("_","AZaz09"),pRef(peg,"_"),pEdge("list",pRef(peg,"Expression"),0),pRef(peg,"\":\""),pEdge("body",pOre2(pRef(peg,"Block"),pRef(peg,"Statement")),0),pOption(pEdge("else",pRef(peg,"ElseStatement"),0))),"For",-3)));
  pRule(peg,"WhileStatement",pSeq3(pChar("while"),pNotRange("_","AZaz09"),pNode(pSeq(pRef(peg,"_"),pEdge("cond",pRef(peg,"Expression"),0),pRef(peg,"\":\""),pEdge("body",pOre2(pRef(peg,"Block"),pRef(peg,"Statement")),0),pOption(pEdge("else",pRef(peg,"ElseStatement"),0))),"While",-5)));
  pRule(peg,"Statement",pOre(pRef(peg,"ClassDecl"),pRef(peg,"ImportDecl"),pRef(peg,"FromImportDecl"),pRef(peg,"FuncDecl"),pRef(peg,"IfStatement"),pRef(peg,"ForStatement"),pRef(peg,"WhileStatement"),pRef(peg,"ControlStatement"),pRef(peg,"AssignmentStatement"),pNode(pRef(peg,"Expression"),"Expression",0)));
  return peg;
}
