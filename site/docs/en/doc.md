TOCBEGIN
[[toc]]
TOCEND

# Getting Started

## Install {#en/install}

```bash
npm i armtee
```

## Writing template {#en/writing-template}


### Render with CLI {#en/render-with-cli}

friends.tmpl
```
##% ROOT friends
##! friends.forEach( friend => {
 - <% friend.name %>
##! })
```

friends.json
```json
[
  { "name": "Alice" },
  { "name": "Carl" },
  { "name": "Decoy" }
]
```

They can be rendered from cli like this;

```shell
$ npx armtee render friends.tmpl --json friends.json
 - Alice
 - Charly
 - Decoy
```

### Render in Your Script {#en/render-in-your-script}

```javascript
import Armtee from 'armtee'
const data = [
  { name: 'Alice' },
  { name: 'Bob' }
]

const tmpl = `##! data.data.forEach( user => {
 - <% user.name %>
##!})`

console.log( Armtee.render(tmpl, data) )
// - Alice
// - Bob
```

# Features {#en/features}

Main features of armtee

## Line Oriented MarkUp {#en/line-oriented-markup}

armtee's template syntax have clearly different functions for each lines. By this, you can get these benefits;

#### Separation of Logic and Template Descriptions

Improve readability and maintainability by clearly separating template logic and template output descriptions while handling them in the same file.

#### Compatibility with existing syntax parsing functions

Because armtee's line modifiers mimic line comments in programming languages, they can easily be reused in conjunction with existing syntax highlighting and input completion assets.

#### Tag Notation Encapsulation

You can freely change the format of tags to be embedded in the template from the template side.
The tag format (`<%`... `%>` or `{{`... `}}`) should be chosen according to what the template needs to describe, which should be known by the template. armtee separates the processing of template tags from the line-by-line processing, allowing the template to change the format of tag descriptions.

## It's transpiler {#en/armtee-is-transpiler}

In addition to using armtee to directly get template output, you can output a transpiled renderer to a file.

#### Reuse as a JS module

If you use armtee as part of your JS library development, for example, you can output the transpiled renderer as a JS module so that you do not need to rely on armtee at runtime.

#### Generate a simple data shaping tool

Exporting JSON retrieved from a specific WebAPI as a single-function executable that converts it to readable text or Markdown can also be used for everyday tasks.

# Template Syntax Guide {#en/template-syntax-guide}

Let's look at the template description in detail.
Although armtee templates have the flexibility to choose file mode and tag notation as described below, we will use the **hashy-template** mode and default tag notation `<%` and `%>` for tags if not explained within this text.

## file mode {#en/file-mode}

The armtee templates are clearly separated by what they do on a line (or block of multiple lines) basis.
There are four types

 - Template
 - Script
 - Macro
 - Comment

Tells armtee what each line is about by formatting each line with __4 characters__ including spaces, such as `##! ` tells armtee what each line is about.
Let's call these four characters the __line descriptor__.

You don't need to start every lines with __line descriptor__. You can omit descriptor for template line or script line (in other words, you need to omit them.)
By the file mode, it'll be decided that which type of line descriptor should be omitted.

### 2 styles, 2 modes {#en/2-styles-x-2-modes}

The armtee template can use several different variations of line syntax.

Lines can contain **hashy** style, which begins with two hashes `#`, as in `##! `.

Also can use another **slashy** style, which begins with two slashes `/`, as in `//! `.

You can choose one from these 2 styles in a template.

This intention will be understood by users who have been exposed to several programming languages.{.offtopic}

In addition to that, there are 2 modes. In **template mode** you can write templates without line descriptors, and apply line descriptors for JavaScript logic lines.
In other **logic mode**, vice versa, you can write JavaScript without line descriptors, and instead use line descriptor for template lines.

Putting these together, the following four types of notation are available. They are different only for mark up looking, but will outputs same contents.

**hashy-template**

```
##! for ( let item of data ) { // This is script line
##% TAG <% %>
##- This is Comment line. ^^^ Macro line.
Template text, can use <% item.toString() %> tag.
##! } // Also script line.
```

**hashy-logic**
```
for ( let item of data ) { // This is script line
##% TAG <% %>
##- This is Comment line. ^^^ Macro line.
##> Template text, can use <% item.toString() %> tag.
} // Also script line.
```

