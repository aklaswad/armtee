const editor = ace.edit("tmpl");
const jsoneditor = ace.edit("json");
const outeditor = ace.edit("out");
const editors = [ editor, jsoneditor, outeditor ];
editors.forEach( editor => {
  editor.setTheme("ace/theme/pastel_on_dark");
  editor.session.setUseWrapMode(true);
})
outeditor.getSession().selection.on('changeSelection', function (e) {
  outeditor.getSession().selection.clearSelection();
});
outeditor.setHighlightActiveLine(false);
editor.session.setMode("ace/mode/markdown");
jsoneditor.session.setMode("ace/mode/json");
outeditor.session.setMode("ace/mode/json");
outeditor.setReadOnly(true)

import Armtee from '../lib/armtee.js'
Armtee.debug = 1
const out = document.getElementById('out')

function render() {
  const tmpl = editor.getValue()
  const json = jsoneditor.getValue()
  let data
  try {
    data = JSON.parse(json)
  }
  catch (e) {
    outeditor.setValue( 'Waiting for JSON format corrected' )
    return
  }
  try {
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    outeditor.setValue( armtee.render(data) )
  }
  catch (e) {
    console.log(e)
    outeditor.setValue(e.toString())
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
    const tmpl = editor.getValue()
    const armtee = Armtee.fromText(tmpl, { file: 'fromtext' })
    editor.setValue(armtee.convert(style,mode))
    evt.target.classList.add("selected")
  })
}
console.log(converts)
editor.session.on('change', render)
jsoneditor.session.on('change', render)
render()
