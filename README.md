# armtee

Line oriented text template tool

## Install
_Not yet shipped. Try from this repository..._

```
$ git clone git@github.com:aklaswad/armtee.git
$ cd armtee
$ npm i .
$ npx armtee --help
```

## Synopsis

### As ES module

```javascript
import {Armtee} from 'armtee'

const data = [
  { name: 'Alice' },
  { name: 'Bob' }
]

const tmpl = `
##! for (let user of data) {
 - <% user.name %>
##! }
`
console.log(await Armtee.render(tmpl,data))
// - Alice
// - Bob
```

### Common JS

```javascript
const Armtee = require('armtee').Armtee
const data = [
  { name: 'Alice' },
  { name: 'Bob' }
]

const tmpl = `
##! for (let user of data) {
 - <% user.name %>
##! }
`
Armtee.render(tmpl,data)
  .then( rendered => console.log(rendered))
// - Alice
// - Bob
```

### On browser

```html
<script src="./dist/index.umd.cjs"></script>
<script>
const data = [
  { name: 'Alice' },
  { name: 'Bob' }
]

const tmpl = `
##! for (let user of data) {
 - <% user.name %>
##! }
`

armtee.Armtee.render(tmpl,data)
  .then(rendered => console.log(rendered))
</script>
```

See [Live demo and document](https://aklaswad.github.io/armtee/) for more details.
