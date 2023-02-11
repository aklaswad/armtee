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
    const js = this.translate()
    if ( Armtee.debug > 1 ) {
      console.error( 'DEBUG: armtee gerenated render script')
      console.error( '------------------------------------------')
      console.error( js )
      console.error( '------------------------------------------')
    }

    try {
      return new vm.Script(js)
    }
    catch (e) {
      // TODO: build error message
      throw "Failed to compile template: " + e
    }
  }

  render (data) {
    const js = this.compile()
    const buf = []
    const trace = []
    const printer = function (...args) { buf.push(String.raw(...args)) }
    printer['_trace'] = function (block) { trace.push(block) }

    const context = {}
    context[this.printer] = printer
    context[this.root] = data
    try {
      js.runInNewContext(context)
    }
    catch (e) {
      // TODO: build error message
      throw(e)
    }
    return buf.join('\n')
  }
}

Armtee.addMacro('INCLUDE', (armtee, block, args) => {
  if ( block.meta.type !== 'file' ) {
    armtee.compileError(block, 'INCLUDE macro cannot be invoked from non-file template.')
  }
  const rootPath = path.dirname(block.meta.file)
  const [ filename, context ] = args
  const included = Armtee.fromFile(path.resolve(rootPath, filename))
  const script = included.translate()
  // Semi-colon is required.
  // Without this ';', got error "_(...) is not a function."
  // TODO: understand why.
  armtee.buf.push(`;((${included.root},${included.printer}) => {`)
  armtee.buf.push(script)
  armtee.buf.push(`})( ${context}, ${armtee.printer} )`)
})

export default Armtee
