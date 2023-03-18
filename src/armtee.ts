import fs from 'node:fs'
import path from 'node:path'
import {setUpPrinter} from './printer.js'

import {
  ArmteeLineSignature,
  ArmteeTemplateMode,
  ArmteeFilter,
  ArmteeTranspileOptions,
  IArmteeMacro,
  IArmteeBlock,
  IArmteeTranspiler
} from './types.js'

import {
  ArmteeBlock,
  ArmteeScriptBlock,
  ArmteeTemplateBlock,
} from './block.js'

import { ArmteeLineParser, Sigs, modeFromText } from './line-parser.js'

/**
 * Class represents parsed template
 */

export class ArmteeTranspiler implements IArmteeTranspiler {
  debug: number

  static fromText (txt: string,  options:ArmteeTranspileOptions={}) {
    const mode = modeFromText(txt)
    return new this(txt.replace(/\n$/,''), mode[0], mode[1], options)
  }

  /**
   * Load template from file
   * @param {string} filename - filename to be loaded
   * @param {{depth: number}} options - Internal use
   * @returns {Armtee} new Armtee instance
   */
  static fromFile(filename:string, options:ArmteeTranspileOptions={}) {
    const txt = fs.readFileSync(filename, 'utf-8')
    const armtee = this.fromText(txt, { meta:{ file: filename, type: 'file' }})
    armtee.__depth = options.__depth || 0
    return armtee
  }

  blocks: IArmteeBlock[]
  signature: ArmteeLineSignature
  filemode: ArmteeTemplateMode
  runtimeSymbols: Record<string, string | string[]>
  executable: Function | undefined
  rawScript: string
  offset: number
  __filters: Record <string, ArmteeFilter>
  __macros: Record <string, IArmteeMacro>
  __depth: number
  constructor ( txt: string, signature: ArmteeLineSignature, filemode: ArmteeTemplateMode, options: ArmteeTranspileOptions ) {
    const {filters, macros, meta} = options
    const parser = new ArmteeLineParser()
    const blocks = parser.parse(txt, meta || {}, signature, filemode)
    this.offset = 0
    this.__depth = 0
    this.debug = 0
    this.blocks = blocks
    this.signature = signature
    this.filemode = filemode
    this.rawScript = ''
    this.__filters = {}
    this.__macros = {}
    setUpDefaultMacros(this)
    setUpDefaultFilters(this)
    this.importFilters(filters || {})
    this.importMacros(macros || {})
    this.runtimeSymbols = {
      printer:  '_$',
      root: 'data',
      context: '$c',
      tagSeparator: ['<%','%>'],
    }
  }

  importFilters (filters: {[name: string]: ArmteeFilter}) {
    Object.keys(filters).forEach( name => {
      this.addFilter(name, filters[name])
    })
  }

  importMacros (macros: {[name: string]: IArmteeMacro}) {
    Object.keys(macros).forEach( name => {
      this.addMacro(name, macros[name])
    })
  }

