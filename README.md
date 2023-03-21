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


```javascript
import {Armtee} from 'armtee'
const data = [
  { name: 'Alice' },
  { name: 'Bob' }
]

const tmpl = `
##! for (let user of data) {
 - <% user.name %>
##!
}`

console.log( Armtee.render(tmpl, data) )
// - Alice
// - Bob
```

See [Live demo and document](https://aklaswad.github.io/armtee/) for more details.

