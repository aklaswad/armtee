import fs from 'node:fs'
import path from 'node:path'

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
    this.dst = {}
    this.colmap = [[1,1]] // src, dst
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

  compiledLineCount () {
    if ( ! this.compiled ) return 0
    return this.compiled.reduce( (acc,cur) => {
      return acc += cur.split('\n').length
    }, 0 )
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
      const ret = handler.precompile(armtee, args, this)
      if ( ret ) {
        ret.forEach( block => block.src = this.src )
      }
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
    const parts = txt.split(armtee.runtimeSymbols.tagSeparator[0])
      .flatMap( p => p.split(armtee.runtimeSymbols.tagSeparator[1]))
    let buf = ''
    let offset = 0
    const lenL = armtee.runtimeSymbols.tagSeparator[0].length
    const lenR = armtee.runtimeSymbols.tagSeparator[1].length

    if ( parts.length % 2 === 0 )
      this.parseError( 'Unmatched tag separator' )

    let isText = true
    parts.forEach( str => {
      if ( isText ) {
        const txt = str.replaceAll(new RegExp('([`$])', 'g'), '${"$1"}')
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
${ e.toString() }
-------------
          `)
        }
        this.colmap.push([ offset, buf.length ])
        const exp = '${' + `${armtee.runtimeSymbols.printer}.$.f(${str})}`
        offset += exp.length + lenR
        buf += exp
      }
      isText = !isText
    })
    // JS template literal + String.raw() can ignore almost escape chars, but
    // only backslash at the end is not ignorable. Escape it.
    const script = '`' + buf.replace(/\\$/, '${"\\\\"}') + '`'

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
    return new Armtee(txt.replace(/\n$/,''), mode[0], mode[1], meta)
  }

  static fromFile(filename) {
    const txt = fs.readFileSync(filename, 'utf-8')
    return Armtee.fromText(txt, { file: filename, type: 'file' })
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
      tagSeparator: ['<%','%>'],
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
    this.runtimeSymbols.tagSeparator = [ begin, end ]
  }

  compile (options) {
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

  wrap (txt, options={}) {
    let filterInjection = ''
    if ( options.includeFilters ) {
      filterInjection = Object.keys(this.constructor.__filters)
        .map( f => `String.prototype.$${f} = function () {return (${Armtee.__filters[f].toString()})(this)}`)
        .join('\n')
    }
    else {
      filterInjection = Object.keys(this.constructor.__filters)
        .map( f => `String.prototype.$${f} = function () {return printer.__filters.${f}(this)}`)
        .join('\n')
    }
    const header = `${filterInjection};((${this.runtimeSymbols.root},${this.runtimeSymbols.printer}) => {`
    this.offset = header.split('\n').length;
    const footer = '})(data,printer)'
    return [ header, '/*___ARMTEE___*/', txt, footer ].join('\n')
  }

  prepare (options={}) {
    return this.blocks.flatMap( (block, idx) => {
      return block.precompile(this, block.txt)
    })
  }

  translate (options={}) {
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

  resolvePos (dstLine,dstCol) {
    const idx = this.blocks.findIndex( b => b.dst.line && b.dst.line > dstLine - this.offset )
    if ( idx === -1 ) return
    console.error(this.blocks[idx-1])
    return this.blocks[idx-1].src
  }

  _render_core (js, data, printer) {
    js( data, printer )
  }

  setUpPrinter (buf,trace) {
    const printer = function (...args) {
      const raw = String.raw(...args)
      buf.push(printer.$.fa ? printer.$.fa(raw) : raw)
    }
    printer['_trace'] = function (block) { trace.push(block) }
    printer.__filters = Armtee.__filters
    printer._ = [] // context stack
    printer.$ = {f: Armtee.__filters.none } // context
    printer.push = function printerPush () {
      const newContext = Object.assign({}, printer.$)
      printer._.push(printer.$)
      printer.$ = newContext
    }
    printer.pop = function printerPop () {
      printer.$ = printer._.pop()
    }
    return printer
  }

  render (data, options={}) {
    const js = this.compile(options)
    const buf = []
    const trace = []
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
ERROR: ${ e.toString()}
-------------`)
      }
      else {
        console.log(e)
        if ( e.stack ) {
          if ( e.stack.match(/(\d+):(\d+)\)?\n/m) ) {
            const pos = this.resolvePos( RegExp.$1, RegExp.$2 )
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
  }
})

Armtee.addMacro('FILTER', {
  compile: (armtee, args) => {
    const [ filterName ] = args
    if ( ! Armtee.__filters[filterName] ) {
      throw 'Unknown filter ' + filterName
    }
    const _$ = armtee.runtimeSymbols.printer
    return [`${_$}.$.f = ${_$}.__filters.${filterName}`]
  }
})

Armtee.addMacro('FILTERALL', {
  compile: (armtee, args) => {
    const [ filterName ] = args
    if ( ! Armtee.__filters[filterName] ) {
      throw 'Unknown filter ' + filterName
    }
    return [`${armtee.runtimeSymbols.printer}.$.fa = ${armtee.runtimeSymbols.printer}.__filters.${filterName}`]
  }
})

Armtee.addMacro('INCLUDE', {
  precompile: (armtee, args, block) => {
    if ( block.src.type !== 'file' ) {
      block.parseError('INCLUDE macro cannot be invoked from non-file template.')
    }
    const rootPath = path.dirname(block.src.file)
    const [ filename, context ] = args
    const included = Armtee.fromFile(path.resolve(rootPath, filename))
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
export default Armtee
