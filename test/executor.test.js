import { expect, beforeEach, afterEach } from 'vitest'
import {
  moduleRunner,
  scriptRunner,
  setTestRenderer
} from '../src/executor'

import {
  mockProcessExit,
  mockProcessStdout,
  mockProcessStderr,
} from 'vitest-mock-process'
import mockStdin from 'mock-stdin'

let mockExit
let mockStdout
let mockStderr
beforeEach(async () => {
  mockExit = mockProcessExit()
  mockStdout = mockProcessStdout()
  mockStderr = mockProcessStderr()
})

afterEach(async () => {
  mockExit.mockRestore()
  mockStdout.mockRestore()
  mockStderr.mockRestore()
})
describe('scriptRunnerDummy', () => {
  it('has default dummy renderer', async () => {
    await scriptRunner(['nodePath','programPath','test/data/nameString.json'])
    expect(mockStdout.calls[0][0]).toBe('dummy\n')
  })
})

describe('moduleRunner', () => {
  it('can render something', async () => {
    setTestRenderer((data, printer) => {
      printer`[${data}]`
    })
    const res = await moduleRunner('foo')
    expect(res).toBe('[foo]')
  })
})

describe('scriptRunner', () => {
  it('can show help', async () => {
    await scriptRunner(['nodePath','programPath','--help'])
    expect(mockExit).toHaveBeenCalledWith(0)
    expect(mockStderr.calls[0][0]).toMatch(/USAGE/)
  })

  it('can show help if no input source specified', async () => {
    const origTTY = process.stdin.isTTY
    process.stdin.isTTY = true
    await scriptRunner(['nodePath','programPath'])
    expect(mockExit).toHaveBeenCalledWith(1)
    expect(mockStderr.calls[0][0]).toMatch(/USAGE/)
    process.stdin.isTTY = origTTY
  })

  it('can read input from file', async () => {
    setTestRenderer((data, printer) => {
      printer`[${data}]`
    })
    await scriptRunner(['nodePath','programPath','test/data/nameString.json'])
    expect(mockStdout.calls[0][0]).toBe('[armtee]\n')
  })

  it('can read input from pipe', async () => {
    const stdin = mockStdin.stdin()
    const origTTY = process.stdin.isTTY
    process.stdin.isTTY = false
    setTestRenderer((data, printer) => {
      printer`[${data}]`
    })
    const wait = scriptRunner(['nodePath','programPath'])
    stdin.send('"armtee"')
    stdin.end()
    await wait
    expect(mockStdout.calls[0][0]).toBe('[armtee]\n')
    stdin.restore()
    process.stdin.isTTY = origTTY

  })

  it('throws error while broken json file was given', async () => {
    setTestRenderer((data, printer) => {
      printer`[${data}]`
    })
    await scriptRunner(['nodePath','programPath','test/data/broken.json'])
    expect(mockExit).toBeCalledWith(1)
    expect(mockStderr.calls[0][0]).toMatch(/Failed to load data/)
  })

})