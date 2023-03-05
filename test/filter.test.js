import { ArmteeRunner } from '../dist/runner.js'
import { testFromYaml } from './util.js'
ArmteeRunner.addFilter( 'upper', str => str.toUpperCase() )
ArmteeRunner.addFilter( 'lower', str => str.toLowerCase() )
await testFromYaml('filter.data.yml', ArmteeRunner)
