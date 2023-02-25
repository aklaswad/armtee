import Armtee from '../lib/armtee.js'

import fs from 'fs/promises'
import YAML from 'yaml'
import path from 'path'
import url from 'url'

const here = path.dirname(
  url.fileURLToPath(import.meta.url)
)

export async function testFromYaml( file ) {
  const dataPath = path.resolve(here, file)
  const dataText = await fs.readFile(dataPath, 'utf-8')
  const data = YAML.parse(dataText)

  describe.each(data)('Test ' + file, (t) => {
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
}
