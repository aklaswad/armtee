import { expect } from 'vitest'
import { ArmteeLineParser, modeFromText } from '../src/line-parser'


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

describe('modeFromText', () => {
  test('can detect hashy template', () => {
    expect(modeFromText(hashyTemplateBase))
      .toStrictEqual(['hashy','template'])
  })

  test('can detect hashy logic', () => {
    expect(modeFromText(hashyLogicBase))
      .toStrictEqual(['hashy','logic'])
  })

  test('can detect slashy template', () => {
    expect(modeFromText(slashyTemplateBase))
      .toStrictEqual(['slashy','template'])
  })

  test('can detect slashy logic', () => {
    expect(modeFromText(slashyLogicBase))
      .toStrictEqual(['slashy','logic'])
  })

  test('should failure for hash/slash mixed', () => {
    expect(() => {
      modeFromText(`
##! script1
//! script2
      `)
    }).toThrowError(/Invalid template: mixed style/)
  })
  test('should failure for hash/slash mixed', () => {
    expect(() => {
      modeFromText(`
##> template1
//> template2
      `)
    }).toThrowError(/Invalid template: mixed style/)
  })
  test('should failure for mixed logic/style', () => {
    expect(() => {
      modeFromText(`
##! script1
##> template1
      `)
    }).toThrowError(/Invalid template: mixed style/)
  })

  test('should failure for mixed logic/template', () => {
    expect(() => {
      modeFromText(`
//> template1
//! script1
      `)
    }).toThrowError(/Invalid template: mixed style/)

  })
})

describe('line-parser', () => {
  test('can parse hashy template by default', () => {
    const parser = new ArmteeLineParser()
    const result = parser.parse(hashyTemplateBase, {})
    expect(result[0].txt).toBe('macro1')
    expect(result[1].txt).toBe('macro2')
    expect(result[2].txt).toBe('template1')
    expect(result[3].txt).toBe('template2')
    expect(result[4].txt).toBe('script1\nscript2')
    expect(result[5].txt).toBe('comment1')
    expect(result[6].txt).toBe('comment2')

    expect(result[0].type()).toBe('macro')
    expect(result[1].type()).toBe('macro')
    expect(result[2].type()).toBe('template')
    expect(result[3].type()).toBe('template')
    expect(result[4].type()).toBe('script')
    expect(result[5].type()).toBe('comment')
    expect(result[6].type()).toBe('comment')
  })

  test('can parse hashy template template', () => {
    const parser = new ArmteeLineParser()
    const result = parser.parse(hashyTemplateBase, {}, 'hashy', 'template')
    expect(result[0].txt).toBe('macro1')
    expect(result[1].txt).toBe('macro2')
    expect(result[2].txt).toBe('template1')
    expect(result[3].txt).toBe('template2')
    expect(result[4].txt).toBe('script1\nscript2')
    expect(result[5].txt).toBe('comment1')
    expect(result[6].txt).toBe('comment2')

    expect(result[0].type()).toBe('macro')
    expect(result[1].type()).toBe('macro')
    expect(result[2].type()).toBe('template')
    expect(result[3].type()).toBe('template')
    expect(result[4].type()).toBe('script')
    expect(result[5].type()).toBe('comment')
    expect(result[6].type()).toBe('comment')
  })
  test('can parse hashy logic template', () => {
    const parser = new ArmteeLineParser()
    const result = parser.parse(hashyLogicBase, {}, 'hashy', 'logic')
    expect(result[0].txt).toBe('macro1')
    expect(result[1].txt).toBe('macro2')
    expect(result[2].txt).toBe('template1')
    expect(result[3].txt).toBe('template2')
    expect(result[4].txt).toBe('script1\nscript2')
    expect(result[5].txt).toBe('comment1')
    expect(result[6].txt).toBe('comment2')

    expect(result[0].type()).toBe('macro')
    expect(result[1].type()).toBe('macro')
    expect(result[2].type()).toBe('template')
    expect(result[3].type()).toBe('template')
    expect(result[4].type()).toBe('script')
    expect(result[5].type()).toBe('comment')
    expect(result[6].type()).toBe('comment')
  })

  test('can parse slashy template template', () => {
    const parser = new ArmteeLineParser()
    const result = parser.parse(slashyTemplateBase, {}, 'slashy', 'template')
    expect(result[0].txt).toBe('macro1')
    expect(result[1].txt).toBe('macro2')
    expect(result[2].txt).toBe('template1')
    expect(result[3].txt).toBe('template2')
    expect(result[4].txt).toBe('script1\nscript2')
    expect(result[5].txt).toBe('comment1')
    expect(result[6].txt).toBe('comment2')

    expect(result[0].type()).toBe('macro')
    expect(result[1].type()).toBe('macro')
    expect(result[2].type()).toBe('template')
    expect(result[3].type()).toBe('template')
    expect(result[4].type()).toBe('script')
    expect(result[5].type()).toBe('comment')
    expect(result[6].type()).toBe('comment')
  })

  test('can parse slashy logic template', () => {
    const parser = new ArmteeLineParser()
    const result = parser.parse(slashyLogicBase, {}, 'slashy', 'logic')
    expect(result[0].txt).toBe('macro1')
    expect(result[1].txt).toBe('macro2')
    expect(result[2].txt).toBe('template1')
    expect(result[3].txt).toBe('template2')
    expect(result[4].txt).toBe('script1\nscript2')
    expect(result[5].txt).toBe('comment1')
    expect(result[6].txt).toBe('comment2')

    expect(result[0].type()).toBe('macro')
    expect(result[1].type()).toBe('macro')
    expect(result[2].type()).toBe('template')
    expect(result[3].type()).toBe('template')
    expect(result[4].type()).toBe('script')
    expect(result[5].type()).toBe('comment')
    expect(result[6].type()).toBe('comment')
  })

})

