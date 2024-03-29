export type ArmteeLineSignature = "hashy" | "slashy"
export type ArmteeTemplateMode = "template" | "logic" | "something"
export type ArmteeLineType = "macro" | "script" | "template" | "comment" | "never"
export type ArmteeFilter = (str: string) => string
export type ArmteeBlockMetaInfo = { file?: string, line?: number, type?: string }
export type ArmteeTranspileOptions = {
  meta?: ArmteeBlockMetaInfo
  filters?: Record<string, ArmteeFilter>
  macros?: Record<string, IArmteeMacro>
  includeFilters?: boolean
  debug?: number
  __depth?: number
  __inject?: IArmteeBlock
  __injectLine?: number
  __buildType?: 'function' | 'module' | 'script'

}

export type ArmteePrinterContext = {
  tagFilter: ArmteeFilter,
  lineFilter: ArmteeFilter,
  indentBase: string,
  indents: string[],
  indent: string
}

export interface IArmteePrinter extends Function {
  filters: Record<string, ArmteeFilter>
  context: ArmteePrinterContext
  contextStack: ArmteePrinterContext[]
  pushToContextStack: Function
  popFromContextStack: Function
  $: (symbol:string) => symbol
}

export interface IArmteeBlock {
  txt: string
  src: ArmteeBlockMetaInfo
  dst: ArmteeBlockMetaInfo
  colMap: [number,number][]
  compiled: string | undefined,
  type: () => ArmteeLineType,
  precompile: (armtee: IArmteeTranspiler, txt: string) => void
  compile: (armtee: IArmteeTranspiler, txt: string) => Promise<string | void | undefined>
  _compile: (armtee: IArmteeTranspiler, txt: string) => Promise<string | void | undefined>
  compiledLineCount: () => number,
  parseError(error: string | Error, name: string): void
}

export interface IArmteeTranspiler {
  blocks: IArmteeBlock[]
  addMacro: (armtee:string, macro:IArmteeMacro) => IArmteeTranspiler
  addFilter: (armtee:string, filter:ArmteeFilter) => IArmteeTranspiler
  signature: ArmteeLineSignature
  fileMode: ArmteeTemplateMode
  runtimeSymbols: Record<string, string | string[]>
  executable: Function | undefined
  rawScript: string
  offset: number
  debug: number
  __depth: number
  __filters: Record <string, ArmteeFilter>
  __macros: Record <string, IArmteeMacro>
  setTagSeparator: (l:string, r:string) => void
}

export interface IArmteeMacro {
  precompile?: (armtee: IArmteeTranspiler, args: string[], block: IArmteeBlock ) => void
  compile?: (armtee: IArmteeTranspiler, args: string[], block: IArmteeBlock ) => Promise<void | undefined | string | string[]>
}

export interface IArmteeRuntimeSymbols {
  printer: string
  root: string
  context: string
  tagSeparator: [string, string]
}
