import { ATError } from '../src/error'

describe('ATError', () => {
  test('create', () => {
    const error = new ATError('foo')
    expect("" + error).toBe('foo')
  })

  test('create with history', () => {
    const error = new ATError(
      'foo', [
        { type: 'file', file: 'foo.tmpl', line: 3 },
        { type: 'file', file: 'bar.tmpl', line: 2 }
    ])
    expect("" + error).toBe(`foo
From template file bar.tmpl line 2
From template file foo.tmpl line 3`)
  })

})