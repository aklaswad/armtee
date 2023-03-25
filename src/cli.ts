import {Armtee, Transpiler} from './index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ArmteeLineSignature, ArmteeTemplateMode } from './types.js'

const Yargs = yargs(hideBin(process.argv))

  export const ArmteeCli = Yargs.command(
    'convert <file> <style>',
    'Convert template file style',
    yargs => {
      yargs
        .positional('file', {
          describe: 'Template file path',
          type: 'string',
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
    async options  => {
      const bk = options.file + '.bk'
      if ( ! options.file || typeof options.file !== 'string') {
        throw "file is required"
      }
      if ( ! options.style || typeof options.style !== 'string') {
        throw "style is required"
      }
      await fs.rename(path.resolve(options.file), bk)
      try {
        const armtee = Armtee.fromFile(bk)
        const [ style, mode ] = options.style.split('-')
        if ( !style ) throw ''
        if ( !mode ) throw ''
        const conv = armtee.convert(style as ArmteeLineSignature, mode as ArmteeTemplateMode)
        await fs.writeFile(options.file, conv)
        await fs.rm(bk)
      }
      catch (e) {
        await fs.rename(bk, options.file)
        throw e
      }
    }
  )
  .command(
    'render <file>',
    'Load template from file, and render input',
    yargs => {
      yargs
        .positional('file', {
          describe: 'Template file path',
          type: 'string',
          required: true
        })
        .option('json', {
          describe: 'Load data from json file',
          type: 'string'
        })
        .example('$0 render foo.tmpl --json bar.json', 'Read data from bar.json and render with foo.tmpl')
        .example('gh api repos/aklaswad/armtee/issues | $0 render daily-report.tmpl', 'Read data from STDIN and render with daily-report.tmpl')
    },
    async (options) => {
      if ( !options.file || typeof options.file !== 'string' ) {
        throw ''
      }
      let input
      if ( options.json && 'string' === typeof options.json) {
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
      const data = JSON.parse(input as string)
      const armtee = await Armtee.fromFile(options.file)
      console.log(await armtee.render(data))
    }
  )
  .command(
    'build <file>',
    'Transpile template to JS module, or stand alone script',
    yargs => {
      yargs
        .positional('file', {
          describe: 'Template file path',
          type: 'string',
          required: true
        })
        .option('outFile', {
          describe: 'Filename to output',
          type: 'string'
        })
        .option('type', {
          describe: 'File type of to build',
          default: 'module',
          choices: ['module', 'script']
        })
    },
    async (argv) => {
      if ( !argv.file || 'string' !== typeof argv.file ) {
        throw ''
      }
      if ( !argv.outFile || 'string' !== typeof argv.outFile ) {
        throw ''
      }
      if ( !argv.type || 'string' !== typeof argv.type ) {
        throw ''
      }
      if ( argv.type !== 'module' && argv.type !== 'script' ) { throw '' }


      const armtee = await Transpiler.fromFile(argv.file, {includeFilters: true, __buildType: 'module'})
      const content = armtee.wrap(await armtee.translate(), { __buildType: argv.type, includeFilters: true})
      if ( argv.outFile ) {
        return await fs.writeFile(argv.outFile, content, 'utf-8')
      }
      else {
        console.log(content)
      }
    }
  )
  .completion('completion')
