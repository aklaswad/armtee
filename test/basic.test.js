import { Armtee } from '../dist/armtee.js'
import { testFromYaml } from './util.js'
await testFromYaml('basic.data.yml', Armtee)
