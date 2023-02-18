import Armtee from '../lib/armtee.js'

import test from 'node:test'
import assert from 'node:assert'
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

function compressSpaces (text) {
  return text
}

data.forEach( (testItem) => {
  if ( testItem.skip ) {
    test(testItem.name, (t) => {
      t.skip( testItem.skip || 'skip...' + testItem.name)
    })
    return
  }
  if ( testItem.todo ) {
    test(testItem.name, (t) => {
      t.todo( testItem.todo || 'todo...' + testItem.name)
    })
    return
  }
  Armtee.debug = 0
  if ( testItem.debug ) {
    Armtee.debug = 2
  }
  if ( testItem.error ) {
    test(testItem.name, (t) => {
      assert.throws( () => {
        Armtee.render(
          testItem.tmpl,
          testItem.data,
          { debug: testItem.debug }
        )
        throw "No error????"
      }, new RegExp(testItem.error))
    })
  }
  else {
    test(testItem.name, (t) => {
      const result = Armtee.render(
        testItem.tmpl,
        testItem.data,
        { debug: testItem.debug, file: 'test' }
      )
      if ( testItem.fail ) {
        assert.notEqual(
          compressSpaces(result),
          compressSpaces(testItem.expect)
        )
      }
      else {
        assert.strictEqual(
          compressSpaces(result),
          compressSpaces(testItem.expect)
        )
      }
    })
  }
})

test("Indent Control", (t) => {
  t.skip('Not yet implemented')
  return
  const tmpl = `
<% data.name %>
##% indent 2
<% data.name %>
##% indent 0
<% data.name %>
`
  const expect = `
tora
  tora
tora
`
  assert.strictEqual(
    Armtee.render(tmpl, { name: 'tora' }, {debug: false}).replace(/\s+$/mg,''),
    expect.replace(/\s+$/mg,'')
  )
})
