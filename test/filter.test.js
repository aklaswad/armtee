import { ArmteeRunner } from '../src/runner'
import { testFromYaml } from './util.js'
await testFromYaml('filter.data.yml', ArmteeRunner, {
  filters: {
    upper: str => str.toUpperCase(),
    lower: str => str.toLowerCase(),
    void: str => ''
  }
})
