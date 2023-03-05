export type ArmteeLineSignature = "hashy" | "slashy"
export type ArmteeTemplateMode = "template" | "logic" | "something"
export type ArmteeLineType = "macro" | "script" | "template" | "comment" | "never"
export type ArmteeFilter = (str: string) => string
export type ArmteeBlockMetaInfo = { file?: string, line?: number, type?: string }
export type ArmteeTranspileOptions = Record<string, any>
export type ArmteePrinterContext = {f: ArmteeFilter, fa: ArmteeFilter }

export interface IArmteePrinter extends Function {
  _: ArmteePrinterContext[]
  $: ArmteePrinterContext
  _trace: Function
  __filters: Record<string, ArmteeFilter>
  push: Function
  pop: Function
}

export interface IArmteeBlock {
  txt: string
  src: ArmteeBlockMetaInfo
  dst: ArmteeBlockMetaInfo
  colmap: [number,number][]
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
  signature: ArmteeLineSignature
  filemode: ArmteeTemplateMode
  runtimeSymbols: Record<string, string | string[]>
  executable: Function | undefined
  rawScript: string
  offset: number
  debug: number,
  __depth: number,
  setTagSeparator: (l:string, r:string) => void
}

export interface IArmteeMacro {
  precompile?: (armtee: IArmteeTranspiler, args: string[], block: IArmteeBlock ) => void | undefined | IArmteeBlock | IArmteeBlock[]
  compile?: (armtee: IArmteeTranspiler, args: string[], block: IArmteeBlock ) => void | undefined | string | string[]
}