  setTagSeparator ( begin:string, end:string ) {
    this.runtimeSymbols.tagSeparator = [ begin, end ]
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
    const inject = options.__inject
    if ( 'undefined' !== typeof inject ) {
      blocks = blocks.flatMap( (block,idx) => {
        if ( options.__injectLine === idx ) {
          return [ inject, block ]
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

  wrap (txt: string, options: ArmteeTranspileOptions ) {
    let filterInjection = ''
    const headerLines = []
    if ( options.__buildType === 'script' ) {
      headerLines.push('#!/usr/bin/env node')
    }
    if ( options.includeFilters ) {
      headerLines.push('const filters = {')
      const filters:string[] = []
      Object.keys(this.__filters).forEach( name => {
        filters.push(`"${name}": ${ this.__filters[name].toString() }`)
      })
      headerLines.push( filters.join('\n'))
      headerLines.push('}')
    }
    headerLines.push( Object.keys(this.__filters)
        .map( f => `String.prototype.$${f} = function () {return printer.filters.${f}(this)}`)
        .join('\n') )
    let executor
    switch ( options.__buildType ) {
      case 'function':
        executor = '_render(data, printer)'
        break
      case 'module':
        executor = [
          setUpPrinter.toString(),
          moduleRunner
        ].join('\n')
        break
      case 'script':
        executor = [
          setUpPrinter.toString(),
          scriptRunner
        ].join('\n')
        break
    }
    const header = `${headerLines.join('\n')};
function _render (${this.runtimeSymbols.root}, ${this.runtimeSymbols.printer}) {`
    this.offset = header.split('\n').length;
    const footer = `}
${executor}
`
    return [ header, '/*___ARMTEE___*/', txt, footer ].join('\n')
  }

  resolvePos (dstLine:number,dstCol:number) {
    const idx = this.blocks.findIndex( b => b.dst.line && b.dst.line > dstLine - this.offset )
    if ( idx === -1 ) return
    //console.error(this.blocks[idx-1])
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

  addMacro( command:string, macro:IArmteeMacro ) {
    this.__macros[command] = macro
    return this
  }

  addFilter ( name:string, fn: (str:string) => string ) {
    this.__filters[name] = fn
    return this
  }
}

function setUpDefaultMacros(armtee:IArmteeTranspiler) {
  armtee.addMacro('TAG', {
    compile: (armtee, args) => {
      armtee.setTagSeparator( args[0], args[1] )
    }
  })

  armtee.addMacro('ROOT', {
    precompile: (armtee, args, block) => {
      armtee.runtimeSymbols.root = args[0]
    }
  })

  armtee.addMacro('FILTER', {
    compile: (armtee, args) => {
      const [ filterName ] = args
      if ( ! armtee.__filters[filterName] ) {
        throw 'Unknown filter ' + filterName
      }
      const _$ = armtee.runtimeSymbols.printer
      return [`${_$}.context.tagFilter = ${_$}.filters.${filterName}`]
    }
  })

  armtee.addMacro('FILTERALL', {
    compile: (armtee, args) => {
      const [ filterName ] = args
      if ( ! armtee.__filters[filterName] ) {
        throw 'Unknown filter ' + filterName
      }
      return [`${armtee.runtimeSymbols.printer}.context.lineFilter = ${armtee.runtimeSymbols.printer}.filters.${filterName}`]
    }
  })

  armtee.addMacro('INCLUDE', {
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
      const included = ArmteeTranspiler.fromFile(path.resolve(rootPath, filename), {__depth: armtee.__depth + 1})
      const blocks = included.prepare()
      // Semi-colon is required.
      // Without this ';', got error "_(...) is not a function."
      // TODO: understand why.
      const systemSrc = { file: '__SYSTEM__' }
      const $armtee = armtee.runtimeSymbols
      const $included = included.runtimeSymbols
      return [
        ArmteeBlock.create('script', `;
          ${$armtee.printer}.pushToContextStack();
          ((${$included.root},${$included.printer}) => {`, systemSrc),
        ...blocks,
        ArmteeBlock.create('script', `})( ${context}, ${$armtee.printer} )
        ${$armtee.printer}.popFromContextStack()`, systemSrc)
      ]
    }
  })
}

function setUpDefaultFilters(armtee:IArmteeTranspiler) {
  armtee.addFilter( 'none', str => str )
}

const moduleRunner = `
export function render (data) {
  const buf = []
  const trace = []
  const printer = setUpPrinter(buf,trace,filters)
  _render(data, printer)
  return buf.join('\\n')
}
`

const scriptRunner = `
process.stdin.setEncoding("utf8");

var lines = [];
var reader = require("readline").createInterface({
  input: process.stdin,
});

reader.on("line", (line) => {
  lines.push(line);
});

reader.on("close", () => {
  const input = lines.join('\\n')
  const data = JSON.parse(input)
  const buf = []
  const trace = []
  const printer = setUpPrinter(buf,trace,filters)
  _render(data, printer)
  console.log( buf.join('\\n') )
});
`
