TOCBEGIN
[[toc]]
TOCEND

# クイックスタート

## インストール {#ja/install}

```
npm i armtee
```

## テンプレートを書いてみる {#ja/writing-template}


### CLIでレンダリングする。 {#ja/render-with-cli}

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
  { "name": "Charly" },
  { "name": "Decoy" }
]
```

これは以下のように実行できます。
```shell
$ npx armtee render friends.tmpl --json friends.json
 - Alice
 - Charly
 - Decoy
```

### JavaScript でレンダリングする。 {#ja/render-in-your-script}

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

# 特徴 {#ja/features}

armteeの主な機能と特徴

### 行指向のマークアップ {#ja/line-oriented-markup}

armteeのテンプレート文法は行単位で明確に異なる役割を持ちます。この事により以下のメリットが得られます。

#### ロジックと記述の分離

テンプレートロジックとテンプレート出力の記述を、同一ファイル内で取り扱いつつ、明確に分離させることで可読性とメンテナンス性を向上させます。

#### 既存のシンタックス解析機能との親和性

armteeの行修飾子はプログラム言語の行コメントに似せてあるため、うまく組み合わせることで、すでにあるsyntax highlightや入力補完の資産を簡単に再利用できます。

#### タグ記法のカプセル化

テンプレート内に埋め込むタグの形式をテンプレート側から自由に変更できます。
タグの形式(`<%`...`%>` なのか `{{`...`}}`なのか、のような)は、テンプレートが何を記述すべきかにあわせて選択されるべきで、それはテンプレートが知っていれば良いことです。armteeはテンプレートタグの処理と行単位の処理を分離することで、テンプレート側でタグ記述の形式変更が可能になっています。

### トランスパイラである {#ja/armtee-is-transpiler}

armteeを使って直接テンプレートの出力を得るだけでなく、トランスパイルされたレンダラーをファイルに出力できます。

#### JSモジュールとしての再利用

JSライブラリ開発の一部にarmteeを利用する場合などには、トランスパイルされたレンダラーをJSモジュールとして出力することで、実行時にarmteeに依存する必要がなくなります。

#### シンプルなデータ整形ツールの生成

特定のWebAPIから取得したJSONを読みやすいテキストやMarkdownに変換する単一機能の実行ファイルとして書き出すことで、日常の業務に利用することもできます。

# Template Syntax Guide {#ja/template-syntax-guide}

具体的にテンプレートの記述を見ていきましょう。
armteeのテンプレートは、後述するようにファイルモードやタグの記法を自由に選ぶ柔軟性がありますが、この文章内では説明がない場合は**hashy-template**モードで、タグはデフォルトのタグ記法 `<%`と`%>` で説明します。

## ファイルのモード {#ja/file-mode}


armteeのテンプレートは、行(または複数行のブロック)単位で何を行うかが明確に別れています。
以下の４種類があります。

 - Template
 - Script
 - Macro
 - Comment

各行を`##! `のような、__空白を含めた4文字__ ではじめることでarmteeにそれぞれの行が何かを伝えます。
この４文字を __行修飾子__ と呼びましょう。

すべての行に __行修飾子__ を付ける必要はありません。
テンプレート行、またはスクリプト行は __行修飾子__ を省略できます。（もしくは、省略しなければなりません。）どちらの行を省略するかは、これから説明するファイルのモードによって選ぶことができます。

### 2種類のスタイルと２種類のモード {#ja/2-styles-x-2-modes}

armteeのテンプレートではいくつかのバリエーションを持つシンタックスを使い分けることができます。

行修飾子は、`##! `のように２つのハッシュ`#`で始める **hashy** スタイルと、`//! `のように２つのスラッシュで始まる **slashy** スタイルがあります。

この意図はいくつかのプログラム言語に触れたことがあるユーザーには理解できると思います。{.offtopic}

２つのスタイルのどちらかを選んでテンプレートを書くことができます。


それに加えて、JavaScriptのロジック行に行修飾子を使用し、テンプレート行は行修飾子を使わずにそのまま書けると __テンプレートモード__ と、スクリプト行を修飾せずにそのまま書き、テンプレート行を行修飾子で記述する __ロジックモード__ を使い分けることができます。

まとめると、以下の４種類の記法が利用できます。これらは表面的なマークアップが異なるだけで、おなじ結果を出力します。

