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
  compile (debugOption) {
    const js = this.compileCore(debugOption)
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
    const buf = []
    const trace = []
    const printer = function (...args) { buf.push(String.raw(...args)) }
    printer['_trace'] = function (block) { trace.push(block) }

    const context = {}
    context[this.printer] = printer
    context[this.root] = data
    try {
      this.js.runInNewContext(context)
    }
    catch (e) {
      // TODO: build error message
      throw(e)
    }
    return buf.join('\n')
  }
}

export default Armtee
