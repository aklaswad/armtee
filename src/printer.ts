import {
  ArmteeFilter,
  IArmteePrinter,
  IArmteeBlock
} from './types.js'

export function setUpPrinter (buf: string[], trace: any[], filters: {[name: string]: ArmteeFilter}) {
  const printer:IArmteePrinter = function (
    literals: TemplateStringsArray,
    ...placeholders: string[]
  ) {
    const raw = String.raw(
      literals,
      ...placeholders.map( str => printer.context.tagFilter(str))
    )
    buf.push(printer.context.lineFilter(raw))
  }
  printer.trace = function (block: IArmteeBlock) { trace.push(block) }
  printer.filters = filters
  printer.contextStack = []
  printer.context = {tagFilter: filters.none, lineFilter: filters.none }
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