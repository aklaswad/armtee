import fs from 'node:fs'
import path from 'node:path'

type ArmteeLineSignature = "hashy" | "slashy"
type ArmteeTemplateMode = "template" | "logic" | "something"
type ArmteeLineType = "macro" | "script" | "template" | "comment" | "never"

type ArmteeMacro = {
  precompile?: (armtee: Armtee, args: string[], block: ArmteeMacroBlock ) => void | undefined | ArmteeBlock | ArmteeBlock[]
  compile?: (armtee: Armtee, args: string[], block: ArmteeMacroBlock ) => void | undefined | string | string[]
}
type ArmteeFilter = (str: string) => string

type ArmteeBlockMetaInfo = { file?: string, line?: number, type?: string }
type ArmteeTranspileOptions = Record<string, any>
type ArmteePrinterContext = {f: ArmteeFilter, fa: ArmteeFilter }

interface ArmteePrinter extends Function {
  _: ArmteePrinterContext[]
  $: ArmteePrinterContext
  _trace: Function
  __filters: Record<string, ArmteeFilter>
  push: Function
  pop: Function
}

const Sigs :Record<ArmteeLineSignature, Record<ArmteeLineType,string>> = {
  hashy: {
    macro: '##% ',
    script: '##! ',
    template: '##> ',
    comment: '##- ',
    never: ''
  },
  slashy: {
    macro: '//% ',
    script: '//! ',
    template: '//> ',
    comment: '//- ',
    never: ''
  }
}

const RE = {
  hashy: {
    file: {
      something: new RegExp( '^##[->%!] ', 'm' ),
      logic: new RegExp( '^' + Sigs.hashy.template,'m' ),
      template: new RegExp( '^' + Sigs.hashy.script, 'm' ),
    },
    line: {
      macro:    new RegExp( '^' + Sigs.hashy.macro ),
      script:   new RegExp( '^' + Sigs.hashy.script ),
      template: new RegExp( '^' + Sigs.hashy.template ),
      comment:  new RegExp( '^' + Sigs.hashy.comment ),
    }
  },
  slashy: {
    file: {
      something: new RegExp( '^//[-%!>] ', 'm' ),
      logic: new RegExp( '^' + Sigs.slashy.template,'m' ),
      template: new RegExp( '^' + Sigs.slashy.script, 'm' ),
    },
    line: {
      macro:    new RegExp( '^' + Sigs.slashy.macro ),
      script:   new RegExp( '^' + Sigs.slashy.script ),
      template: new RegExp( '^' + Sigs.slashy.template ),
      comment:  new RegExp( '^' + Sigs.slashy.comment ),
    }
  }
}

/**
 * Base class for pre-transpile line/block
 */
export class ArmteeBlock {
  type (): ArmteeLineType { return 'never' }
  txt: string
  src: ArmteeBlockMetaInfo
  dst: ArmteeBlockMetaInfo
  colmap: [number,number][]
  compiled: string[]

  constructor (txt: string, src: ArmteeBlockMetaInfo) {
    this.txt = txt
    this.src = src
    this.dst = {}
    this.colmap = [[1,1]] // src, dst
    this.compiled = []
  }

  parseError (error:string) {
    throw `Armtee template error: ${error} at ${ this.src.file } line ${ this.src.line }`
  }


  precompile (armtee: Armtee, txt: string): ArmteeBlock[] { return [this] }
  compile (armtee: Armtee, txt: string): string[] { return [] }
  postcompile () {}

  _compile (armtee: Armtee, txt: string) {
    const ret = this.compile(armtee, txt)
    this.compiled = ret ? ret : []
    return this.compiled
  }

  compiledLineCount () {
    if ( ! this.compiled ) return 0
    return this.compiled.reduce( (acc,cur) => {
      return acc += cur.split('\n').length
    }, 0 )
  }

