#!/usr/bin/env node
import {Armtee, Transpiler} from '../dist/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'node:fs/promises'

const parser = yargs(hideBin(process.argv))

parser.command({
  command: 'convert <file> <style>',
  desc: 'Convert template file style',
  builder: yargs => {
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
  },
  handler: async options => {
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
  }
})

parser.command({
  command: 'render <file>',
  desc: 'Load template from file, and render input',
  builder: yargs => {
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
  },
  handler: async (options) => {
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
})

parser.command({
  command: 'build <file>',
  desc: 'Transpile template to JS module, or stand alone script',
  builder: yargs => {
    yargs
      .positional('file', {
        describe: 'Template file path',
        type: 'file',
        required: true
      })
      .option('outfile', {
        describe: 'Filename to output',
        type: 'file'
      })
      .option('type', {
        describe: 'File type of to build',
        default: 'module',
        choices: ['module', 'script']
      })
  },
  handler: async (argv) => {
    const armtee = await Transpiler.fromFile(argv.file, {includeFilters: true, __buildType: 'module'})
    console.log(armtee.wrap(armtee.translate(), { __buildType: argv.type, includeFilters: true}))
  }

})

parser.completion('completion')

parser.argv