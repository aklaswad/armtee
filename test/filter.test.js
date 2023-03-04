import { Armtee } from '../dist/armtee.js'
import { testFromYaml } from './util.js'
Armtee.addFilter( 'upper', str => str.toUpperCase() )
Armtee.addFilter( 'lower', str => str.toLowerCase() )
await testFromYaml('filter.data.yml', Armtee)
