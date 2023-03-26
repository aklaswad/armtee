import * as fs from 'node:fs'

import {
  ArmteeBlockMetaInfo,
  ArmteeTranspileOptions,
  IArmteePrinter,
  IArmteeBlock
} from './types.js'

import { ATError } from './error.js'
import { ArmteeBlock } from './block.js'
import { modeFromText } from './line-parser.js'
import { ArmteeTranspiler } from './armtee.js'
import { setUpPrinter } from './printer.js'

// Need to make AsyncFunction constructor by hand.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
// Type annotation was taken from here (unresolved issue though, at least this can stop TS warnings )
// https://www.reddit.com/r/typescript/comments/qwe3bc/typing_of_async_function_constructor_with/
const AsyncFunction:new (...args: any[]) => (...args: any[]) => Promise<any>
  = Object.getPrototypeOf(async function(){}).constructor

/**
 * Dynamic compile for transpiled js and execute render
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
  static async render (tmpl:string, data:any, options:ArmteeTranspileOptions) {
    const runner = ArmteeRunner.fromText(tmpl, options)
    return await runner.render(data, options)
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

  async compile (options: ArmteeTranspileOptions) {
    //if ( this.executable ) {
    //  return this.executable
    //}

    const js = this.wrap( await this.translate(options), { ...options, __buildType: 'function' } )
    if ( this.debug > 0 ) {
      console.error( `DEBUG: armtee generated render script
------------------------------------------
${js}
`)
    }

    try {
      this.executable = new AsyncFunction('data', 'printer', js)
      const sig = '/*___ARMTEE___*/'
      this.offset = this.executable.toString().split(sig,2)[0].split('\n').length
      return this.executable
    }
    catch (e) {
      // v8/browsers doesn't return error line in `new Function()`
      //              ******sigh******
      // Also tried acorn/esprima/espree to catch error line
      // But they all doesn't have enough compatibility for
      // browsers, at least on my setup...

      // Let's try to find error position by another way.

      const orig = e instanceof Error ? e.message : e

      // At first, inject various type of script snippet which could
      // possibly raise another error at begin of script, and
      // choose one which raised an error different from original error.
      // And then, use binary search for which line is the edge of
      // original error to be shown or not, by injecting error snippet

      // Should it be a simple throw? I'm not sure...
      const errorRaisers = [ 'for ""', '`${}`', '"' ]
      let raiser
      let raiserError
      FIND: for ( const r of errorRaisers ) {
        const injectBlock = ArmteeBlock.create('script',r, {})
        try {
          const js = await this.translate({
            __injectLine: 0,
            __inject: injectBlock
          })
          new AsyncFunction(js)
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
            /* c8 ignore next 4 */
            const ae = new ATError("Panic at finding cause of compile error : Error was unexpected" + orig)
            ae.name = "PanicAtCompileErrorHandling"
            throw ae
          }
        }
      }
      if ( ! raiser ) {
        /* c8 ignore next 4 */
        const ae = new ATError("Panic at finding cause of compile error : No error position found:" + orig)
        ae.name = "PanicAtCompileErrorHandling"
        throw ae
      }

      // Binary search. using top(t) and bottom(b)
      let nth, got, t = 0, b = this.blocks.length - 1
      let isOrigError, lastOrig = 0, lastNew = 0

      while ( true ) {
        nth = t + Math.floor((b - t) / 2)
        const js = this.translate({ __injectLine: nth, __inject: raiser })
        try {
          new AsyncFunction(js)
        }
        catch(e) {
          if ( !(e instanceof Error) ) {
            /* c8 ignore next 4 */
            const ae = new ATError( "Armtee: Panic at finding cause of compile error : Not expected:" + orig )
            ae.name = "PanicAtCompileErrorHandling"
            throw ae
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
      // Insert error-ish snippet before this block will change the
      // error message, so this block might have something wrong!
      //  ( Sometimes this will point wrong line... )
      const errorBlock = this.blocks[lastNew]

      const ae = new ATError( `Armtee compile error: Got JS compile error around file ${ errorBlock.src.file } line ${ errorBlock.src.line }:
-------------
${ errorBlock.txt }
-------------
ERROR: ${orig}
-------------`, [errorBlock.src])
      ae.name = "CompileError"
      throw ae

    }
  }

  parseJSError (e:any) {
    if ( !(e instanceof Error) ) {
      return e
    }
    if ( e.stack ) {
      let matches
      if ( matches = e.stack.match(/(\d+):(\d+)\)?\n/m) ) {
        let pos
        try {
          pos = this.resolvePos( parseInt(matches[1]), parseInt(matches[2]) )
        }
        catch(_e) {
          return `Armtee render error: Got JS runtime error "${e}"`
        }
        if ( pos ) {
          return `Armtee render error: Got JS runtime error "${e}" at file ${pos.file} line ${pos.line}`
        }
        else {
          return `Armtee render error: Got JS runtime error "${e}"`
        }
      }
    }
    return e.toString()
  }

  async render (data:any, options:ArmteeTranspileOptions={}) {
    this.initialize()
    const js = await this.compile(options)
    if ( 'undefined' === typeof js ) {
      const ae = new ATError('Cannot get compiled artifact')
      ae.name = 'ExecutableIsUndefined'
      throw ae
    }
    const buf: string[] = []
    const printer = setUpPrinter(buf, this.__filters)
    try {
      await js(data,printer)
    }
    catch (e) {
      throw this.parseJSError(e)
    }
    return buf.join('\n')
  }
}
