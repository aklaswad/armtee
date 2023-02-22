const Sigs = {
  hashy: {
    macro: '##% ',
    script: '##! ',
    template: '##> ',
    comment: '##- ',
  },
  slashy: {
    macro: '//% ',
    script: '//! ',
    template: '//> ',
    comment: '//- ',
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

class ArmteeBlock {
  constructor (txt, src) {
    this.txt = txt
    this.src = src
  }

  parseError (error) {
    throw `Armtee template error: ${error} at ${ this.src.file } line ${ this.src.line }`
  }

  precompile () { return this }
  compile () {}
  postcompile () {}

  _compile (...args) {
    return this.compiled = this.compile(...args)
  }

  static create ( type, txt, src ) {
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

class ArmteeScriptBlock extends ArmteeBlock {
  static type = 'script'

  compile (armtee, txt) {
    const ret = []
    if ( Armtee.debug ) {
      //ret.push( '_trace(' + JSON.stringify(this) + ')' )
    }
    ret.push(this.txt)
    return ret
  }
}

class ArmteeMacroBlock extends ArmteeBlock {
  static type = 'macro'

  precompile (armtee, txt) {
    const [ command, ...args ] = txt.trim().split(/\s+/)
    if ( !command )
      this.parseError( 'Macro line needs at least 1 words' )

    const handler = Armtee.__macros[ command.toUpperCase() ]
    if ( !handler ) {
      this.parseError( 'Unknown macro command: ' + command )
    }
    this.handler = handler
    this.args = args
    if ( handler.precompile ) {
      return handler.precompile(armtee, args, this)
    }
    return this
  }

  compile (armtee, txt) {
    if ( this.handler.compile ) {
      const res = this.handler.compile(armtee, this.args, this)
      if ( 'undefined' === typeof res ) {
        return
      }
      return res

    }
    return
  }
}

class ArmteeTemplateBlock extends ArmteeBlock {
  static type = 'template'

  compile (armtee, txt) {
    const ret = []
    const parts = txt.split(armtee.runtimeSymbols.tagSeparator)
    const buf = []
    if ( parts.length % 2 === 0 )
      this.parseError( 'Unmatched tag separator' )
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
          this.parseError( `Tag is not valid JavaScript
-------------
${ str }
-------------
${ e.toString() }
-------------
          `)
        }
        buf.push( '${'+str+'}')
        //buf.push( '${' + armtee.runtimeSymbols.printer + '.f(' + str + ')}' )
      }
      isText = !isText
    })
    // String.raw could not handle last backslash. Escape it.
    const script = '`' + buf.join('').replace(/\\$/, '${"\\\\"}') + '`'

    // Make sure this is valid JS fragment
    try {
      const fn = new Function(script)
    }
    catch (e) {
      this.parseError( `Failed to convert template
-------------
${ script }
-------------
${ e.toString() }
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

class ArmteeCommentBlock extends ArmteeBlock {
  static type = 'comment'
  precompile () {
    return []
  }
}

class ArmteeLineParser {
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
  static __filters = {}

  // meta should looks like `{ file: filepath }`
  static fromText (txt, meta={}) {
    const mode = Armtee.modeFromText(txt)
    return new Armtee(txt, mode[0], mode[1], meta)
  }

  static render (tmpl, data, options) {
    const armtee = this.fromText(tmpl)
    return armtee.render(data, Object.assign({mode: 'function'},options))
  }

  constructor ( txt, signature, filemode, meta={} ) {
    const parser = new ArmteeLineParser()
    const blocks = parser.parse(txt, meta, signature, filemode)
    this.blocks = blocks
    this.signature = signature
    this.filemode = filemode
    this.runtimeSymbols = {
      printer:  '_$',
      root: 'data',
      context: '$c',
      tagSeparator: /(?:<%|%>)/,
    }
  }

  static modeFromText (txt) {
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
    const sep = isRe  ? begin
              : end   ? new RegExp( `(?:${begin}|${end})` )
              :         new RegExp(begin)
    this.runtimeSymbols.tagSeparator = sep
  }

  compile (options) {
    //if ( this.executable ) {
    //  return this.executable
    //}

    const js = this.translate(options)
    if ( Armtee.debug > 1 ) {
      console.error( 'DEBUG: armtee gerenated render script')
      console.error( '------------------------------------------')
      console.error( js )
    }

    try {
      return this.executable = new Function('data', 'printer', js)
    }
    catch (e) {
      // Find error block by using binary search, since
      // v8/browsers doesn't return error line in `new Function()` ... *sigh*
      // Also tried acorn/esprima/espree to catch error line
      // But they all doesn't have enough compatibility for
      // browsers, at least on my setup...

      const orig = e.message

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
          if ( orig !== e.message) {
            raiserError = e.message
            raiser = injectBlock
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

      throw( `Armtee compile error: Got JS compile error around file ${ errorBlock.src.file } line ${ errorBlock.src.line }:
-------------
${ errorBlock.txt }
-------------
ERROR: ${orig}
-------------`)

    }
  }

  __function_header () {
    const filterInjection = Object.keys(Armtee.__filters)
      .map( f => `String.prototype.$${f} = function () { return (${Armtee.__filters[f]})(this)}`)
      .join('\n')
    const script = `${filterInjection}
((${this.runtimeSymbols.root},${this.runtimeSymbols.printer}) => {`
    return new ArmteeScriptBlock(
      script,
      {
         type: 'system',
         file: 'armtee.js',
         line: 1 //TODO: __LINE__ or something can work? is it needed?
      }
    )
  }

  __function_footer () {
    const script = '})(data,printer)'
    return new ArmteeScriptBlock(
      script,
      {
         type: 'system',
         file: 'armtee.js',
         line: 1 //TODO: __LINE__ or something can work? is it needed?
      }
    )
  }


  translate (options={}) {
    //if ( this.rawScript ) {
    //  return this.rawScript
    //}

    // This could have a side effect... :thinking:
    let blocks = this.blocks.flatMap( (block, idx) => {
      return block.precompile(this, block.txt)
    })

    if ( options.inject ) {
      blocks = blocks.flatMap( (block,idx) => {
        if ( options.injectLine === idx ) {
          return [ options.inject, block ]
        }
        return block
      })
    }

    if ( options.mode === 'function' ) {
      blocks = [
        this.__function_header(),
        ...blocks,
        this.__function_footer()
      ]
    }

    const compiledLines = blocks.flatMap( block => block._compile(this, block.txt)).filter( str => { return 'undefined' !== typeof str && str !== null })
    return this.rawScript = compiledLines.join('\n')
  }

  _render_core (js, data, printer) {
    js( data, printer )
  }


  render (data, options={}) {
    const js = this.compile(options)
    const buf = []
    const trace = []
    const printer = function (...args) { buf.push(String.raw(...args)) }
    printer['_trace'] = function (block) { trace.push(block) }
    printer.f = str => this.activeFilter ? this.activeFilter(str) : str
    try {
      this._render_core(js,data,printer)
    }
    catch (e) {
      if (Armtee.debug > 0 ) {
        const errorBlock = trace[ trace.length - 1 ]
        throw( `Armtee render error: Got JS runtime error around file ${ errorBlock.src.file } line ${ errorBlock.src.line }:
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
      const sig = mode === 'logic' && b.constructor.type === 'script'      ? ''
                : mode === 'template' && b.constructor.type === 'template' ? ''
                : sigs[b.constructor.type]
      buf.push( b.txt.replace(/^/m, sig) )

    })
    return buf.join('\n')
  }

  static addMacro( command, fn ) {
    Armtee.__macros[command] = fn
  }

  static addFilter ( name, fn ) {
    Armtee.__filters[name] = fn
  }
}

Armtee.addMacro('TAG', {
  compile: (armtee, args) => {
    armtee.setTagSeparator( ...args )
  }
})

Armtee.addMacro('ROOT', {
  precompile: (armtee, args, block) => {
    armtee.runtimeSymbols.root = args[0]
    return block
  }
})

Armtee.addMacro('FILTER', {
  compile: (armtee, args) => {
    const [ filterName ] = args
    if ( ! Armtee.__filters[filterName] ) {
      throw 'Unknown filter ' + filterName
    }
  }
})

//Armtee.addFilter( 'hey', '(str) => `hey? ${str}`' )

export default Armtee
