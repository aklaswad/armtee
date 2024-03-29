import { ATError, ATUnexpectedError } from './error.js'
import {
  ArmteeLineType,
  ArmteeBlockMetaInfo,
  IArmteeBlock,
  IArmteeMacro,
  IArmteeTranspiler
} from './types.js'

/**
 * Base class for pre-transpile line/block
 */
export abstract class ArmteeBlock implements IArmteeBlock {
  abstract type () : ArmteeLineType
  txt: string
  src: ArmteeBlockMetaInfo
  dst: ArmteeBlockMetaInfo
  colMap: [number,number][]
  compiled: undefined | string

  constructor (txt: string, src: ArmteeBlockMetaInfo) {
    this.txt = txt
    this.src = src
    this.dst = {}
    this.colMap = [[1,1]] // src, dst
  }

  parseError (error:string, name:string) {
    const e = new ATError(`Armtee template error: ${error}`, [this.src])
    e.name = name || error.slice(0,20)
    throw e
  }

  async compile (armtee: IArmteeTranspiler, txt: string): Promise<string | void | undefined> { return '' }
  precompile (armtee :IArmteeTranspiler, txt :string) {}

  async _compile (armtee: IArmteeTranspiler, txt: string) {
    return this.compile(armtee, txt).then( ret => {
      if ( ret ) {
        this.compiled = ret
      }
      return this.compiled
    })
  }

  compiledLineCount () {
    if ( ! this.compiled ) return 0
    // TODO: ASAP
    return 1
  }

  static create ( type: ArmteeLineType, txt: string, src: ArmteeBlockMetaInfo ) {
    switch (type) {
      case 'macro' :
        return new ArmteeMacroBlock(txt, src)
      case 'script' :
        return new ArmteeScriptBlock(txt, src)
      case 'template' :
        return new ArmteeTemplateBlock(txt, src)
      case 'comment' :
        return new ArmteeCommentBlock(txt, src)
      default :
        throw new ATUnexpectedError(type as never)
    }
  }
}

export class ArmteeScriptBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'script' }

  async compile (armtee:IArmteeTranspiler, txt:string) {
    const ret = []
    ret.push(this.txt)
    return ret.join('\n')
  }
}

/**
 * @extends ArmteeBlock
 */
export class ArmteeMacroBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'macro' }

  handler: IArmteeMacro | undefined
  args: string[] | undefined

  precompile (armtee :IArmteeTranspiler, txt :string): void {
    const [ command, ...args ] = txt.trim().split(/\s+/)
    if ( !command )
      this.parseError( 'Macro line needs at least 1 words', 'EmptyMacro' )

    const handler = armtee.__macros[ command.toUpperCase() ]
    if ( !handler ) {
      this.parseError( 'Unknown macro command: ' + command, 'UnknownMacro' )
    }
    this.handler = handler
    this.args = args
    if ( handler.precompile ) {
      handler.precompile(armtee, args, this)
    }
    return
  }

  async compile (armtee: IArmteeTranspiler, txt: string) {
    if ( !this.handler || !this.handler.compile ) return undefined
    const res: string | string[] | void | undefined
      = await this.handler.compile(armtee, this.args || [], this)
    if ( Array.isArray(res) ) {
      return res.join('\n')
    }
    else if ('string' === typeof res)
      return res
    else
      return
  }
}

export class ArmteeTemplateBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'template' }

  async compile (armtee: IArmteeTranspiler, txt: string) {
    const ret = []
    const parts = txt.split(armtee.runtimeSymbols.tagSeparator[0])
      .flatMap( p => p.split(armtee.runtimeSymbols.tagSeparator[1]))
    let buf = ''
    let offset = 0
    const lenL = armtee.runtimeSymbols.tagSeparator[0].length
    const lenR = armtee.runtimeSymbols.tagSeparator[1].length

    if ( parts.length % 2 === 0 )
      this.parseError( 'Unmatched tag delimiter', 'UnmatchedTagDelimiter' )

    let isText = true
    parts.forEach( str => {
      if ( isText ) {
        const txt = str.replace(
          new RegExp('\\$\\{|`', 'g'),
          (match) => '${' + armtee.runtimeSymbols.printer + '.$("'+match+'")}')
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
-------------`, 'InvalidTagContent')
        }
        this.colMap.push([ offset, buf.length ])
        const exp = '${' + str + '}'
        offset += exp.length + lenR
        buf += exp
      }
      isText = !isText
    })
    // JS template literal + String.raw() can ignore almost escape chars, but
    // only backslash at the end is not ignorable. Escape it.
    const script = '`' + buf.replace(/\\+$/, (match) => {
      return ('${' + armtee.runtimeSymbols.printer + '.$("bs")}').repeat(match.length)
    }) + '`'

    // Make sure this is valid JS fragment
    try {
      const fn = new Function(script)
    }
    catch (e) {
      // XXX: No chance to come here?
      this.parseError( `Failed to convert template
-------------
${ script }
-------------
${ e instanceof Error ? e.toString() : e }
-------------`, 'WrongTemplateLine')
    }
    ret.push( armtee.runtimeSymbols.printer + script )
    return ret.join('\n')
  }
}

export class ArmteeCommentBlock extends ArmteeBlock {
  type ():ArmteeLineType { return 'comment' }
  async compile () { return }
}