**hashy-template**

```
##! data.items.forEach( item => { // この行はscript行
##% TAG <% %>
##-  <-コメント行   ^^^ マクロ行
テンプレートからアイテム「<% item.toString() %>」を出力
##! })
```

**hashy-logic**
```
data.items.forEach( item => { // この行はscript行
##% TAG <% %>
##-  <-コメント行   ^^^ マクロ行
##> テンプレートからアイテム「<% item.toString() %>」を出力
})
```

**slashy-template**

```
//! data.items.forEach( item => { // この行はscript行
//% TAG <% %>
//-  <-コメント行   ^^^ マクロ行
テンプレートからアイテム「<% item.toString() %>」を出力
//! })
```

**slashy-logic**
```javascript
data.items.forEach( item => { // この行はscript行
//% TAG <% %>
//-  <-コメント行   ^^^ マクロ行
//> テンプレートからアイテム「<% item.toString() %>」を出力
})
```

これらの４つの記法は相互変換可能であり、記述したいテンプレートの内容や、その時の作業内容（テンプレートにフォーカスして作業しているか、あるいはJavaScriptのロジック作成にフォーカスしているか、など) に合わせて使い分けることができます。

armteeはテンプレートのロードの際には、これらのモードを自動的に判定します。(テンプレート行リテラルもscript行リテラルも存在しないなど）判定できない場合はテンプレートモードとみなされます。

これらの記法は１ファイルの中で混在させることはできません。
具体的には1ファイル中にhashyリテラルとslashyリテラルが同時に存在した場合、またはテンプレート行リテラルとscript行リテラルが同時に存在した場合には読み込みエラーとなります。

## 行修飾子 {#ja/line-descriptors}

### テンプレート行 {#ja/template-line}

出力される内容を決定するテンプレートです。
テンプレートタグを埋め込んでJavaScriptの式を展開できます。

テンプレートモードでは、他の行リテラルではないすべての行がテンプレート行になります。
ロジックモードでは、`##> ` （または`//> `)ではじまる行がテンプレート行になります。

他のマイクロテンプレートエンジンにあるような`<% 文または文やブロックの断片 %>`のような使い方はできません。すべてのタグ内部は評価可能なJavaScriptの式である必要があります。

タグは改行をまたぐことはできません。ある行で始まったタグは、その行で終了する必要があります。
タグの中にメソッドチェーンを埋め込んでいたら一行に収まらなくなった。そんなときは、事前にスクリプトブロックで処理を行うことを検討してください。

### スクリプト行 {#ja/script-line}

主にテンプレートのロジカルな処理を行うためのJavaScriptを記述します。改変されることなくトランスパイル後のファイルに出力されます。

テンプレートモードでは `##! ` または（`//! `）ではじまる行がscript行になります。
ロジックモードでは、他の行リテラルではないすべての行がscript行になります。

スクリプト行にのみある制約として、JavaScriptとしてまとまった分割できない処理は間に別の種類の行や空行などを挟むことはできません。（armteeは内部的には、スクリプト行のみ、まとまったブロックとして扱っています。）
armteeがデバッグ情報を埋め込むことが可能だと判断するためです。以下はうまく動かない例です。

```{.ng}
##! data.longNamedArrayMember
##!   .map( item => item.foo ? item.bar : item.buz )
##- comment: I found a bug so I'll add one more filter...
##!   .filter( item => item.mustBeTruthy )
```

逆に、複数行にまたがるスクリプト行でエラーが発生した場合、分割可能な場所に空行を追加することでエラー発生箇所が絞り込める場合もあります。 {.tips}

### マクロ行 {#ja/macro-line}

テンプレートの解析前に処理するべきことや、ユーティリティ関数の挿入など、様々な処理をマクロ行から行うことができます。
`##% `または `//% `ではじまる行がmacro行になります。

一般的には以下のような形でコマンド名、引数と記述します。

```
##% MACRONAME arg1 arg2...
```

### コメント行 {#ja/comment-line}

コメント行です。単に無視されます。

`##- `または  `//- `で始まる行がコメント行になります。

以前は `### ` という記法でした。コメントのダメ押し感が好きだったのですが、まさに今ドキュメントをマークダウンで書いていて、マークダウンのHeading記法と衝突することに気づき変更しました :-) 。
マイナスだから取り去るんだろうと思ってください。 {.offtopic}

