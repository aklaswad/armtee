//import { oneDark } from '@codemirror/theme-one-dark'
import * as monaco from 'monaco-editor'
//import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
//import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

import {Armtee} from '../dist/index.js'

let rendering = false

const commonEditorConfig = {
  language: 'javascript',
  minimap: {
    enabled: false
  },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  contextmenu: false,
  quickSuggestions: false,
  snippetSuggestions: false,
  suggestOnTriggerCharacters: false,
  tabCompletion: "off",
  fontSize: 15,
  autoClosingBrackets: "never",
}

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'html') {
      return new htmlWorker()
    }
    if (label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  }
}
let closedEditors = 0
const editorIds = [ 'tmpl', 'json', 'trans', 'out' ]
const editorDefaults = {
  json: { language: 'json' },
  tmpl: { language: 'html' },
  trans: { language: 'javascript', readOnly: true },
  out:  { language: 'html', readOnly: true }
}

monaco.editor.defineTheme("my-dark", {
	base: "vs-dark",
	inherit: true,
	rules: [{ background: "#282c34" }],
  colors: {
		"editor.background": "#282c34",
		"editor.lineHighlightBackground": "#282c34",
	}
})
monaco.editor.setTheme("my-dark")

const editorWrappers = []
const editors = {}
editorIds.forEach( editorId => {
  const element = document.getElementById(editorId)
  const text = element.textContent
  element.innerText = ''
  const defaults = editorDefaults[editorId]

  let length = 0
  if ( editorId === 'tmpl' || editorId === 'json' ) {
    //set up editable config
  }

  if ( defaults.readOnly ) {
    // set up readonly
  }

//  editors[editorId] = view
  const config = Object.assign({},commonEditorConfig, defaults)
  config.value = text
  const editor = monaco.editor.create(element, config)

  if ( !defaults.readOnly ) {
    editor.onDidChangeModelContent((e) => {
      if ( !rendering ) {
        render()
      }
    })
  }

  editors[editorId] = editor
  const wrapper = document.getElementById(editorId + '-editor-wrapper')
  editorWrappers.push(wrapper)
  const toggle = wrapper.getElementsByClassName('editor-toggle')
  toggle[0].addEventListener('click', (evt) => {
    if ( wrapper.classList.contains('off') ) {
      const len = editorWrappers.length
      const prev = `g${len - closedEditors}-${len}`
      editorWrappers.forEach( w => w.classList.remove(prev) )
      closedEditors--
      document.body.classList.remove('no-editor')
      const next = `g${len - closedEditors}-${len}`
      wrapper.classList.remove('off')
      editorWrappers.forEach( w => {
        if ( !w.classList.contains('off') )
          w.classList.add(next)
      })
    }
    else {
      const len = editorWrappers.length
      const prev = `g${len - closedEditors}-${len}`
      editorWrappers.forEach( w => w.classList.remove(prev) )
      closedEditors++
      if ( closedEditors === len ) {
        document.body.classList.add('no-editor')
      }
      const next = `g${len - closedEditors}-${len}`
      wrapper.classList.add('off')
      editorWrappers.forEach( w => {
        if ( ! w.classList.contains('off') )
          w.classList.add(next)
      })
    }
    evt.target.blur()
    evt.preventDefault()
    evt.stopPropagation()
  })
})

document.getElementById('editor-toggle').addEventListener( 'click', function (evt) {
  if ( document.body.classList.contains('no-editor') ) {
    openAllEditor()
  }
  else {
    closeAllEditor()
  }
  evt.target.blur()
  evt.preventDefault()
  evt.stopPropagation()
})

function openAllEditor () {
  const len = editorWrappers.length
  editorWrappers.forEach( w => {
    w.classList.remove('off')
    w.classList.add(`g${len}-${len}`)
    document.body.classList.remove('no-editor')
  })
  closedEditors = 0
}

function closeAllEditor () {
  const len = editorWrappers.length
  const prev = `g${len - closedEditors}-${len}`
  console.log(prev)
  editorWrappers.forEach( w => {
    w.classList.add('off')
    w.classList.remove(prev)
    document.body.classList.add('no-editor')
  })
  closedEditors = len
}

Armtee.addFilter( 'upperCase', str => str.toUpperCase() )
const out = document.getElementById('out')

function replace(editorId, txt) {
  editors[editorId].setValue(txt)
}

const errorBlock = document.getElementById('error-display')
function setError (error) {
  if (error) {
    errorBlock.classList.add('error')
    errorBlock.innerText = error
  }
  else {
    errorBlock.classList.remove('error')
  }
}