**slashy-template**
```
//! for ( let item of data ) { // This is script line
//% TAG <% %>
//- This is Comment line. ^^^ Macro line.
Template text, can use <% item.toString() %> tag.
//! } // Also script line.
```

**slashy-logic**
```javascript
for ( let item of data ) { // This is script line
//% TAG <% %>
//- This is Comment line. ^^^ Macro line.
//> Template text, can use <% item.toString() %> tag.
} // Also script line.
```

These four notations are inter-convertible and can be used in different situations, depending on the template you wish to describe, whether you are working with a template in focus or creating logic (with syntax highlighting enabled).

armtee automatically detects these modes. If neither a template line literal nor a script line literal is present (for example, neither a template line literal nor a script line literal is present), it is assumed to be in template mode.

These notations cannot be mixed in a single file.
In these cases, templates could not be loaded;

 - Both hashy descriptor and slashy descriptor are exist in a same template
 - Both template line descriptor and script line descriptor are exist in same template

## Line descriptors {#en/line-descriptors}

### //> : Template {#en/template-line}

This template determines what is output.
You can embed template tags to expand JavaScript expressions.

In template mode, all lines that are not other line literals are template lines.
In logic mode, any line beginning with `##> ` (or `//> `) becomes a template line.

You cannot use `<% statement or sentence or block fragment %>` as in other micro template engines. All tag internals must be evaluatable JavaScript expressions.

Tags cannot span line breaks. Tags that begin on a line must end on that line.
If a method chain is embedded within a tag, it can no longer fit on a single line. If this is the case, consider using a script block to handle the process in advance.

### //! : Script {#en/script-line}

Describes JavaScript primarily for the logical processing of the template. It will be output to the transpiled file without modification.

In template mode, use `##! ` or (`//! `) will be the script lines.
In logic mode, all lines that not having line descriptor are script lines.

The only restriction on script lines is that processing that cannot be split up into coherent JavaScript lines cannot have another kind of line, blank line, etc., in between. (Internally, armtee treats only script lines as a coherent block.)
) The reason is that armtee determines that it is possible to embed debugging information. Here is an example of how it does not work.

```{.ng}
##! data.longNamedArrayMember
##!   .map( item => item.foo ? item.bar : item.buz )
##- comment: I found a bug so I'll add one more filter...
##!   .filter( item => item.mustBeTruthy )
```

Conversely, if an error occurs in a script line that spans multiple lines, adding a blank line in a place where it can be split may narrow down the error location. {.tips}

### //% : Macro {#en/macro-line}

Various things that should be processed before parsing the template, inserting utility functions, etc., can be done from macro lines.
Lines beginning with `##% ` or `//% ` are macro lines.

Generally, it is written with the command name and arguments in the following form.

```
##% MACRONAME arg1 arg2...
```

### //- : Comment {#en/comment-line}

Comment line. Simply ignored.

Lines starts with `##- ` or `//- ` are comment lines.

Previously, the notation for comment was `### `. I liked it since it make me feel it's strongly comment. But I'm writing a document in markdown right now, and I noticed that it conflicts with the Heading notation in markdown, so I changed it :-).{.offtopic}

## writing-with-tags {#en/writing-with-tags}

### using text filters {#en/using-text-filter}

You can use text filters loaded in armtee in several ways.

armtee will inject the loaded text filter into `String.prototype` with a `$` prefix at transpile time. This can be used for tag output.

```
 - <% data.text.$myFilter() %>
```

You can also use the `FILTER` macro to apply a filter to all tag output.

```
##% FILTER lower
My name is <% data.name %>
##% FILTER none
```

Currently, the only filter that comes standard with armtee is the `none` filter. This is a filter that does nothing.


## Declared macros {#en/predefined-macro}

The macro line allows you to call several pre-defined macros. The command name and, depending on the command, some arguments must be passed, separated by spaces.

### ROOT {#en/macro-root}

You can specify the name of the variable that will receive the root object in the template. By default, it is passed as `data`, but you can change it for several purposes, including to clarify what the template is supposed to handle.

```
My name is <% data.name %>
```

This will result in the following output from the transpile (not the actual output) (This is not the actual output.)

```javascript
((data,_$) => {
  _$`My name is ${ data.name }`
})(data,printer)
```

You can clarify your intent by using `ROOT` as follows.

```
##% ROOT user
My name is <% user.name %>
```

