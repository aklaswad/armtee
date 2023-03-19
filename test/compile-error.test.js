import { expect } from 'vitest'
import { ArmteeRunner } from '../src/runner'

describe('ArmteeTranspiler', () => {
  test('can transpile', async () => {
    expect(await ArmteeRunner.render(
      'abc\n<% data %>\nghi',
      'def'
    )).toBe('abc\ndef\nghi')
  })

  test('can throw if tag content is invalid js', async () => {
    expect(async () => {
      return await ArmteeRunner.render(
        'abc\n<% data. %>\nghi',
        'def')
    }).rejects.toThrow(/Tag is not valid JavaScript/i)
  })

  test('can throw if unmatched tag delimiter', async () => {
    expect(async () => {
      return await ArmteeRunner.render(
        'abc\n<% data %\nghi',
        'def')
    }).rejects.toThrow(/Unmatched tag delimiter/i)
  })

  test('can throw if macro name is empty', async () => {
    expect(async () => {
      return await ArmteeRunner.render(
        '//% ',
        'def')
    }).rejects.toThrow(/Macro line needs at least 1 words/i)
  })

  test('can throw if macro name is unknown', async () => {
    expect(async () => {
      return await ArmteeRunner.render(
        '//% UNDEFINED_MACRO_NAME_DO_NEVER_ADD_SAME_NAME_MACRO',
        'def')
    }).rejects.toThrow(/Unknown macro command/i)
  })

})