function render() {
  rendering = true
  const tmpl = editors['tmpl'].getValue()
  const json = editors['json'].getValue()
  let data
  try {
    data = JSON.parse(json)
  }
  catch (e) {
    setError( 'Waiting for JSON format corrected')
    rendering = false
    return
  }
  try {
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    replace('trans', armtee.translate({mode:'function'}))
    replace('out', armtee.render(data, {
      includeFilters: true,
      mode: 'function'
    }))
  }
  catch (e) {
    //console.log(e)
    rendering = false
    setError( e.toString() )
    return
  }
  setError()
  rendering = false
  return
}

const convertFlip = {
  style: { hashy: 'slashy', slashy: 'hashy' },
  mode:  { template: 'logic', logic: 'template' }
}

const currentStyle = {
  style: 'hashy',
  mode: 'template'
}

const converts = document.getElementsByClassName('convert')
for ( let i=0; i < converts.length; i++ ) {
  const mode = converts[i].getAttribute('data-type')

  const style = converts[i].getAttribute('data-style')
  converts[i].addEventListener('click', (evt) => {
    const type = evt.target.getAttribute('data-type')
    const newOne
      = currentStyle[type] = convertFlip[type][currentStyle[type]]
    const editor = editors['tmpl']
    const tmpl = editor.getValue();
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    replace('tmpl', armtee.convert(currentStyle.style, currentStyle.mode))
    const lang = currentStyle.mode === 'logic' ? 'javascript' : 'html'
    monaco.editor.setModelLanguage(editor.getModel(),lang)
    evt.target.text = newOne
    evt.target.blur()
    evt.preventDefault()
    evt.stopPropagation()

  })
}

render()


function setUpDoc () {
  let observeStop = false
  const toggles = document.querySelectorAll('#toc a')
  const tocSubLists = document.querySelectorAll('#toc ul ul')
  for ( let i=0; i < toggles.length; i++ ) {
    toggles[i].addEventListener('click', function(evt) {
      const href = evt.target.getAttribute('href')
      const child = evt.target.parentElement.querySelector(':scope > ul')
      if ( child ) {
        child.classList.add('show')
      }
    })
  }

  function openTocFor(href, noScroll) {
    for ( let i=0; i < tocSubLists.length; i++ ) {
      tocSubLists[i].classList.remove('show')
    }
    for ( let i=0; i < toggles.length; i++ ) {
      toggles[i].classList.remove('selected')
    }

    let target = document.querySelector("a[href='" + href + "']")
    const container = document.querySelector("#toc")
    if ( !noScroll ) {
      container.scrollTop = target.offsetTop - ( container.clientHeight / 2 )
    }
    const child = target.parentElement.querySelector(':scope > ul')
    if ( child ) {
      child.classList.add('show')
    }
    target.classList.add('selected')
    while (target.tagName !== 'DIV' ) {
      target.classList.add('show')
      target = target.parentElement
    }
  }

  const observeOptions = {
    root: document.querySelector('#content-wrapper'),
    rootMargin: '0px 0px -40% 0px',
    threshold: 1.0
  }

  const observer = new IntersectionObserver(
    (evts) => {
      if ( observeStop ) return
      const id = evts.filter(evt => evt.isIntersecting).map( e => e.target.id)[0]
      if ( id ) {
        openTocFor('#' + id)
      }

    }, observeOptions
  )
  document.querySelectorAll('#doc h1, #doc h2, #doc h3')
    .forEach( section => observer.observe(section) )

  window.addEventListener('hashchange', () => {
    openTocFor(location.hash)
  });

  document.querySelectorAll('#toc a')
    .forEach( elem => elem.addEventListener('click', (evt) => {
      observeStop = true
      setTimeout(() => observeStop = false, 100)
      const hash = elem.getAttribute('href')
      openTocFor(hash, true)
      document.getElementById(hash.slice(1)).scrollIntoView({block: 'top'})
      evt.target.blur()
      evt.preventDefault()
      evt.stopPropagation()
    }))

  if (location.hash) {
    const hash = '#' + CSS.escape(location.hash.slice(1))
    observeStop = true
    setTimeout(() => observeStop = false, 100)
    openTocFor(hash)
    closeAllEditor()
    document.querySelector(hash).scrollIntoView({block: 'top'})
  }
}

async function loadContent (configAry) {
  await Promise.all(
    configAry.map( conf => {
      return (async () => {
        const fetched = await fetch(conf.url)
        const html = await fetched.text()
        const dom = new DOMParser()
          .parseFromString(html, 'text/html')
        document.querySelector(conf.to)
          .append(...dom.body.childNodes)
      })()
    })
  )

  setTimeout(setUpDoc, 1)
}

loadContent([
  { url: 'doc.html', to: '#doc-content' },
  { url: 'toc.html', to: '#toc' }
])
