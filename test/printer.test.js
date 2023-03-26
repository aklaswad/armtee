import { expect } from 'vitest'
import { setUpPrinter } from '../src/printer'

describe('setUpPrinter', () => {
  test('can print into buffer', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`abc`
    expect(buf[0]).toBe('abc')
  })
  test('can print backslashes as is', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`ab\\c`
    expect(buf[0]).toBe('ab\\\\c')
  })
  test('can print numbers', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`${0.1}`
    expect(buf[0]).toBe('0.1')
  })
  test('do prints with toString() for non primitives', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`${({})}`
    expect(buf[0]).toMatch(/object/)
  })

  test('do prints special symbol: backslash', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`${printer.$("bs")}`
    expect(buf[0]).toBe('\\')
  })
  test('do prints special symbol: ${', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`${printer.$("${")}`
    expect(buf[0]).toBe('${')
  })

  test('do prints special symbol: backtick', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    printer`${printer.$("`")}`
    expect(buf[0]).toBe('`')
  })

  test('do not generate other symbols', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    expect(() => printer`${printer.$("?")}`)
      .toThrow(/Invalid Symbol/i)
  })

  test('do reject any symbols', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    expect(() => printer`${Symbol("`")}`)
      .toThrow(/Unknown Symbol/i)
  })

  test('cannot pop context from initial layer', () => {
    const buf = []
    const printer = setUpPrinter(buf,{none: s => s})
    expect( () => printer.popFromContextStack() )
      .toThrow(/Invalid context/i)

  })
})