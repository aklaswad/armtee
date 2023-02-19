import { minimalSetup, EditorView } from 'codemirror'
import { EditorState, Compartment, StateField } from "@codemirror/state"
import { lineNumbers } from '@codemirror/view'
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

let closedFilters = 0
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
  console.log(view)
  editors[editorId] = view

  const wrapper = document.getElementById(editorId + '-editor-wrapper')
  editorWrappers.push(wrapper)

  const toggle = wrapper.getElementsByClassName('editor-toggle')
  toggle[0].addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopImmediatePropagation()
    if ( wrapper.classList.contains('off') ) {
      const len = editorWrappers.length
      const prev = `g${len - closedFilters}-${len}`
      editorWrappers.forEach( w => w.classList.remove(prev) )
      closedFilters--
      const next = `g${len - closedFilters}-${len}`
      wrapper.classList.remove('off')
      editorWrappers.forEach( w => {
        if ( !w.classList.contains('off') )
          w.classList.add(next)
      })
    }
    else {
      const len = editorWrappers.length
      const prev = `g${len - closedFilters}-${len}`
      editorWrappers.forEach( w => w.classList.remove(prev) )
      closedFilters++
      const next = `g${len - closedFilters}-${len}`
      wrapper.classList.add('off')
      editorWrappers.forEach( w => {
        if ( ! w.classList.contains('off') )
          w.classList.add(next)
      })
    }
  })
})
/*
editors['tmpl'].session.setMode("ace/mode/markdown");
editors['json'].session.setMode("ace/mode/json");
editors['trans'].session.setMode("ace/mode/javascript");

['out','trans'].forEach( editorId => {
  const editor = editors[editorId]
  editor.getSession().selection.on('changeSelection', function (e) {
    editor.getSession().selection.clearSelection();
  });
  editor.setHighlightActiveLine(false);
  editor.session.setMode("ace/mode/json");
  editor.setReadOnly(true)
})
*/

import Armtee from '../lib/armtee.js'
Armtee.debug = 1
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
    Armtee.debug = 0
    replace('trans', armtee.translate({mode:'function'}))
    Armtee.debug = 1
    replace('out', armtee.render(data, {mode: 'function'}))
  }
  catch (e) {
    //console.log(e)
    setError( e.toString() )
    return
  }
  setError()
  return
}

const converts = document.getElementsByClassName('convert')
for ( let i=0; i < converts.length; i++ ) {
  const mode = converts[i].getAttribute('data-mode')
  const style = converts[i].getAttribute('data-style')
  console.log({ mode, style })
  converts[i].addEventListener('click', (evt) => {
    for ( let i=0; i < converts.length; i++ ) {
      converts[i].classList.remove("selected")
    }
    const tmpl = editors['tmpl'].getValue()
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    editors['tmpl'].setValue(armtee.convert(style,mode))
    evt.target.classList.add("selected")
  })
}

render()
