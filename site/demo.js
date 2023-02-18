import ace from 'brace'
import 'brace/theme/pastel_on_dark'
import 'brace/mode/json'
import 'brace/mode/markdown'
import 'brace/mode/javascript'

let closedFilters = 0
const editorIds = [ 'tmpl', 'json', 'trans', 'out' ]
const editorWrappers = []
const editors = {}
editorIds.forEach( editorId => {
  const editor = ace.edit(editorId)
  editor.setTheme("ace/theme/pastel_on_dark");
  editor.session.setUseWrapMode(false);
  editor.getSession().setUseWorker(false);
  editors[editorId] = editor

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

import Armtee from '../lib/armtee.js'
Armtee.debug = 1
const out = document.getElementById('out')

function render() {
  const tmpl = editors['tmpl'].getValue()
  const json = editors['json'].getValue()
  let data
  try {
    data = JSON.parse(json)
  }
  catch (e) {
    editors['out'].setValue( 'Waiting for JSON format corrected' )
    return
  }
  try {
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    Armtee.debug = 0
    editors['trans'].setValue( armtee.translate({mode:'function'}) )
    Armtee.debug = 1
    editors['out'].setValue( armtee.render(data, {mode: 'function'}) )
  }
  catch (e) {
    console.log(e)
    editors['out'].setValue(e.toString())
  }
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

editors['tmpl'].session.on('change', render)
editors['tmpl'].session.on('change', render)

render()
