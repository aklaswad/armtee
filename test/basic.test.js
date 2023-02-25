import Armtee from '../lib/armtee.js'

import fs from 'fs'
import YAML from 'yaml'
import path from 'path'
import url from 'url'

const here = path.dirname(
  url.fileURLToPath(import.meta.url)
)
const dataPath = path.resolve(here, 'basic.data.yml')
const dataText = fs.readFileSync(dataPath, 'utf-8')
const data = YAML.parse(dataText)

describe.each(data)('Basic tests', (t) => {
/*
    data,
    tmpl,
    expected,
    error,
    skip,
    todo,
    debug */

  if (t.todo) return test.todo(t.todo)

  const it = t.skip ? test.skip : test

  const render = () => {
    Armtee.debug = t.debug ? 2 : 0
    const res = Armtee.render(t.tmpl, t.data)
    Armtee.debug = 0
    return res
  }

  it( t.name, () => {
    if ( t.error ) {
      expect(render)
        .toThrow(new RegExp(t.error))
    }
    else {
      expect(render()).toBe(t.expected)
    }
  })
})
