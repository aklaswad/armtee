
import {
  IArmteePrinter,
  ArmteeFilter
} from './types.js'

import { setUpPrinter } from './printer.js'


function _render(data:any, printer:IArmteePrinter) {
  // dummy
}
const filters: Record <string, ArmteeFilter> = {}

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
  process.stdin.setEncoding("utf8");

  var lines: string[] = [];
  var reader = require("readline").createInterface({
    input: process.stdin,
  });

  reader.on("line", (line:string) => {
    lines.push(line);
  });

  reader.on("close", async () => {
    const input = lines.join('\\n')
    const data = JSON.parse(input)
    const buf:string[] = []
    const trace:any[] = []
    const printer = setUpPrinter(buf,trace,filters)
    await _render(data, printer)
    console.log( buf.join('\n') )
  });
}