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

