TOCBEGIN
[[toc]]
TOCEND

# Why armtee?

This project has started for my another project, from modifying [Resig's Micro Templating](https://johnresig.com/blog/javascript-micro-templating/) for generic text template.

As of writhing this, there are still no armtee users, so here I'll descibe the reason _why I made armtee_, instead of promotional taglines.

## Development history

私は、これとは別のソフトの開発のために、テンプレートエンジンを探していましたが、小さくて拡張性が高く、ウェブ専用の余計な機能がついていないものです。
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
そうか、こいつはトランスコンパイラでもあるんだなあ、と考えを広げていって、思った以上に応用できる範囲が広そうな事に気づきました。


### Pure text templating
### Syntax Highlight

# Features

## Line oriented markup

テンプレートロジックと出力部分の緩やかだが明確な分離

### Syntax Highlight Friendly

### Multi Style, Multi Mode

複数のシンタックスを切り替えることで既存のsyntax highlightや入力補完を利用できる。

### Template only knows what is TAG

テンプレート内に埋め込むタグを各テンプレート側から自由に変更できます。これも従来のテンプレートエンジンにはなかった特徴かもしれません。

いくつかの出力スタイル

armteeを使ってテンプレートの出力を得るだけでなく、トランスコンパイルされたレンダラーをJSモジュールとして利用したり、JSONフォーマッタとしてシェルから利用するスクリプトにしたり出来る予定です。

# Template Syntax

## 行リテラルとTAG

armteeのテンプレートは、行(または複数行のブロック)単位で何を行うかが明確に別れています。
以下の４種類があります。

 - template
 - script
 - macro
 - comment

各行を`##! `のような、空白を含めた__4文字__ではじめることでarmteeにそれぞれの行が何かを伝えます。

ファイルのモードによって、それ以外の行はtemplate行かscript行であるとみなされます。

一般的ないわゆるテンプレートタグは、template行でのみ有効です。

### template

出力される内容を決定するテンプレートです。
テンプレートタグを埋め込んでJavaScriptの式を展開できます。

RMTで存在した`<% 文または文やブロックのの断片 %>`のような使い方はできません。

タグは改行をまたぐことはできません。ある行で始まったタグは、その行で終了する必要があります。
タグの中にメソッドチェーンを埋め込んでいたら一行に収まらなくなった。そんなときは、事前にスクリプトブロックで処理を行うことを検討してください。

### script

主にテンプレートのロジカルな処理を行うためのJavaScriptを記述します。改変されることなくトランスパイル後のファイルに出力されます。

script行にのみある制約として、JavaScriptとしてまとまった分割できない処理は間に別の種類の行や空行などを挟むことはできません。
armteeがデバッグ情報を埋め込むことが可能だと判断するためです。

```javascript
##! data.longNamedArrayMember
##!   .map( item => item.foo ? item.bar : item.buz )
##- comment: I found a bug so I'll add one more filter...
##!   .filter( item => item.mustBeTruthy )
```

### macro

armteeに各種の指定を行ったりします。

### comment

コメント行です。単に無視されます。

最初は`### `という記法でした。コメントのダメ押し感が好きだったのですが、まさに今ドキュメントをマークダウンで書いていて、バッティングすることに気づきやめました。
マイナスだから取り去るんだろうと思ってください。

## <% %> デフォルト

## Filter

## Predefined Macro

### Include

# API

# cli