  static create ( type: ArmteeLineType, txt: string, src: ArmteeBlockMetaInfo ) {
    switch (type) {
      case 'macro' :
        return new ArmteeMacroBlock(txt, src)
        break
      case 'script' :
        return new ArmteeScriptBlock(txt, src)
        break
      case 'template' :
        return new ArmteeTemplateBlock(txt, src)
        break
      case 'comment' :
        return new ArmteeCommentBlock(txt, src)
        break
      default :
        throw 'unknown block type: ' + type
    }
  }
}

export class ArmteeScriptBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'script' }

  compile (armtee:Armtee, txt:string) {
    const ret = []
    if ( Armtee.debug ) {
      //ret.push( '_trace(' + JSON.stringify(this) + ')' )
    }
    ret.push(this.txt)
    return ret
  }
}

/**
 * @extends ArmteeBlock
 */
export class ArmteeMacroBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'macro' }

  handler: ArmteeMacro | undefined
  args: string[] | undefined

  precompile (armtee :Armtee, txt :string): ArmteeBlock[] {
    const [ command, ...args ] = txt.trim().split(/\s+/)
    if ( !command )
      this.parseError( 'Macro line needs at least 1 words' )

    const handler = __macros[ command.toUpperCase() ]
    if ( !handler ) {
      this.parseError( 'Unknown macro command: ' + command )
    }
    this.handler = handler
    this.args = args
    if ( handler.precompile ) {
      const ret = handler.precompile(armtee, args, this)
      if ( !ret ) return []
      const blocks = Array.isArray(ret) ? ret : [ret]
      blocks.forEach( block => block.src = this.src )
      return blocks
    }
    return [this]
  }

  compile (armtee: Armtee, txt: string): string[] {
    if ( !this.handler ) return []
    if ( this.handler.compile ) {
      const res = this.handler.compile(armtee, this.args || [], this)
      if ( ! res ) {
        return []
      }
      return Array.isArray(res) ? res : [res]
    }
    return []
  }
}

export class ArmteeTemplateBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'template' }

  compile (armtee: Armtee, txt: string) {
    const ret = []
    const parts = txt.split(armtee.runtimeSymbols.tagSeparator[0])
      .flatMap( p => p.split(armtee.runtimeSymbols.tagSeparator[1]))
    let buf = ''
    let offset = 0
    const lenL = armtee.runtimeSymbols.tagSeparator[0].length
    const lenR = armtee.runtimeSymbols.tagSeparator[1].length

    if ( parts.length % 2 === 0 )
      this.parseError( 'Unmatched tag separator' )

    let isText = true
    parts.forEach( str => {
      if ( isText ) {
        const txt = str.replace(new RegExp('([`$])', 'g'), '${"$1"}')
        offset += str.length + lenL
        buf += txt
      }
      else {
        try {
          const fn = new Function(str)
        }
        catch (e) {
          this.parseError( `Tag is not valid JavaScript
-------------
${ str }
-------------
${ e instanceof Error ? e.toString() : e }
-------------
          `)
        }
        this.colmap.push([ offset, buf.length ])
        const exp = '${' + `${armtee.runtimeSymbols.printer}.$.f(${str})}`
        offset += exp.length + lenR
        buf += exp
      }
      isText = !isText
    })
    // JS template literal + String.raw() can ignore almost escape chars, but
    // only backslash at the end is not ignorable. Escape it.
    const script = '`' + buf.replace(/\\$/, '${"\\\\"}') + '`'

    // Make sure this is valid JS fragment
    try {
      const fn = new Function(script)
    }
    catch (e) {
      this.parseError( `Failed to convert template
-------------
${ script }
-------------
${ e instanceof Error ? e.toString() : e }
-------------
      `)
    }
    if ( Armtee.debug ) {
      ret.push( armtee.runtimeSymbols.printer + '._trace(' + JSON.stringify(this) + ')' )
    }
    ret.push( armtee.runtimeSymbols.printer + script )
    return ret
  }
}

export class ArmteeCommentBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'comment' }
  precompile () { return [] }
}

export class ArmteeLineParser {
  buf: { txt: string; meta: ArmteeBlockMetaInfo; }[]
  out: ArmteeBlock[]
  cur: ArmteeLineType
  constructor () {
    this.buf = []
    this.out = []
    this.cur = 'never'
  }

