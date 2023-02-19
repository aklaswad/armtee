import MD from 'markdown-it'
import toc from "markdown-it-table-of-contents"
import anchor from "markdown-it-anchor"
const md = new MD()
md.use(anchor, {
  permalink: anchor.permalink.headerLink()
})
md.use(toc)
import fs from 'fs'
const doc = fs.readFileSync('./site/doc.md', 'utf-8')
let tocHtml
const rendered = md.render(doc).replace( /<p>TOCBEGIN(.*)TOCEND<\/p>/s, (match, p1) => {
  tocHtml = p1
  console.log({match,p1})
  return ''
})


const htmlSrc = fs.readFileSync('./site/index.html', 'utf-8')
const html = htmlSrc.replace('<!--CONTENT_PLACEHOLDER-->', rendered).replace('<!--TOC_PLACEHOLDER-->', tocHtml)

fs.writeFileSync('./index.html', html)

