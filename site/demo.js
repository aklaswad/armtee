import {Armtee} from '../src/index.ts'

import loader from '@monaco-editor/loader'
loader.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.33.0/min/vs' } })

let monaco
let rendering = false
let closedEditors = 0
let out
const editorWrappers = []
const editorIds = [ 'conf', 'json', 'tmpl', 'trans', 'out' ]

editorIds.forEach( editorId => {
  const wrapper = document.getElementById(editorId + '-editor-wrapper')
  editorWrappers.push(wrapper)
})
const editors = {}

const convertFlip = {
  style: { hashy: 'slashy', slashy: 'hashy' },
  mode:  { template: 'logic', logic: 'template' }
}
const editorDefaults = {
  conf: { language: 'javascript', value: `return {
  filters: {
    Hey: s => \`Hey ${'$'}{s}!\`
  },
  macros: {}
}` },
  json: { language: 'json', value: `{
  "name": "armTee",
  "fruits": [
    "Apple",
    "Blueberry",
    "Cinnamon"
  ]
}` },
  tmpl: { language: 'markdown', value: `# <% data.name.$Hey() %>
//- This shows list of items
//! data.fruits.forEach( fruit => {
 - <% fruit %>
//! })` },
  trans: { language: 'javascript', readOnly: true },
  out:  { language: 'markdown', readOnly: true }
}
const currentStyle = {
  style: 'hashy',
  mode: 'template'
}

const commonEditorConfig = {
  language: 'javascript',
  minimap: {
    enabled: false
  },
  automaticLayout: true,
  lineNumbersMinChars: 4,
  folding: false,
//  wordWrap: 'on',
  scrollBeyondLastLine: false,
  contextmenu: false,
  hover: {
    enabled: false
  },
  quickSuggestions: false,
  snippetSuggestions: false,
  suggestOnTriggerCharacters: false,
  tabCompletion: "off",
  fontSize: 15,
  autoClosingBrackets: "never",
}

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
      document.getElementById(hash.slice(1)).scrollIntoView({block: 'start'})
      evt.target.blur()
      evt.preventDefault()
      evt.stopPropagation()
    }))
  setTimeout( () => {
    if (location.hash) {
      const hash = '#' + CSS.escape(location.hash.slice(1))
      observeStop = true
      setTimeout(() => observeStop = false, 100)
      openTocFor(hash)
      closeAllEditor()
      const elem = document.querySelector(hash)
      if ( elem ) {
        elem.scrollIntoView({block: 'start'})
      }
    }
    document.body.classList.add('ready')
  }, 1 )

}

async function loadEditor () {

  monaco = await loader.init()

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

  try {
    const rendered = renderCore(
      editorDefaults.tmpl.value,
      editorDefaults.json.value,
      editorDefaults.conf.value,
    )
    editorDefaults.trans.value = rendered[0] || ''
    editorDefaults.out.value = rendered[1] || ''
  }
  catch (e) { /* ignore. don't stop rendering entire page */}

  editorIds.forEach( editorId => {
    const element = document.getElementById(editorId)
    element.innerText = ''
    const defaults = editorDefaults[editorId]

    let length = 0

    if ( defaults.readOnly ) {
      // set up readonly
    }

    const config = Object.assign({},commonEditorConfig, defaults)
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
}


function setUpPage () {

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
      const lang = currentStyle.mode === 'logic' ? 'javascript' : 'markdown'
      monaco.editor.setModelLanguage(editor.getModel(),lang)
      evt.target.text = newOne
      evt.target.blur()
      evt.preventDefault()
      evt.stopPropagation()

    })
  }
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
  out = document.getElementById('out')
}

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
  editorWrappers.forEach( w => {
    w.classList.add('off')
    w.classList.remove(prev)
    document.body.classList.add('no-editor')
  })
  closedEditors = len
}

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

function renderCore (tmpl, json, conf) {
  let data, compiled, rendered
  try {
    data = JSON.parse(json)
  }
  catch (e) {
    throw( 'Waiting for JSON format corrected: ' + e )
  }
  let confObj
  try {
    const confFunc = new Function('armtee', conf)
    confObj = confFunc()
  }
  catch (e) {
    throw( 'Waiting for conf JS syntax corrected: ' + e)
  }
  const armtee = Armtee.fromText(
    tmpl,
    Object.assign({}, { file: '__TEXT__' }, confObj)
  )
  compiled = armtee.translate({mode:'function'})
  rendered = armtee.render(data, {
  })

  return [compiled, rendered]
}

function render() {
  rendering = true
  const conf = editors['conf'].getValue()
  const tmpl = editors['tmpl'].getValue()
  const json = editors['json'].getValue()
  let res
  try {
    res = renderCore(tmpl,json,conf)
  }
  catch (e) {
    setError(e)
    rendering = false
    return
  }
  replace('trans', res[0])
  replace('out', res[1])
  setError()
  rendering = false
  return
}
if (location.hash) {
  closeAllEditor()
  document.querySelector('body').classList.add('hashed') 
}

async function main () {
  await Promise.all([
    loadEditor(),
    loadContent([
      { url: 'doc.html', to: '#doc-content' },
      { url: 'toc.html', to: '#toc' }
    ])
  ])
  setTimeout(() => {
    setUpPage()
    setTimeout( () => {
      setUpDoc()
    }, 20)
  }, location.hash ? 1 : 1000)
}
main()