  _addLine (type: ArmteeLineType, txt: string, meta: ArmteeBlockMetaInfo) {
    if ( this.cur === type ) {
      this.buf.push({ txt, meta })
    }
    else {
      if ( this.buf.length > 0 ) {
        if ( this.cur === 'script' ) {
          this.out.push( ArmteeBlock.create(
            this.cur,
            this.buf.map( line => line.txt ).join("\n"),
            this.buf[0].meta
          ))
        }
        else {
          this.out.push( ...this.buf.map( line =>
            ArmteeBlock.create(this.cur, line.txt, line.meta)
          ))
        }
      }
      this.buf = [{ txt, meta }]
      this.cur = type
    }
  }

  /**
   *
   * @param {*} txt
   * @param {*} meta
   * @param {LineSignature} mode
   * @param {*} filemode
   * @returns {?} output
   */
  parse (txt: string, meta: ArmteeBlockMetaInfo, mode:ArmteeLineSignature='hashy', filemode:ArmteeTemplateMode='template') {
    const re = RE[mode].line
    txt.split("\n").forEach( (line, idx) => {
      const _meta = Object.assign( {}, meta, { line: idx + 1, colOffset: 4 } )
      const _meta_wo_prefix = Object.assign( {}, meta, { line: idx + 1, colOffset: 0 } )
      if ( re.macro.test(line) )
        this._addLine('macro', line.slice(4), _meta)
      else if ( re.comment.test(line) )
        this._addLine('comment', line.slice(4), _meta)
      else if ( filemode === 'template' && re.script.test(line) )
        this._addLine('script', line.slice(4), _meta)
      else if ( filemode === 'logic' && re.template.test(line) )
        this._addLine('template', line.slice(4), _meta)
      else
        this._addLine(
          (filemode === 'logic' ? 'script' : 'template'),
          line,
          _meta_wo_prefix)
    })
    this._addLine('never', '', {}) // Flush last buffer
    return this.out
  }
}



/**
 * Transpile and Rendering options
 * @typedef {object} TranspileOptions
 */


const __macros:Record <string, ArmteeMacro> = {}
const __filters:Record <string, ArmteeFilter> = {}
/**
 * Class represents parsed template
 */
export class Armtee {
  static debug = 0

  static fromText (txt: string, meta: ArmteeBlockMetaInfo={}) {
    const mode = Armtee.modeFromText(txt)
    return new Armtee(txt.replace(/\n$/,''), mode[0], mode[1], meta)
  }

  /**
   * Load template from file
   * @param {string} filename - filename to be loaded
   * @param {{depth: number}} options - Internal use
   * @returns {Armtee} new Armtee instance
   */
  static fromFile(filename:string, options:ArmteeTranspileOptions={}) {
    const txt = fs.readFileSync(filename, 'utf-8')
    const armtee = Armtee.fromText(txt, { file: filename, type: 'file' })
    armtee.__depth = options.__depth || 0
    return armtee
  }

  /**
   * Render outputs from template string and data
   * @param {string} tmpl - template
   * @param {any} data - data to be passed to template
   * @param {TranspileOptions} options - option
   * @returns {string} Rendered output
   */
  static render (tmpl:string, data:any, options:ArmteeTranspileOptions) {
    const armtee = this.fromText(tmpl)
    return armtee.render(data, options)
  }

  /**
   * Render outputs from template file and data
   * @param {string} filename - Filename to be loaded
   * @param {any} data - data to be passed to template
   * @param {TranspileOptions} options
   * @returns {string} Rendered output
   */
  static renderFile(filename:string, data:any, options: ArmteeTranspileOptions) {
    const armtee = this.fromFile(filename)
    return armtee.render(data, options)
  }


