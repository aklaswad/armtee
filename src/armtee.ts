import fs from 'node:fs'
import path from 'node:path'
import {
  ArmteeLineSignature,
  ArmteeTemplateMode,
  ArmteeFilter,
  ArmteeBlockMetaInfo,
  ArmteeTranspileOptions,
  ArmteePrinter
} from './types'

import {ArmteeBlock, ArmteeScriptBlock, ArmteeTemplateBlock, ArmteeMacro, __macros } from './block'
import { ArmteeLineParser, Sigs, modeFromText } from './line-parser'

/**
 * Transpile and Rendering options
 * @typedef {object} TranspileOptions
 */

const __filters:Record <string, ArmteeFilter> = {}
/**
 * Class represents parsed template
 */
export class Armtee {
  static debug = 0

  static fromText (txt: string, meta: ArmteeBlockMetaInfo={}) {
    const mode = modeFromText(txt)
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
      buf.push( b.txt.replace(/^/mg, sig) )

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
