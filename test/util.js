import fs from 'fs/promises'
import YAML from 'yaml'
import path from 'path'
import url from 'url'
import tmp from 'tmp'

const here = path.dirname(
  url.fileURLToPath(import.meta.url)
)

const afters = []
afterAll(async () => {
  await Promise.all(afters.map( fn => fn() ))
})
export async function testFromYaml( file, Armtee, options ) {
  const dataPath = path.resolve(here, file)
  const dataText = await fs.readFile(dataPath, 'utf-8')
  const data = YAML.parse(dataText)

  describe.each(data)('Test ' + file, async (t) => {
  /*
      data,
      tmpl,
      tmpfile,
      expected,
      error,
      skip,
      todo,
      debug */

    if (t.todo) return test.todo(t.todo)

    const it = t.skip ? test.skip : test

    let method = 'render'
    let target = t.tmpl
    if ( t.tmpfile ) {
      const tmpfile = tmp.fileSync({
        tmpdir: path.resolve(here, './tmpl')
      })
      target = tmpfile.name
      method = 'renderFile'
      await fs.writeFile(target, t.tmpl)
      afters.push( () => tmpfile.removeCallback() )
    }

    const render = () => {
      Armtee.debug = t.debug ? 2 : 0
      const res = Armtee[method](target, t.data, options || {})
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
  }, 10)
}
