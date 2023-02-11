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
  static debug = 0
  static __macros = {}

  parseError (block, error) {
    throw `Armtee template error: ${error} at ${ block.meta.file } line ${ block.meta.line }`
  }

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
      this.parseError( block, 'Unmatched tag separator' )
    let isText = true
    parts.forEach( str => {
      if ( isText ) {
        buf.push( str.replaceAll(new RegExp('([`$])', 'g'), '${"$1"}') )
      }
      else {
        try {
          const fn = new Function(str)
        }
        catch (e) {
          this.parseError(block, `Tag is not valid JavaScript
-------------
${ str }
-------------
${ e.toString() }
-------------
          `)
        }
        buf.push( '${' + str + '}' )
      }
      isText = !isText
    })
    // String.raw could not handle last backslash. Escape it.
    const script = '`' + buf.join('').replace(/\\$/, '${"\\"}') + '`'

    // Make sure this is valid JS fragment
    try {
      const fn = new Function(script)
    }
    catch (e) {
      this.parseError(block, `Failed to convert template
-------------
${ block.txt }
-------------
${ e.toString() }
-------------
      `)
    }
    if ( Armtee.debug ) {
      this.buf.push(this.printer + '._trace(' + JSON.stringify(block) + ')' )
    }
    this.buf.push( this.printer + script )
  }

  handleScript (block) {
    if ( Armtee.debug ) {
      this.buf.push(this.printer + '._trace(' + JSON.stringify(block) + ')')
    }
    this.buf.push(block.txt)
  }

  handleMacro (block) {
    const [ command, ...args ] = block.txt.trim().split(/\s+/)
    if ( !command )
      this.parseError( block, 'Macro line needs at least 1 words' )

    const handler = Armtee.__macros[ command.toUpperCase() ]
    if ( !handler ) {
      this.parseError( block, 'Unknown macro command: ' + command )
    }

    return handler(this, block, args)
  }

  compile (translatedScript, debugOption) {
    if ( this.executable ) {
      return this.executable
    }

    const js = this.translate()
    if ( Armtee.debug > 1 ) {
      console.error( 'DEBUG: armtee gerenated render script')
      console.error( '------------------------------------------')
      console.error( js )
    }

    try {
      return this.executable = new Function(this.root, this.printer, js)
    }
    catch (e) {
      // Find error block by using binary search, since
      // v8 doesn't return error line in `new Function()` ... *sigh*
      const orig = e.message

      // At first, inject various type of script snipet which could
      // possibly raise another error at begin of script, and
      // find type of error which is different from original error
      // And then, use binary search for which line is the edge of
      // original error to be shown or not, by injecting error snipet
      const errorRaisers = [ 'for ""', '`${}`', '"']
      let raiser
      let raiserError
      FIND: for ( const r of errorRaisers ) {
        try {
          const js = this.translate({ injectLine: 0, inject: r })
          new Function(js)
        }
        catch (e) {
          if ( orig !== e.message) {
            raiserError = e.message
            raiser = r
            break FIND
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

      throw( `Armtee compile error: Got JS compile error around file ${ errorBlock.meta.file } line ${ errorBlock.meta.line }:
-------------
${ errorBlock.txt }
-------------
ERROR: ${orig}
-------------`)

    }
  }

  translate (debugOption={}) {
    if ( this.rawScript ) {
      return this.rawScript
    }

    this.buf = []
    this.blocks.forEach( (b,idx) => {
      if ( debugOption.inject && debugOption.injectLine === idx ) {
        this.buf.push(debugOption.inject)
      }

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
    return this.rawScript = this.buf.join('\n')
  }

  render (data) {
    const js = this.compile()
    const buf = []
    const trace = []
    const printer = function (...args) { buf.push(String.raw(...args)) }
    printer['_trace'] = function (block) { trace.push(block) }

    try {
      js( data, printer )
    }
    catch (e) {
      if (Armtee.debug > 0 ) {
        const errorBlock = trace[ trace.length - 1 ]
        throw( `Armtee render error: Got JS runtime error around file ${ errorBlock.meta.file } line ${ errorBlock.meta.line }:
-------------
${ errorBlock.txt }
-------------
ERROR: ${e}
-------------`)
      }
      else {
        throw( `Armtee render error: Got JS runtime error "${e}"` )
      }
    }
    return buf.join('\n')
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

  static addMacro( command, fn ) {
    Armtee.__macros[command] = fn
  }
}

Armtee.addMacro('TAG', (armtee, block, args) => {
  armtee.setTagSeparator( ...args )
})

Armtee.addMacro('ROOT', (armtee, block, args) => {
  armtee.root = args[0]
})

export default Armtee
