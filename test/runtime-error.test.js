import { expect } from 'vitest'
import { ArmteeRunner } from '../src/runner'

describe('Runner.compile()', () => {
  test('can throw invalid js compile error', async () => {
    expect(async () => {
      return await ArmteeRunner.render(
        `template
//! const x = 0
//! const y = 1
//! const z = 2
//! const y = 3
//! const a = 4`, // y=3 is invalid
        'def')
    }).rejects.toThrow(/Armtee compile error/i)
  })
})

describe('Runner.render()', () => {
  test('can throw invalid js runtime error', async () => {
    expect(async () => {
      return await ArmteeRunner.render(
        '<% data.which.come.from.nowhere %>"',
        'def')
    }).rejects.toThrow(/Armtee render error/i)
  })
})