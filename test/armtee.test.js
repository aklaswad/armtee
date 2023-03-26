import { expect } from 'vitest'
import { ArmteeTranspiler } from '../src/armtee'

const hashyTemplateBase = `
##% macro1
##% macro2
template1
template2
##! script1
##! script2
##- comment1
##- comment2
`.trim()
const hashyLogicBase = `
##% macro1
##% macro2
##> template1
##> template2
script1
script2
##- comment1
##- comment2
`.trim()
const slashyTemplateBase = `
//% macro1
//% macro2
template1
template2
//! script1
//! script2
//- comment1
//- comment2
`.trim()
const slashyLogicBase = `
//% macro1
//% macro2
//> template1
//> template2
script1
script2
//- comment1
//- comment2
`.trim()

describe('armtee convert', () => {
  test('hashy-template to slashy-template', () => {
    expect(ArmteeTranspiler
      .fromText(hashyTemplateBase)
      .convert('slashy','template'))
      .toStrictEqual(slashyTemplateBase)
  })

  test('hashy-template to slash-logic', () => {
    expect(ArmteeTranspiler
      .fromText(hashyTemplateBase)
      .convert('slashy','logic'))
      .toStrictEqual(slashyLogicBase)
  })
})

describe('armtee constructor', () => {
  it('can add custom macro', async () => {
    const armtee = ArmteeTranspiler.fromText(
      '//% foo bar',
      {
        macros: {
          foo: {
            precompile: (armtee, args, block) => {
              expect(block.type()).toBe('macro')
              expect(args.length).toBe(1)
              expect(args[0]).toBe('bar')
              armtee.__foo = 42
            },
            compile: async (_armtee, args) => {
              expect(args.length).toBe(1)
              expect(args[0]).toBe('bar')
              return '//foo'
            }
          }
        }
      }
    )
    // compiled by macro foo
    const compiled = await armtee.translate()
    expect(armtee.__foo).toBe(42)
    expect(compiled).toMatch(/\/\/foo/)
  })
})

describe('armtee wrap', () => {
  it('can build function text', () => {
    const armtee = ArmteeTranspiler.fromText('')
    expect(armtee.wrap('', {__buildType: 'function'}))
      .toMatch(/function/)
  })
  it('can build module text', () => {
    const armtee = ArmteeTranspiler.fromText('')
    expect(armtee.wrap('', {__buildType: 'module'}))
      .toMatch(/export/)
  })

  it('can build function text', () => {
    const armtee = ArmteeTranspiler.fromText('')
    expect(armtee.wrap('', {__buildType: 'script'}))
      .toMatch('#!/usr/bin')
  })
  it('can include filter definitions', () => {
    const armtee = ArmteeTranspiler.fromText('', {filters: {
      foo: (s) => s + ' bar bar'
    }})
    expect(armtee.wrap('', {__buildType: 'script', includeFilters: true}))
      .toMatch('bar bar')
  })
})

