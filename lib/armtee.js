const Sigs = {
  hashy: {
    macro: '##% ',
    script: '##! ',
    template: '##> ',
    comment: '### ',
  },
  slashy: {
    macro: '//% ',
    script: '//! ',
    template: '//> ',
    comment: '//# ',
  }
}
const RE = {
  hashy: {
    file: {
      something: new RegExp( '^##[>%!#] ', 'm' ),
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
      something: new RegExp( '^//[/%!>] ', 'm' ),
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

class LineParser {
  constructor () {
    this.init()
  }

  init () {
    this.buf = []
    this.out = []
    this.cur = ''
  }

  _addLine (type, txt, meta) {
    if ( this.cur === type ) {
      this.buf.push([ txt, meta])
    }
    else {
      if ( this.buf.length > 0 ) {
        if ( this.cur === 'script' ) {
          this.out.push({
            type: this.cur,
            meta: this.buf[0][1],
            txt: this.buf.map( l => l[0] ).join("\n")
          })
        }
        else {
          this.out.push( ...this.buf.map( l => ({
            type: this.cur,
            meta: l[1],
            txt: l[0]
          })))

        }
      }
      this.buf = [[ txt, meta ]]
      this.cur = type
    }
  }

  parse (txt, meta, mode='hashy', filemode='template') {
    const re = RE[mode].line
    txt.split("\n").forEach( (line, idx) => {
      const _meta = Object.assign( {}, meta, { line: idx + 1 } )
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
          _meta)
    })
    this._addLine('') // Flush last buffer
    return this.out
  }
}

class Armtee {
  compileError (block, error) {
    throw `Armtee template error: ${error} at ${ block.meta.file } line ${ block.meta.line }`
  }

/*
  static fromFile (filepath) {
    const txt = fs.readFileSync(filepath, 'utf-8')
    return Armtee.fromText(txt, { file: filepath })
  }
*/
  // meta should looks like `{ file: filepath }`
  static fromText (txt, meta) {
    const mode = Armtee.modeFromText(txt)
    return new Armtee(txt, mode[0], mode[1], meta)
  }

  constructor ( txt, signature, filemode, meta={} ) {
    const parser = new LineParser()
    const blocks = parser.parse(txt, meta, signature, filemode)
    this.blocks = blocks
    this.signature = signature
    this.filemode = filemode
    this.printer = '_'
    this.js = this.compile()
  }

  static modeFromText (txt) {
    const hashySomething  = RE.hashy.file.something.test(txt)
    const hashyLogic      = RE.hashy.file.logic.test(txt)
    const hashyTemplate   = RE.hashy.file.template.test(txt)
    const slashySomething = RE.slashy.file.something.test(txt)
    const slashyLogic     = RE.slashy.file.logic.test(txt)
    const slashyTemplate  = RE.slashy.file.template.test(txt)
    if ( ( hashySomething && slashySomething )
      || ( hashyTemplate && hashyLogic )
      || ( slashyTemplate && slashyLogic ) ) {
      throw 'Invalid template: mixed style'
    }
    if ( hashySomething ) {
      return hashyLogic    ? [ 'hashy', 'logic' ]
           : hashyTemplate ? [ 'hashy', 'template' ]
           :                 [ 'hashy' ]
    }
    else if ( slashySomething ) {
      return slashyLogic    ? [ 'slashy', 'logic' ]
           : slashyTemplate ? [ 'slashy', 'template' ]
           :                  [ 'slashy' ]
    }
    else {
      return []
    }
  }

  setTagSeparator ( begin, end ) {
    const isRe = begin instanceof RegExp
    this.sep = isRe  ? begin
             : end   ? new RegExp( `(?:${begin}|${end})` )
             :         new RegExp(begin)
  }

  handleTemplate (block) {
    const parts = block.txt.split(this.sep)
    const buf = []
    if ( parts.length % 2 === 0 )
      this.compileError( block, 'Unmatched tag separator' )
    let isText = true
    parts.forEach( str => {
      if ( isText ) {
        buf.push( str.replaceAll(new RegExp('([`$])', 'g'), '${"$1"}') )
      }
      else {
        buf.push( '${' + str + '}' )
      }
      isText = !isText
    })
    // String.raw could not handle last backslash. Escape it.
    const script = buf.join('').replace(/\\$/, '${"\\"}')
    this.buf.push( this.printer + '`' + script + '`' )
  }

  handleInclude (block, filename) {}
  handleScript (block) {
    this.buf.push(block.txt)
  }

  handleMacro (block) {
    const [ command, ...args ] = block.txt.trim().split(/\s+/)
    if ( !command )
      this.compileError( block, 'Macro line needs at least 1 words' )

    switch ( command.toUpperCase() ) {
      case 'SEP' :
        this.setTagSeparator( ...args )
        break
      case 'INCLUDE' :
        this.handleInclude(block, ...args)
        break
      case 'ROOT' :
        this.root = args[0]
        break
      case 'FILTER' :
        this.addFilter(block, ...args)
        break
      default :
        this.compileError( block, 'Unknown macro command: ' + command )
    }
  }

  compile () {
    const js = this.compileCore()
    return new Function (this.root, this.printer, js)
  }

  compileCore () {
    this.buf = []
    this.blocks.forEach( b => {
      switch (b.type) {
        case 'macro' :
          this.handleMacro(b)
          break
        case 'template' :
          this.handleTemplate(b)
          break
        case 'script' :
          this.handleScript(b)
          break
        case 'comment' :
          break
        default :
          throw 'unknown block type: ' + b.type
      }
    })
    return this.buf.join('\n')
  }

  render (data) {
    const buf = []
    this.js( data, function (...args) { buf.push(String.raw(...args)) } )
    console.error(buf.join('\n'))
  }

  convert (style, mode) {
    const buf = []
    const sigs = Sigs[style]
    this.blocks.forEach( b => {
      const sig = mode === 'logic' && b.type === 'script'      ? ''
                : mode === 'template' && b.type === 'template' ? ''
                : sigs[b.type]
      buf.push( b.txt.replace(/^/m, sig) )

    })
    return buf.join('\n')
  }
}

module.exports = Armtee