  blocks: ArmteeBlock[]
  signature: ArmteeLineSignature
  filemode: ArmteeTemplateMode
  runtimeSymbols: Record<string, string | string[]>
  executable: Function | undefined
  rawScript: string
  offset: number
  __depth: number
  constructor ( txt: string, signature: ArmteeLineSignature, filemode: ArmteeTemplateMode, meta={} ) {
    const parser = new ArmteeLineParser()
    const blocks = parser.parse(txt, meta, signature, filemode)
    this.offset = 0
    this.__depth = 0
    this.blocks = blocks
    this.signature = signature
    this.filemode = filemode
    this.rawScript = ''
    this.runtimeSymbols = {
      printer:  '_$',
      root: 'data',
      context: '$c',
      tagSeparator: ['<%','%>'],
    }
  }

  static modeFromText (txt:string): [ArmteeLineSignature, ArmteeTemplateMode] {
    const hashySomething  = RE.hashy.file.something.test(txt)
    const hashyLogic      = RE.hashy.file.logic.test(txt)
    const hashyTemplate   = RE.hashy.file.template.test(txt)
    const slashySomething = RE.slashy.file.something.test(txt)
    const slashyLogic     = RE.slashy.file.logic.test(txt)
    const slashyTemplate  = RE.slashy.file.template.test(txt)
    if ( ( hashySomething && slashySomething )
      || ( hashyTemplate  && hashyLogic )
      || ( slashyTemplate && slashyLogic ) ) {
      throw 'Invalid template: mixed style'
    }
    if ( hashySomething ) {
      return hashyLogic    ? [ 'hashy', 'logic' ]
                           : [ 'hashy', 'template' ]
    }
    else {
      return slashyLogic    ? [ 'slashy', 'logic' ]
                            : [ 'slashy', 'template' ]
    }
  }

  setTagSeparator ( begin:string, end:string ) {
    this.runtimeSymbols.tagSeparator = [ begin, end ]
  }

  compile (options: ArmteeTranspileOptions) {
    //if ( this.executable ) {
    //  return this.executable
    //}

    const js = this.wrap( this.translate(options), options )
    if ( Armtee.debug > 1 ) {
      console.error( 'DEBUG: armtee gerenated render script')
      console.error( '------------------------------------------')
      console.error( js )
    }

    try {
      this.executable = new Function('data', 'printer', js)
      const sig = '/*___ARMTEE___*/'
      this.offset = this.executable.toString().split(sig,2)[0].split('\n').length
      return this.executable
    }
    catch (e) {
      // Find error block by using binary search, since
      // v8/browsers doesn't return error line in `new Function()` ... *sigh*
      // Also tried acorn/esprima/espree to catch error line
      // But they all doesn't have enough compatibility for
      // browsers, at least on my setup...

      const orig = e instanceof Error ? e.message : e

      // At first, inject various type of script snipet which could
      // possibly raise another error at begin of script, and
      // choose one which could raise a error different from original error
      // And then, use binary search for which line is the edge of
      // original error to be shown or not, by injecting error snipet
      const errorRaisers = [ 'for ""', '`${}`', '"']
      let raiser
      let raiserError
      FIND: for ( const r of errorRaisers ) {
        const injectBlock = ArmteeBlock.create('script',r, {})
        try {
          const js = this.translate({
            injectLine: 0,
            inject: injectBlock
          })
          new Function(js)
        }
        catch (e) {
          if ( e instanceof Error ) {
            if ( orig !== e.message) {
              raiserError = e.message
              raiser = injectBlock
              break FIND
            }
          }
          else {
            throw "Armtee: Panic at finding cause of compile error :" + orig
          }
        }
      }
      if ( ! raiser )
        throw "Armtee: Panic at finding cause of compile error :" + orig
      // Binary search. using top(t) and bottom(b)
      let nth, got, t = 0, b = this.blocks.length - 1
      let isOrigError, lastOrig = 0, lastNew = 0
      while ( true ) {
        nth = t + Math.floor((b - t) / 2)
        const js = this.translate({ injectLine: nth, inject: raiser })
        try {
          new Function(js)
        }
        catch(e) {
          if ( !(e instanceof Error) ) {
            throw "Armtee: Panic at finding cause of compile error :" + orig
          }
          got = e.message
        }

        isOrigError = got === orig
        if ( isOrigError ) {
          lastOrig = nth
          b = nth
        }
        else {
          lastNew = nth
          t = nth
        }
        if ( t + 1 >= b ) break
      }
      // Insert error-ish snipet before this block will change the
      // error message, so this block might have something wrong!
      //  ( Sometimes this will point wrong line... )
      const errorBlock = this.blocks[lastNew]

      throw( `Armtee compile error: Got JS compile error around file ${ errorBlock.src.file } line ${ errorBlock.src.line }:
-------------
${ errorBlock.txt }
-------------
ERROR: ${orig}
-------------`)

    }
  }

