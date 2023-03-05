import {
  ArmteeLineSignature,
  ArmteeTemplateMode,
    ArmteeLineType,
    ArmteeBlockMetaInfo,
} from './types'

import { ArmteeBlock } from './block'

export const Sigs :Record<ArmteeLineSignature, Record<ArmteeLineType,string>> = {

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

export const RE = {
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

export function modeFromText (txt:string): [ArmteeLineSignature, ArmteeTemplateMode] {
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

