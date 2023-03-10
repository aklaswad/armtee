import fs from 'node:fs'

import {
  ArmteeBlockMetaInfo,
  ArmteeTranspileOptions,
  IArmteePrinter,
  IArmteeBlock
} from './types.js'

import { ArmteeBlock } from './block.js'
import { modeFromText } from './line-parser.js'
import { ArmteeTranspiler } from './armtee.js'
import { setUpPrinter } from './printer.js'

/**
 * Dynamic compile for tranpiled js and execute render
 */
export class ArmteeRunner extends ArmteeTranspiler {
  static debug = 0

  // TODO: How to call ancestor's static method in TS?
  static fromText (txt: string, options:ArmteeTranspileOptions={}) {
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
    options.meta = { file: filename, type: 'file' }
    const armtee = this.fromText(txt, options)
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
    const runner = ArmteeRunner.fromText(tmpl, options)
    return runner.render(data, options)
  }

  /**
   * Render outputs from template file and data
   * @param {string} filename - Filename to be loaded
   * @param {any} data - data to be passed to template
   * @param {TranspileOptions} options
   * @returns {string} Rendered output
   */

  static renderFile(filename:string, data:any, options: ArmteeTranspileOptions) {
    const runner = ArmteeRunner.fromFile(filename, options)
    return runner.render(data, options)
  }

  compile (options: ArmteeTranspileOptions) {
    //if ( this.executable ) {
    //  return this.executable
    //}

    const js = this.wrap( this.translate(options), { ...options, __buildType: 'function' } )
    if ( this.debug > 1 ) {
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
            __injectLine: 0,
            __inject: injectBlock
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
        const js = this.translate({ __injectLine: nth, __inject: raiser })
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

  _render_core (js: Function, data: any, printer: Function) {
    js( data, printer )
  }

  render (data:any, options:ArmteeTranspileOptions={}) {
    const js = this.compile(options)
    const buf: string[] = []
    const trace: any[] = []
    const printer = setUpPrinter(buf, trace, this.__filters)
    try {
      js(data,printer)
    }
    catch (e) {
      if (this.debug > 0 ) {
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
            let pos
            try {
              pos = this.resolvePos( parseInt(matches[1]), parseInt(matches[2]) )
            }
            catch(_e) {
              throw( `Armtee render error: Got JS runtime error "${e}"` )
            }
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
}