import MD from 'markdown-it'
import toc from "markdown-it-table-of-contents"
import anchor from "markdown-it-anchor"
import attrs from 'markdown-it-attrs'
import fs from 'fs'

const md = new MD()
md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: `
      <span class="anchor-link">#</span>
    `,
    placement: 'after'
  })
})
md.use(toc, {
  includeLevel: [1,2,3],
})
md.use(attrs, {
  // optional, these are default options
  leftDelimiter: '{',
  rightDelimiter: '}',
  allowedAttributes: []  // empty array = all attributes are allowed
});

const doc = fs.readFileSync('./site/doc.md', 'utf-8')
let tocHtml
const rendered = md.render(doc).replace( /<p>TOCBEGIN(.*)TOCEND<\/p>/s, (match, p1) => {
  tocHtml = p1
  return ''
})

fs.writeFileSync('./public/doc.html', rendered)
fs.writeFileSync('./public/toc.html', tocHtml)
