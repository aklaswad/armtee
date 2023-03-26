import { expect, vi } from 'vitest'
import { ArmteeRunner } from '../src/runner'

describe('armtee debug', () => {
  it('can report transpiled string', async () => {
    const spyError = vi.spyOn(console, "error")
      .mockImplementation();
    const armtee = ArmteeRunner.fromText('foo', {debug: 2})
    await armtee.compile()
    const errorLog = spyError.calls.flat().join('')
    expect(errorLog).match(/DEBUG: armtee/)
    expect(errorLog).match(/foo/)
    spyError.mockRestore()
  })
})