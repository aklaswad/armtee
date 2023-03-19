import { ArmteeBlockMetaInfo } from "./types"

function describeMetaInfo (meta: ArmteeBlockMetaInfo) {
  return `From template ${
    meta.type ? meta.type : ''
  } ${
    meta.file ? meta.file : '_unknown_'
  }${
    meta.line ? ` line ${meta.line}` : ''
  }`
}

export class ATError extends Error {
  history: ArmteeBlockMetaInfo[]

  constructor(message:string, history: ArmteeBlockMetaInfo[]=[]) {
    super(message)
    this.history = history
  }

  toString () {
    const lines = []
    for ( let meta of this.history ) {
      lines.push(describeMetaInfo(meta))
    }
    return [ this.message, ...lines.reverse() ].join('\n')
  }
}