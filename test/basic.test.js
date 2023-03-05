import { ArmteeRunner } from '../dist/runner.js'
import { testFromYaml } from './util.js'
await testFromYaml('basic.data.yml', ArmteeRunner)
