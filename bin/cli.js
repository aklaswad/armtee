#!/usr/bin/env node
import Armtee from '../lib/armtee.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'fs/promises'

const parser = yargs(hideBin(process.argv))

parser.command('convert <file> <style>', 'Convert template file style', yargs => {
  yargs
    .positional('file', {
      describe: 'Template file path',
      type: 'file',
      required: true
    })
    .positional('style', {
      required: true,
      describe: 'Template style to convert to',
      choices: [
        'hashy-template',
        'hashy-logic',
        'slashy-template',
        'slashy-logic' ]
    })
})

parser.command('render <file>', 'Load template from file, and render input', yargs => {
  yargs
    .positional('file', {
      describe: 'Template file path',
      type: 'file',
      required: true
    })
    .option('json', {
      describe: 'Load data from json file',
      type: 'file'
    })
    .example('$0 render foo.tmpl --json bar.json', 'Read data from bar.json and render with foo.tmpl')
    .example('gh api repos/aklaswad/armtee/issues | $0 render daily-report.tmpl', 'Read data from STDIN and render with daily-report.tmpl')
})


parser.completion('completion')

const Commands = {
  "convert": async (options) => {
    const bk = options.file + '.bk'
    await fs.rename(options.file, bk)
    try {
      const armtee = Armtee.fromFile(bk)
      const [ style, mode ] = options.style.split('-')
      const conv = armtee.convert(style, mode)
      await fs.writeFile(options.file, conv)
      await fs.rm(bk)
    }
    catch (e) {
      await fs.rename(bk, options.file)
      throw e
    }
  },
  "render": async (options) => {
    let input
    if ( options.json ) {
      input = await fs.readFile(options.json)
    }
    else {
      const buffers = [];
      for await (const chunk of process.stdin) {
        buffers.push(chunk);
      }
      const buffer = Buffer.concat(buffers);
      input = buffer.toString();
    }
    const data = JSON.parse(input)
    const armtee = Armtee.fromFile(options.file)
    console.log(armtee.render(data))
  }
}

const opts = parser.argv
const command = Commands[opts._[0]]

if (command) {
  const retObj = command(opts)
  const ret = retObj instanceof Promise ? await retObj : retObj
}
else {
  console.error("Unknown command: " + opts._[0])
  process.exit(1)
}