  wrap (txt: string, options: ArmteeTranspileOptions = {} ) {
    let filterInjection = ''
    if ( options.includeFilters ) {
      filterInjection = Object.keys(__filters)
        .map( f => `String.prototype.$${f} = function () {return (${__filters[f].toString()})(this)}`)
        .join('\n')
    }
    else {
      filterInjection = Object.keys(__filters)
        .map( f => `String.prototype.$${f} = function () {return printer.__filters.${f}(this)}`)
        .join('\n')
    }
    const header = `${filterInjection};((${this.runtimeSymbols.root},${this.runtimeSymbols.printer}) => {`
    this.offset = header.split('\n').length;
    const footer = '})(data,printer)'
    return [ header, '/*___ARMTEE___*/', txt, footer ].join('\n')
  }

  prepare (options:ArmteeTranspileOptions={}) {
    return this.blocks.flatMap( (block, idx) => {
      return block.precompile(this, block.txt)
    })
  }

  translate (options:ArmteeTranspileOptions={}) {
    //if ( this.rawScript ) {
    //  return this.rawScript
    //}

    // This could have a side effect... :thinking:
    let blocks = this.prepare()
    if ( options.inject ) {
      blocks = blocks.flatMap( (block,idx) => {
        if ( options.injectLine === idx ) {
          return [ options.inject, block ]
        }
        return block
      })
    }

    const compiledLines = blocks
      .flatMap( block => block._compile(this, block.txt))
      .filter( str => { return 'undefined' !== typeof str && str !== null })
    let totalLines = 0
    blocks.forEach( b => {
      b.dst.line = totalLines + 1
      totalLines += b.compiledLineCount()
    })
    return this.rawScript = compiledLines.join('\n')
  }

  resolvePos (dstLine:number,dstCol:number) {
    const idx = this.blocks.findIndex( b => b.dst.line && b.dst.line > dstLine - this.offset )
    if ( idx === -1 ) return
    console.error(this.blocks[idx-1])
    return this.blocks[idx-1].src
  }

  _render_core (js: Function, data: any, printer: Function) {
    js( data, printer )
  }


  setUpPrinter (buf: string[],trace: any[]) {
    const printer:ArmteePrinter = function (literals: TemplateStringsArray, ...placeholders: string[]) {
      const raw = String.raw(literals, ...placeholders)
      buf.push(printer.$.fa ? printer.$.fa(raw) : raw)
    }
    printer['_trace'] = function (block: ArmteeBlock) { trace.push(block) }
    printer.__filters = __filters
    printer._ = [] // context stack
    printer.$ = {f: __filters.none, fa: __filters.none } // context
    printer.push = function printerPush () {
      const newContext = Object.assign({}, printer.$)
      printer._.push(printer.$)
      printer.$ = newContext
    }
    printer.pop = function printerPop () {
      const $ = printer._.pop()
      if ( !$ ) throw 'Invalid context'
      printer.$ = $
    }
    return printer
  }