## タグを記述する {#ja/writing-with-tags}

### テキストフィルタの利用 {#ja/using-text-filter}

テキストフィルタを利用できます。armteeに読み込まれたテキストフィルタは、いくつかの方法で利用できます。

armteeは読み込み済みのテキストフィルタを、トランスパイル時に`String.prototype`に`$`プレフィックスとともに注入します。これはタグ出力の際に利用できます。

```
 - <% data.text.$myFilter() %>
```

また、`FILTER`マクロを使って、すべてのタグ出力にフィルタを適用することもできます。

```
##% FILTER lower
My name is <% data.name %>
##% FILTER none
```

現在のところ、armteeに標準で搭載されているのは、`none`フィルタだけです。これは何もしないフィルタです。


## 宣言済みマクロ {#ja/predefined-macro}

マクロ行では、事前に用意されたいくつかのマクロを呼び出すことができます。コマンド名と、コマンドによってはいくつかの引数を空白区切りで渡す必要があります。

### ROOT {#ja/macro-root}

テンプレートの中でルートオブジェクトを受け取る際の変数名を指定できます。デフォルトでは`data`として渡されますが、そのテンプレートが何を扱うかを明確化するためなどいくつかの目的で変更を行えます。

```
My name is <% data.name %>
```

これはトランスパイルの出力としては以下のようになります。（実際の出力とは異なります。)

```javascript
((data,_$) => {
  _$`My name is ${ data.name }`
})(data,printer)
```

次のように`ROOT`を利用することで意図を明確にすることができます。

```
##% ROOT user
My name is <% user.name %>
```

```javascript
((user,_$) => {
  _$`My name is ${ user.name }`
})(data,printer)
```

