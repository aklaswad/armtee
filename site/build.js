import MD from 'markdown-it'
import toc from "markdown-it-table-of-contents"
import anchor from "markdown-it-anchor"
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
const doc = fs.readFileSync('./site/doc.md', 'utf-8')
let tocHtml
const rendered = md.render(doc).replace( /<p>TOCBEGIN(.*)TOCEND<\/p>/s, (match, p1) => {
  tocHtml = p1
  return ''
})

// Poor replace. I need this since JS String.replace() will
// *ALWAYS* try expanding RegExp replcement patterns like `$1`
// though matcher is not regexp.
function simpleReplace (src, pattern, replacement) {
  const parts = src.split(pattern)
  const before = parts.shift();
  return before + replacement + parts.join('')
}
const htmlSrc = fs.readFileSync('./site/index.html', 'utf-8')
const html = simpleReplace(
  simpleReplace(
    htmlSrc,
    '<!--CONTENT_PLACEHOLDER-->',
    rendered),
  '<!--TOC_PLACEHOLDER-->',
  tocHtml)
fs.writeFileSync('./index.html', html)

