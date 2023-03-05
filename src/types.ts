export type ArmteeLineSignature = "hashy" | "slashy"
export type ArmteeTemplateMode = "template" | "logic" | "something"
export type ArmteeLineType = "macro" | "script" | "template" | "comment" | "never"


export type ArmteeFilter = (str: string) => string

export type ArmteeBlockMetaInfo = { file?: string, line?: number, type?: string }
export type ArmteeTranspileOptions = Record<string, any>
export type ArmteePrinterContext = {f: ArmteeFilter, fa: ArmteeFilter }

export interface ArmteePrinter extends Function {
  _: ArmteePrinterContext[]
  $: ArmteePrinterContext
  _trace: Function
  __filters: Record<string, ArmteeFilter>
  push: Function
  pop: Function
}