[試す](#){.demo}{data-demo=root-change}

### TAG {#ja/macro-tag}

テンプレートの中で、以降の行でタグとして認識される記号のペアを設定できます。

```
##% TAG START_TAG END_TAG
```

以下のように、複数のタグ記法を同一テンプレート内で使い分けることもできます。
```
##% TAG {{ }}
My name is {{ data.name }}
##- Use another tag
##% TAG <! !>
I came from <! data.country !>
```

[試す](#){.demo}{data-demo=tag-change}

デフォルトは`<%` `%>`です。

### FILTER {#ja/macro-filter}

すべてのタグ出力に適用するフィルタを指定します。

```
##% FILTER escapeSomething
```

### INDENT {#ja/macro-indent}

出力にインデントを設定します。

```
##% INDENT < - | reset | +N(t(ab)?)? >
```
_Nは１０進数の整数_

INDENT マクロは以下の種類の命令を受け付けます。

 - `-`: 直近のインデントレベルを取り消します。
 - `reset`: すべてのインデントレベルを削除します。
 - `+N`: インデントレベルを追加します。
    - `##% INDENT +4` これは空白文字4個分のインデントを設定します。
    - `##% INDENT +1tab` これは1つのタブ文字(`'\t'`)をインデントに追加します。

[Try it](#){.demo}{data-demo=indent}


### INCLUDE {#ja/macro-include}

nodejs環境でのみ利用可能です。{.warning}

```
##% INCLUDE filepath <ROOT_ITEM>
```

他のテンプレートをインクルードします。インクルードはトランスパイル前に静的に処理されます。トランスパイル時、あるいはレンダリングの実行時に読み込むテンプレートを変更するようなことはできません。

読み込むテンプレートのパスは、現在のテンプレートからの相対パスになります。shellの$PATHのようなサーチパスやフォールバック機構はありません。

ROOT_ITEMを指定することで、現在のテンプレート内で有効なデータの一部だけを、読み込むテンプレートのロート処理対象として渡すことができます。省略した場合、呼び出し元テンプレートのルートデータが渡されます

TODO: 要検討{.author-note}

```
##! data.friends.forEach( friend => {
##%   INCLUDE deathnote.tmpl friend
##! })
```


## 定義済みテキストフィルタ {#ja/predefined-text-filters}

# チュートリアル {#ja/tutorial}

目的別に使い方を解説します。

## 拡張する {#ja/extending-armtee}

### Macroを追加する {#ja/add-macro}

マクロを追加することができます。

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

マクロはオブジェクトとして設定します。以下のいずれか（あるいは両方）のメンバを指定します。

#### precompile

トランスパイル実行前に呼び出されます。ArmteeBlockを戻り値として返すことで、自身の内容を別のブロックに置き換えることができます。

#### compile

トランスパイル実行時に呼び出されます。JavaScriptに変換可能な文字列を配列で返すことで、トランスパイルの内容を追加できます。


### Filterを追加する {#ja/add-filter}

テキストフィルターを追加することができます。
以下は文字列を大文字にするフィルタの例です。

```javascript
Armtee.addFilter( upper, str => str.toUpperCase() )
```

これはテンプレート内で以下のように利用できます。

```
##> I spell it <% "dmv".$upper() %>
```

[試す](#){.demo}{data-demo=add-filter}

# リファレンス {#ja/reference-guide}

機能の網羅的なガイドです。

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

現在、コマンドラインツールでは

 1. テンプレートファイルのシンタックスの変換
 1. テンプレートファイルを指定してのレンダリング処理
 1. テンプレートファイルのモジュールあるいはコマンドラインスクリプトへの変換

を行うコマンドが用意されています。詳細は以下のヘルプコマンドをご確認ください。

 - `$ npx armtee --help`
 - `$ npx armtee build --help`
 - `$ npx armtee render --help`
 - `$ npx armtee convert --help`

### ビルド結果のモジュール{#ja/about-module-output}

`armtee build --type module` コマンドを使ってESMを出力できます。
出力したモジュールは以下のように再利用できます。

```javascript
import * as foo from `./your-output.js`
console.log(foo.render(data))
```

### ビルド結果のスクリプト{#ja/about-script-output}

`armtee build --type script` コマンドを使って実行可能なスクリプトを出力できます。
出力したスクリプトは以下のように再利用できます。

```shell
$ armtee build --type script foo.tmpl > foo.cjs
$ ./foo.cjs --help
$ ./foo.cjs data.json
$ cat data.json | foo.cjs
```


# おまけ {#ja/appendix}


## なんでこんなの作ってんの {#ja/appendix-why}

私は、acliiというソフトの開発のために、純粋なテキストテンプレートエンジンを探していました。小さくて拡張性が高く、ウェブ専用の余計な機能がついていないものです。
強いて言えば Go のtext templateが理想に近いものでしたが、そのためだけに開発言語を Go に変更するのは厳しい状況でした。

正直言って単に自分のエンジンが欲しかっただけかも知れません。

懐かしいResig Micro Templatingを出発点に、HTMLに依存した部分を取り除くことからはじめました。
次に、ファイルのインクルードのために新しい構文を組み込みました。
RMTはJSをその場で生成する仕組みのため、おかしなところにファイルをインクルードするとJS自体が破壊されます。
どこにインクルードが行われるかをわかりやすくするよう、マクロ行のかたちにして事前処理することにしました。

私がそのときトライしていたのはBashスクリプトを生成するテンプレートだったので、`#`から始まる行にマクロを組み込めばシンタックスハイライトの邪魔にもならず都合が良かったのでそうしました。
すぐに、これは他のループ処理などの複雑な部分をテンプレートから分離することにも応用できることに気づきました。

このアイデアはなかなか気に入っています。でも、この頃までは、別のソフトの１モジュールのままにしておくべきだっと考えていました。
いまさらテンプレートエンジンを公開しても仕方ないと思っていたし、なにより決り文句「こいつはエスケープなんて丁寧なことはしてくれないから、なにがユーザー入力かもわからない状態でウェブコンテンツに出力させるな」といったやつを自分の口から言うのが嫌だったのもあります。

開発が進み、テンプレートが複雑になるに従ってデバッグが難しくなってきたので、もう少ししっかりとテンプレートと成果物のエラー行の対応を追跡できるように手を入れ始めました。まるでsource mapですね。
そうか、こいつはトランスコンパイラでもあるんだなあ、と考えを広げていって、思った以上に応用できる範囲が広そうな事に気づきました。そこでこれは公開する価値があるかも知れない、とはじめて思いました。

今はまだ開発の初期段階で、この先どうなるかわかりませんが、まあ何か価値のあるものを形にできれば嬉しいなと思ってます。


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

