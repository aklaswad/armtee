import {
  ArmteeFilter,
  IArmteePrinter,
  ArmteePrinterContext,
  IArmteeBlock
} from './types.js'

export function setUpPrinter (buf: string[], trace: any[], filters: {[name: string]: ArmteeFilter}) {
  const symBackTick = Symbol('`')
  const symDollarCurlyBrace = Symbol('${')
  const symBackSlash = Symbol('bs')
  const context = {tagFilter: filters.none, lineFilter: filters.none }

  const printer = function (
    literals: TemplateStringsArray,
    ...placeholders: (symbol|string|number|any)[]
  ) {
    const raw = String.raw(
      literals,
      ...placeholders.map( str => {
        switch (typeof str) {
          case 'string':
            return context.tagFilter(str.toString())
          case 'number':
            return context.tagFilter(str.toString())
          case 'symbol':
            switch (str) {
              case symDollarCurlyBrace: return '${'
              case symBackTick: return '`'
              case symBackSlash: return '\\'
              default: throw 'Unknown symbol'
            }
          default:
            return context.tagFilter(str)
        }
      })
    )
    buf.push(printer.context.lineFilter(raw))
  }
  printer.$ = function (symbol: string) {
    switch (symbol) {
      case '`': return symBackTick;
      case '${': return symDollarCurlyBrace;
      case 'bs': return symBackSlash;
    }
    throw "Unexpected Symbol;"
  }
  printer.trace = function (block: IArmteeBlock) { trace.push(block) }
  printer.filters = filters
  const contextStack :ArmteePrinterContext[] = []
  printer.contextStack = contextStack
  printer.context = context
  printer.pushToContextStack = function printerPush () {
    const newContext = Object.assign({}, printer.context)
    printer.contextStack.push(printer.context)
    printer.context = newContext
  }
  printer.popFromContextStack = function printerPop () {
    const lastContext = printer.contextStack.pop()
    if ( !lastContext ) throw 'Invalid context'
    printer.context = lastContext
  }
  return printer
}