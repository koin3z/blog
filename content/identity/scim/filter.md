---
title: SCIM 2.0 Filter
date: 2026-04-04
modified: 2026-07-22
draft: false
tags:
  - identity/scim
aliases:
  - memos/identity/scim/scim2-filter
description: SCIM 2.0 Filter の構文と例を整理する。
---

## SCIM フィルターについて

- 多くのユーザーやグループの中から特定の条件に合致するリソースだけを抽出するための検索用語

```
+----------------+      GET /Users?filter=userName eq "test"     +-------------------+
|  SCIM Client   | --------------------------------------------> |    SCIM Server    |
| (Okta, Entra等)|                                               | (Filter Parser)   |
|                | <-------------------------------------------- |                   |
+----------------+         JSON (条件に一致したユーザーのみ)       +-------------------+
```

- SCIMクライアントがSCIMサーバー（IdPやプロビジョニング先のSaaSなど）に対してHTTP GETリクエストを送信する際、URLのクエリパラメータとして `filter=` の後に検索条件の文字列を付与
- サーバー側のパーサー（構文解析プログラム）は、この文字列の規則を読み取り、データベースへのクエリに変換して適切な結果を返却する

リクエストとレスポンスの往復は次のようになる。

![[attachments/scim-filter-request-flow.png|720]]

## 構文

### 最小単位のフィルター

- 最もシンプルかつ基本となるフィルター
- SCIMのフィルターは必ず以下の3つの要素（または `pr` 演算子の場合は2つの要素）で構成される

```
[ 属性名 (Attribute) ] + [ 演算子 (Operator) ] + [ 値 (Value) ]
       |                       |                       |
   userName                    eq                  "bjensen"

# 例
userName eq "bjensen"
```

- **属性名 (Attribute):**
  - 検索対象となるJSONデータのキー名
  - 大文字と小文字を区別しない（ただし、キャメルケースでの記述が推奨されている）
- **演算子 (Operator):**
  - どのように比較するかを指定する命令語
- **値 (Value):**
  - 検索したい具体的なデータ
  - 文字列（String）の場合は、必ずダブルクォーテーション `"` で囲む必要がある。
  - 数値や真偽値（`true`/`false`）の場合は引用符は不要

フィルターは属性名・演算子・値の3要素に分解できる。

![[attachments/scim-filter-anatomy.png|680]]

### 比較演算子

- 値の比較を定義する演算子として，以下がある

| **演算子** | **意味**                 | **英語の由来**   | **具体的な例**                                     |
| ---------- | ------------------------ | ---------------- | -------------------------------------------------- |
| `eq`       | 一致する                 | equal            | `userName eq "smith"`                              |
| `ne`       | 一致しない               | not equal        | `userType ne "Employee"`                           |
| `co`       | 含む（部分一致）         | contains         | `displayName co "John"`                            |
| `sw`       | から始まる（前方一致）   | starts with      | `userName sw "J"`                                  |
| `ew`       | で終わる（後方一致）     | ends with        | `userName ew "smith"`                              |
| `pr`       | 存在する（Nullではない） | present          | `title pr` （※値の指定は不要）                     |
| `gt`       | より大きい               | greater than     | `meta.lastModified gt "2023-01-01T00:00:00Z"`      |
| `ge`       | 以上                     | greater or equal | `age ge 20` （※標準スキーマにageはないが例として） |
| `lt`       | より小さい               | less than        | `meta.created lt "2023-01-01T00:00:00Z"`           |
| `le`       | 以下                     | less or equal    | `version le 2`                                     |

### 論理的演算子とグループ化

- 複数の条件を組み合わせる場合は、論理演算子（`and`, `or`, `not`）と、優先順位を決定するための丸括弧 `()` を使用

```
# 例
userType eq "Employee" and (title co "Manager" or title co "VP")

# 構造
						 [ AND ]
                        /       \
					   /         \
[userType eq "Employee"]        [ OR ]
							   /      \
							  /        \
			[title co "Manager"]      [title co "VP"]

```

この式は、`and`/`or`を内部ノード、各比較条件をリーフとする評価木として解釈される。

![[attachments/scim-filter-and-or-tree.png|640]]

※ `not` は条件を反転させる（例： `not (userName eq "admin")` ）。

### 複合属性のフィルタリング

- SCIMデータモデルにおける `emails`、`phoneNumbers`、`addresses` などの属性は、「配列（リスト）」の中に複数の「オブジェクト（キーと値のペア）」を格納する **複合属性（Complex Attributes）** という構造を持つ

- `属性名[ サブ属性の条件 ]` という構文をとる
  - 角括弧 `[]` を使うことで、「**同一の配列要素内**」で条件を満たすものを厳密に検索できます。

```
# 例
emails[type eq "work" and value co "@example.com"]
```

- 例えば，データは以下の構造を持つとし，このユーザーの中から、「`work`（仕事用）のメールアドレスとして、`@gmail.com` のアドレスを登録しているユーザー」を探したいとする

```
{
  "userName": "bjensen",
  "emails": [
    {
      "type": "work",
      "value": "bjensen@example.com"
    },
    {
      "type": "home",
      "value": "babs@gmail.com"
    }
  ]
}
```

- 上記の bjensen は検索にヒットしないユーザーのはず。
  - 通常のAND演算だと以下のようになるが，これは「全体としてworkのメールを持ち、全体として`@example.com`のメールを持つユーザー」という意味になるため，ヒットしてしまう

```
emails.type eq "work" and emails.value co "@gmail.com"
```

- 通常の論理演算子（`and`）でドット記法（`emails.type`）を用いると、パーサーは「ユーザーデータ全体のどこかにその値が存在するか」という**配列全体に対する独立した評価**を行ってしまう
- これを防ぎ、「配列の中の1つの要素（ブロック）の中だけで、複数の条件を同時に満たしているか」を評価するために用意された専用の構文が、角括弧 `[]` を用いた **Value Path**

## 参照リンク

-
