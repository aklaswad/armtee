import { ATError, ATUnexpectedError } from '../src/error'

describe('ATError', () => {
  test('create', () => {
    const error = new ATError('foo')
    expect("" + error).toBe('foo')
  })

  test('create with history', () => {
    const error = new ATError(
      'foo', [
        { type: 'file' },
        { type: 'file', file: 'bar.tmpl', line: 2 }
    ])
    expect("" + error).toBe(`foo
From template file bar.tmpl line 2
From template file _unknown_`)
  })

  test('ATError can append history', () => {
    const error = new ATError(
      'foo', [
        { type: 'file', file: 'foo.tmpl', line: 3 },
        { type: 'file', file: 'bar.tmpl', line: 2 }
    ])
    error.appendHistory({type: 'file', file: 'fizz.tmpl', line: 1})
    expect("" + error).toBe(`foo
From template file fizz.tmpl line 1
From template file bar.tmpl line 2
From template file foo.tmpl line 3`)
  })

  test('ATUnexpectedError', () => {
    const error = new ATUnexpectedError('foo')
    expect("" + error).toMatch(/Unsupported type: foo/)
  })
})