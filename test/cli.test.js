#!/usr/bin/env node
import cp from 'node:child_process'
import fs from 'node:fs'
import { expect } from 'vitest'
import path from 'node:path'

let WorkDir

describe("CLI", () => {
  beforeEach(() => {
    WorkDir = fs.mkdtempSync('armtee-test')
  })

  afterEach(() => {
    fs.rmSync(WorkDir, {recursive: true})
  })

  test('can show help message', () => {
    const help = cp.execFileSync('bin/cli.js', ['--help']).toString()
    expect(help).toMatch(/convert/)
    expect(help).toMatch(/render/)
    expect(help).toMatch(/build/)
  })

  test('can convert file', () => {
    const tmpl = `//- comment
//% TAG {{ }}
//! // script
template`
    const hashy = `##- comment
##% TAG {{ }}
// script
##> template`
    const filePath = path.resolve(WorkDir, 'test.tmpl')
    fs.writeFileSync(filePath, tmpl, 'utf-8')
    cp.execFileSync('bin/cli.js', [
      'convert',
      filePath,
      'hashy-logic'
    ])
    const converted = fs.readFileSync(filePath, 'utf-8')
    expect(converted).toBe(hashy)
  })

  test('can render template', () => {
    const tmpl = `//! for ( let item of data ) {
 - <% item %>
//! }`
    const data = `["foo","bar"]`
    const expected = ' - foo\n - bar\n'
    const tmplPath = path.resolve(WorkDir, 'test.tmpl')
    const jsonPath = path.resolve(WorkDir, 'data.json')
    fs.writeFileSync(tmplPath, tmpl, 'utf-8')
    fs.writeFileSync(jsonPath, data, 'utf-8')
    const output = cp.execFileSync('bin/cli.js', [
      'render',
      tmplPath,
      '--json',
      jsonPath
    ])
    expect(output.toString()).toBe(expected)
  })

  test('can build module', async () => {
    const tmpl = `//! for ( let item of data ) {
 - <% item %>
//! }`
    const data = ["foo","bar"]
    const expected = ' - foo\n - bar'
    const tmplPath = path.resolve(WorkDir, 'test.tmpl')
    const modulePath = path.resolve(WorkDir, 'module.cjs')
    fs.writeFileSync(tmplPath, tmpl, 'utf-8')
    cp.execFileSync('bin/cli.js', [
      'build',
      '--outFile',
      modulePath,
      '--type',
      'module',
      tmplPath
    ])

    const created = await import(modulePath)
    expect(await created.render(data)).toBe(expected)
  })

})