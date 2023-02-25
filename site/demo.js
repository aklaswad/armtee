import { minimalSetup, EditorView } from 'codemirror'
import { EditorState, Compartment, StateField } from "@codemirror/state"
import { lineNumbers } from '@codemirror/view'
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

let closedEditors = 0
const editorIds = [ 'tmpl', 'json', 'trans', 'out' ]
const editorDefaults = {
  json: { lang: json() },
  tmpl: { lang: javascript() },
  trans: { lang: javascript(), readOnly: true },
  out:  { lang: markdown(), readOnly: true }
}

const editorWrappers = []
const editors = {}
editorIds.forEach( editorId => {
  const element = document.getElementById(editorId)
  const text = element.textContent
  element.innerText = ''
  const defaults = editorDefaults[editorId]
  const stateConfig = {
    doc: text,
    extensions: [ minimalSetup, lineNumbers(), oneDark, defaults.lang ],
  }
  let length = 0
  if ( editorId === 'tmpl' || editorId === 'json' ) {
    stateConfig.extensions.push(
      StateField.define({
        create() { return 0 },
        update(value, tr) {
          if ( tr._doc.length !== length ) {
            //XXX: ugly...
            setTimeout(() => { render() }, 1)
          }
          length = tr._doc.length
        }
      })
    )
  }
  if ( defaults.readOnly ) {
    stateConfig.extensions.push(
      EditorState.readOnly.of(true)
    )
  }
  const state = EditorState.create(stateConfig)
  const view = new EditorView({
    state,
    parent: element
  })
  editors[editorId] = view

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

import Armtee from '../lib/armtee.js'
Armtee.addFilter( 'upperCase', str => str.toUpperCase() )
const out = document.getElementById('out')

function replace(editorId, txt) {
  editors[editorId].dispatch({
    changes: {
      from: 0,
      to: editors[editorId].state.doc.length,
      insert: txt
    }
  })
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
  const tmpl = editors['tmpl'].state.doc.toString();
  const json = editors['json'].state.doc.toString();
  let data
  try {
    data = JSON.parse(json)
  }
  catch (e) {
    setError( 'Waiting for JSON format corrected')
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
    setError( e.toString() )
    return
  }
  setError()
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
    const tmpl = editors['tmpl'].state.doc.toString();
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    replace('tmpl',armtee.convert(currentStyle.style, currentStyle.mode))
    evt.target.text = newOne
  })
}

render()


function setUpDoc () {
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

  function openTocFor(href) {
    for ( let i=0; i < tocSubLists.length; i++ ) {
      tocSubLists[i].classList.remove('show')
    }
    for ( let i=0; i < toggles.length; i++ ) {
      toggles[i].classList.remove('selected')
    }

    let target = document.querySelector("a[href='" + href + "']")
    const container = document.querySelector("#toc")
    container.scrollTop = target.offsetTop - ( container.clientHeight / 2 )

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
    rootMargin: '0px 0px -50% 0px',
    threshold: 1.0
  }
  const observer = new IntersectionObserver(
    (evts) => {
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

  if (location.hash) {
    const hash = '#' + CSS.escape(location.hash.slice(1))
    openTocFor(hash)
    closeAllEditor()
    document.querySelector(hash).scrollIntoView()
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