  render (data:any, options:ArmteeTranspileOptions={}) {
    const js = this.compile(options)
    const buf: string[] = []
    const trace: any[] = []
    const printer = this.setUpPrinter(buf, trace)
    try {
      js(data,printer)
    }
    catch (e) {
      if (Armtee.debug > 0 ) {
        const errorBlock = trace[ trace.length - 1 ]
        throw( `Armtee render error: Got JS runtime error around file ${ errorBlock.src.file } line ${ errorBlock.src.line }:
-------------
${ errorBlock.txt }
-------------
ERROR: ${ e instanceof Error ? e.toString() : e}
-------------`)
      }
      else {
        if ( !(e instanceof Error) ) {
          throw e
        }
        if ( e.stack ) {
          let matches
          if ( matches = e.stack.match(/(\d+):(\d+)\)?\n/m) ) {
            const pos = this.resolvePos( parseInt(matches[1]), parseInt(matches[2]) )
            if ( pos ) {
              throw( `Armtee render error: Got JS runtime error "${e}" at file ${pos.file} line ${pos.line}` )
            }
            else {
              throw( `Armtee render error: Got JS runtime error "${e}"` )
            }
          }
        }
        e.toString()
      }
    }
    return buf.join('\n')
  }

  convert (style: ArmteeLineSignature, mode: ArmteeTemplateMode) {
    const buf:string[] = []
    const sigs = Sigs[style]
    this.blocks.forEach( b => {
      const sig = mode === 'logic' && b instanceof ArmteeScriptBlock      ? ''
                : mode === 'template' && b instanceof ArmteeTemplateBlock ? ''
                : sigs[b.type()]
      buf.push( b.txt.replace(/^/m, sig) )

    })
    return buf.join('\n')
  }
  /**
   *
   * @param {string} command
   * @param {ArmteeMacro} macro
   */
  static addMacro( command:string, macro:ArmteeMacro ) {
    __macros[command] = macro
  }

  static addFilter ( name:string, fn: (str:string) => string ) {
    __filters[name] = fn
  }
}

Armtee.addMacro('TAG', {
  compile: (armtee, args) => {
    armtee.setTagSeparator( args[0], args[1] )
  }
})

Armtee.addMacro('ROOT', {
  precompile: (armtee, args, block) => {
    armtee.runtimeSymbols.root = args[0]
  }
})

Armtee.addMacro('FILTER', {
  compile: (armtee, args) => {
    const [ filterName ] = args
    if ( ! __filters[filterName] ) {
      throw 'Unknown filter ' + filterName
    }
    const _$ = armtee.runtimeSymbols.printer
    return [`${_$}.$.f = ${_$}.__filters.${filterName}`]
  }
})

Armtee.addMacro('FILTERALL', {
  compile: (armtee, args) => {
    const [ filterName ] = args
    if ( ! __filters[filterName] ) {
      throw 'Unknown filter ' + filterName
    }
    return [`${armtee.runtimeSymbols.printer}.$.fa = ${armtee.runtimeSymbols.printer}.__filters.${filterName}`]
  }
})

Armtee.addMacro('INCLUDE', {
  precompile: (armtee, args, block) => {
    if ( armtee.__depth > 10 ) {
      throw 'Too deep include'
    }
    if ( block.src.type !== 'file' ) {
      return block.parseError('INCLUDE macro cannot be invoked from non-file template.')
    }
    if ( ! block.src?.file ) {
      return block.parseError('INCLUDE macro cannot be invoked from non-file template.')
    }
    const rootPath = path.dirname(block.src.file)
    const [ filename, context ] = args
    const included = Armtee.fromFile(path.resolve(rootPath, filename), {__depth: armtee.__depth + 1})
    const blocks = included.prepare()
    // Semi-colon is required.
    // Without this ';', got error "_(...) is not a function."
    // TODO: understand why.
    const systemSrc = { file: '__SYSTEM__' }
    return [
      ArmteeBlock.create('script', `;
        ${armtee.runtimeSymbols.printer}.push();
        ((${included.runtimeSymbols.root},${included.runtimeSymbols.printer}) => {`, systemSrc),
      ...blocks,
      ArmteeBlock.create('script', `})( ${context}, ${armtee.runtimeSymbols.printer} )
      ${armtee.runtimeSymbols.printer}.pop()`, systemSrc)
    ]
  }
})

Armtee.addFilter( 'none', str => str )
