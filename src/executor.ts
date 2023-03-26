
import {
  IArmteePrinter,
  ArmteeFilter
} from './types.js'

import { setUpPrinter } from './printer.js'
//import { Readable, Writable } from 'node:stream'

/*
 Source of transpiled renderer executors. They will be
 printed out via `Function.toString()` and bundled into
 auto generated modules and scripts.
*/

let __render = (_data:any, printer:IArmteePrinter) => {
  printer`dummy`
}
function _render(data:any, printer:IArmteePrinter) {
  __render(data,printer)
}
export function setTestRenderer ( fn: (data:any, printer:IArmteePrinter) => void) {
  __render = fn
}
/* c8 ignore next 1 */
export const filters: Record <string, ArmteeFilter> = {none: s => s}

export async function moduleRunner (data:any) {
  const buf:string[] = []
  const trace:any[] = []
  const printer = setUpPrinter(
    buf,
    trace,
    filters
  )
  await _render(data, printer)
  return buf.join('\n')
}

export async function scriptRunner (argv: string[]) {
  function _help (exitCode: number) {
    process.stderr.write(`USAGE: ${argv[0]} [file]

EXAMPLE:
  ${argv[0]} data.json
    - Read data from json file "data.json" and render contents.
  cat data.json | ${argv[0]}
    - Read data from STDIN and render contents.
`)
    process.exit(exitCode)
  }

  let dataReader: Promise<string>
  if ( argv[2] && argv[2].length ) {
    if ( argv[2] === '-h' || argv[2] === '--help' ) {
      _help(0)
      return
    }
    const fs = require('node:fs/promises')
    dataReader = fs.readFile(argv[2], 'utf-8')
  }
  else {

    //TODO: Should just read lines from tty?
    if ( process.stdin.isTTY ) {
      _help(1)
      return
    }

    dataReader = new Promise((resolve) => {
      process.stdin.setEncoding("utf8")
      const lines: string[] = []
      const reader = require("readline").createInterface({
        input: process.stdin,
      })

      reader.on("line", (line:string) => {
        lines.push(line);
      })

      reader.on("close", async () => {
        resolve(lines.join('\\n'))
      })
    })
  }
  const dataContent:string = await dataReader
  let data
  try {
    data = JSON.parse(dataContent)
  }
  catch (e) {
    process.stderr.write( "Failed to load data: " + e )
    process.exit(1)
    return
  }
  const buf:string[] = []
  const trace:any[] = []
  const printer = setUpPrinter(buf,trace,filters)
  await _render(data, printer)
  process.stdout.write( buf.join('\n') + '\n' )
}