```javascript
((user,_$) => {
  _$`My name is ${ user.name }`
})(data,printer)
```

[Try it](#){.demo}{data-demo=root-change}

### TAG {#en/macro-tag}

You can set pairs of symbols that will be recognized as tags in subsequent lines in the template.

```
##% TAG START_TAG END_TAG
```

You can also use multiple tag notations in the same template, as follows

```
##% TAG {{ }}
My name is {{ data.name }}
##- Use another tag
##% TAG <! !>
I came from <! data.country !>
```

[Try it](#){.demo}{data-demo=tag-change}

Default is `<%` `%>`.

### FILTER {#en/macro-filter}

Specifies a filter to be applied to all tag output.

```
##% FILTER escapeSomething
```

### INDENT {#en/macro-indent}

Set indent level of upcoming outputs.

```
##% INDENT < - | reset | +N(t(ab)?)? >
```
_N could be an integer_

INDENT macro will accept these values.

 - `-`: Remove the latest indent level
 - `reset`: Unset all indent level
 - `+N`: Add indent level with N white spaces
    - `##% INDENT +4` will add 4 more spaces to the current indent level
    - `##% INDENT +1tab` will add 1 TAB (`'\t'`) to the current indent level

[Try it](#){.demo}{data-demo=indent}

### INCLUDE {#en/macro-include}

Available only in nodejs environment.{.warning}

```
##% INCLUDE filepath <ROOT_ITEM>
```

Include other templates. Includes are handled statically before transpiling. It is not possible to change the template to be loaded at transpile time or when rendering is performed.

The path of the template to be loaded is relative to the current template; there is no search path or fallback mechanism such as $PATH in shell.

By specifying ROOT_ITEM, only a portion of the data valid in the current template can be passed as the target of the read template's roto process. If omitted, the root data of the calling template is passed.

 (TODO consideration required){.author-note}

```
##! data.friends.forEach( friend => {
##%   INCLUDE deathnote.tmpl friend
##! })
```

## Preinstalled Filters {#en/predefined-text-filters}

# Tutorial {#en/tutorial}

This section explains how to use the system for each purpose.

## Extend {#en/extending-armtee}

### Add Macro {#en/add-macro}


```javascript
Armtee.addMacro( name, {
  precompile: (armtee, args, block) => {
    return [ ...ArmteeBlocks ]
  },
  compile: (armtee, args, block) => {
    return [ ...JavaScriptStrings ]
  }
})
```

A macro is set as an object. Specify one (or both) of the following members

#### precompile

Called before a transpile is executed, returning ArmteeBlock as return value to replace its own contents with another block.

#### compile

Called at transpile execution time to return an array of strings that can be converted to JavaScript to add content to the transpile.


### Add Filter {#en/add-filter}

You can add a text filter.
Here is an example of a filter that capitalizes strings.

```javascript
Armtee.addFilter( upper, str => str.toUpperCase() )
```

This can be used in a template as follows.

```
##> I spell it <% "dmv".$upper() %>
```

[Try it](#){.demo}{data-demo=add-filter}


# Reference guide {#en/reference-guide}

This is an exhaustive guide to the features.

## JavaScript API

### Armtee.render

```javascript
import Armtee from 'armtee'
const rendered = Armtee.render(templateText, data)
```
### Armtee.renderFile

```javascript
import Armtee from 'armtee'
const rendered = Armtee.renderFile(filename, data)
```

## Command Line Interface

Currently, the command line tool allows you to

 1. conversion of template file syntax
 1. rendering process by specifying a template file
 1. Conversion of template files to modules or command line scripts

For details, please refer to the following help commands.

 - `$ npx armtee --help`
 - `$ npx armtee build --help`
 - `$ npx armtee render --help`
 - `$ npx armtee convert --help`

### Module output{#en/about-module-output}

You can use ESM which printed by command `armtee build --type module` as like this;

```javascript
import * as foo from `./your-output.js`
console.log(foo.render(data))
```

### Script output{$en/about-script-output}

You can use script which printed by command `armtee build --type script` as like below

```shell
$ armtee build --type script foo.tmpl > foo.cjs
$ ./foo.cjs --help
$ ./foo.cjs data.json
$ cat data.json | foo.cjs
```

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;


> Some ot this text was translated with www.DeepL.com/Translator (free version)



