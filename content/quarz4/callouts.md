---
title: callouts
tags:
  - notation
  - quartz4
publish: "true"
---

> [!abstruct] 参照リンク
> - [Callouts - Obsidian Help](https://help.obsidian.md/callouts)
> - [Callouts - Quartz 4](https://quartz.jzhao.xyz/features/callouts)（参考としてデザイン一覧もある）

## 基本

Quatrzでは次の12種類がデフォルトで用意されている。
- abstruct
- info
- todo
- tip
- success
- question
- warning
- failure
- danger
- bug
- example
- quate

マークダウンファイルでは以下のようにして記述する。Titleは省略可能で，間に１行空ける必要は特にない。
```
> [!abstruct] Here is a Title
> This is a callout!
```
> [!abstruct] Here is a Title
> 
> This is a callout!


タイトルのみにすることもできる
```
> [!info] Title-only callout
```
> [!info] Title-only callout

## 折りたたみ
タイプの識別子のあとに，` - `または` + `をつける事によって折りたたみにすることができる
```
> [!todo]- Are callouts foldable?
> Yes! In a foldable callout, the contents are hidden when the callout is collapsed.
```
> [!todo]- Are callouts foldable?
> Yes! In a foldable callout, the contents are hidden when the callout is collapsed.

## ネスト
ネスト（入れ子）することもできる。
```
> [!tip] Here is a Title
> This is a high-level callout, often used for summaries or key points.
> 
> > [!success] Nested Note
> > This is a nested callout. Use this for related information or side notes.
> > 
> > > [!question] Deep Nesting
> > > You can nest even further, but readability might suffer.
> 
> Additional text outside. （1行空ける必要がある）
```
> [!tip] Here is a Title
> This is a high-level callout, often used for summaries or key points.
> 
> > [!success] Nested Note
> > This is a nested callout. Use this for related information or side notes.
> > 
> > > [!question] Deep Nesting
> > > You can nest even further, but readability might suffer.
> 
> Additional text outside. （1行空ける必要がある）

## デザイン定義
デザイン定義ファイルは`quartz/styles/custom.scss`にSCSSとして記載がある。
カスタムしたい場合，以下のテンプレートが用意されている。
```
.callout {
  &[data-callout="custom"] {
    --color: #customcolor;
    --border: #custombordercolor;
    --bg: #custombg;
    --callout-icon: url("data:image/svg+xml; utf8, <custom formatted svg>"); //SVG icon code
  }
}
```

ちなみに参考として，Tipsは次のようになっている
```
  &[data-callout="tip"] {
    --color: #00bfa5;
    --border: #00bfa544;
    --bg: #00bfa510;
    --callout-icon: var(--callout-icon-tip);
  }
```
