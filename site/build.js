import MD from 'markdown-it'
import {escapeHtml} from 'markdown-it/lib/common/utils.js'
import toc from "markdown-it-table-of-contents"
import anchor from "markdown-it-anchor"
import attrs from 'markdown-it-attrs'
import fs from 'fs'

function setUpMarkDown (lang) {
  const md = new MD()
  md.use(anchor, {
    permalink: anchor.permalink.linkInsideHeader({
      symbol: `
        <span class="anchor-link">#</span>
      `,
      placement: 'after',
      //renderHref: (slug) => '#' + lang + '/' + slug
    })
  })
  md.use(toc, {
    includeLevel: [1,2,3],
    //transformLink: (original) => lang + '/' + original
  })
  md.use(attrs, {
    // optional, these are default options
    leftDelimiter: '{',
    rightDelimiter: '}',
    allowedAttributes: []  // empty array = all attributes are allowed
  });

  // Save white space in Inline code
  md.use( md => {
    md.renderer.rules.code_inline = function (tokens, idx, options, env, slf) {
    var token = tokens[idx];

    return  '<code' + slf.renderAttrs(token) + '>' +
            escapeHtml(token.content).replaceAll(' ', '&nbsp;') +
            '</code>';
    }
  })
  return md
}

function buildDocs (lang) {
  if ( ! fs.statSync('public/' + lang))
    fs.mkdirSync('public/' + lang)
  const md = setUpMarkDown(lang)
  const doc = fs.readFileSync('./site/docs/'+lang+'/doc.md', 'utf-8')
  let tocHtml
  const rendered = md.render(doc).replace( /<p>TOCBEGIN(.*)TOCEND<\/p>/s, (match, p1) => {
    tocHtml = p1
    return ''
  })

  fs.writeFileSync('./public/'+lang+'/doc.html', rendered)
  fs.writeFileSync('./public/'+lang+'/toc.html', tocHtml)
}

['en','ja'].forEach( lang => buildDocs(lang) )
