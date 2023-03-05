import fs from 'node:fs'
import path from 'node:path'
import {
  ArmteeLineSignature,
  ArmteeTemplateMode,
  ArmteeFilter,
  ArmteeBlockMetaInfo,
  ArmteeTranspileOptions,
} from './types'

import {
  ArmteeBlock,
  ArmteeScriptBlock,
  ArmteeTemplateBlock,
  ArmteeMacro,
  __macros
} from './block'
import { ArmteeLineParser, Sigs, modeFromText } from './line-parser'

export const __filters:Record <string, ArmteeFilter> = {}
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