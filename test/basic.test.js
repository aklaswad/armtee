import { ArmteeRunner } from '../src/runner'
import { testFromYaml } from './util.js'
await testFromYaml('basic.data.yml', ArmteeRunner)
