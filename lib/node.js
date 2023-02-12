import fs from 'fs'
import path from 'path'
import vm from 'node:vm'
import _Armtee from './armtee.js'

class Armtee extends _Armtee {
  static fromFile(filename) {
    const txt = fs.readFileSync(filename, 'utf-8')
    return Armtee.fromText(txt, { file: filename, type: 'file' })
  }

  static fromText (txt, meta) {
    const mode = Armtee.modeFromText(txt)
    return new Armtee(txt, mode[0], mode[1], meta)
  }

  // Override compile function with node:vm based.
  // I want sane error handling :-)
  compile () {
    if ( this.executable ) {
      return this.executable
    }
    const js = this.translate({mode: 'function'})
    if ( Armtee.debug > 1 ) {
      console.error( 'DEBUG: armtee gerenated render script')
      console.error( '------------------------------------------')
      console.error( js )
      console.error( '------------------------------------------')
    }

    try {
      return this.executable = new vm.Script(js)
    }
    catch (e) {
      // TODO: build error message
      throw "Failed to compile template: " + e
    }
  }

  _render_core (js, data, printer) {
    const context = { data, printer, console }
    try {
      js.runInNewContext(context)
    }
    catch (e) {
      // TODO: build error message
      throw(e)
    }
  }
}

Armtee.addMacro('INCLUDE', {
  compile: (armtee, args, block) => {
    if ( block.src.type !== 'file' ) {
      armtee.parseError(block, 'INCLUDE macro cannot be invoked from non-file template.')
    }
    const rootPath = path.dirname(block.src.file)
    const [ filename, context ] = args
    const included = Armtee.fromFile(path.resolve(rootPath, filename))
    const script = included.translate()

    // Semi-colon is required.
    // Without this ';', got error "_(...) is not a function."
    // TODO: understand why.
    return [
      `;((${included.runtimeSymbols.root},${included.runtimeSymbols.printer}) => {`,
      script,
      `})( ${context}, ${armtee.runtimeSymbols.printer} )`
    ].join('\n')
  }
})

export default Armtee
