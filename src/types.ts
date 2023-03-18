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
  __depth?: number
  __inject?: IArmteeBlock
  __injectLine?: number
  __buildType?: 'function' | 'module' | 'script'

}

export type ArmteePrinterContext = {
  tagFilter: ArmteeFilter,
  lineFilter: ArmteeFilter
}

export interface IArmteePrinter extends Function {
  trace: Function
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
  compiled: string[],
  type: () => ArmteeLineType,
  precompile: (armtee: IArmteeTranspiler, txt: string) => IArmteeBlock[]
  compile: (armtee: IArmteeTranspiler, txt: string) => string[]
  _compile: (armtee: IArmteeTranspiler, txt: string) => string[]
  compiledLineCount: () => number,
  parseError(error: string | Error): void
}

export interface IArmteeTranspiler {
  blocks: IArmteeBlock[]
  addMacro: (armtee:string, macro:IArmteeMacro) => IArmteeTranspiler
  addFilter: (armtee:string, filter:ArmteeFilter) => IArmteeTranspiler
  signature: ArmteeLineSignature
  filemode: ArmteeTemplateMode
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
  precompile?: (armtee: IArmteeTranspiler, args: string[], block: IArmteeBlock ) => void | undefined | IArmteeBlock | IArmteeBlock[]
  compile?: (armtee: IArmteeTranspiler, args: string[], block: IArmteeBlock ) => void | undefined | string | string[]
}

export interface IArmteeRuntimeSymbols {
  printer: string
  root: string
  context: string
  tagSeparator: [string, string]
}
