# Structure patterns

## Source abstraction

The skill derives structural principles from two reference articles without copying their blog voice or fixed headings.

### PostgreSQL internals article

Source: [横断的に理解する PostgreSQL の内部データ構造](https://zenn.dev/calloc134/articles/postgres-internal-mvcc-index)

The article moves through these layers:

1. scope and omitted detail
2. system-level architecture and linked concepts
3. internal data structures and their fields
4. algorithms that operate on those structures
5. implementation differences that explain externally visible behavior
6. a final connection to an adjacent subsystem

The reusable principle is dependency order. Observable behavior is introduced at a high level, then explained using state, data structures, and algorithms. Source code appears as evidence after the abstract model.

### OAuth and OIDC article

Source: [OAuth/OIDCをまとめてみる](https://zenn.dev/calloc134/articles/5e8da6c491e720)

The article moves through these layers:

1. purpose and the central OAuth/OIDC distinction
2. actors and responsibilities
3. normal flow and exchanged artifacts
4. variants and the condition that distinguishes them
5. security failures as adversarial flows
6. mitigations linked to the point where the flow breaks
7. extension from OAuth to OIDC using mapped actors and artifacts

The reusable principle is relational order. Definitions become useful only after actors, artifacts, trust boundaries, and flows are connected. Difficult concepts are introduced as exceptions to an established normal model.

### Adaptation for this repository

Do not copy introductions, audience guidance, rhetorical questions, repeated summaries, or article-wide conclusions. Convert them as follows:

| Blog device               | Personal-note equivalent                     |
| ------------------------- | -------------------------------------------- |
| reader hook               | scope or decision-relevant distinction       |
| "what is X?" question     | short concept heading plus direct definition |
| tutorial scenario         | minimal boundary or state-transition example |
| "we will explain" preview | omit; the outline already exposes scope      |
| long recap                | comparison matrix, invariant, or no section  |
| author aside              | constraint, hypothesis, or omit              |
| omitted-topic apology     | related-note link or explicit scope boundary |

## Structural archetypes

### Concept or mechanism

Use when facts describe an internal model, architectural behavior, or causal mechanism.

```text
## 概要
## 位置づけ
## 構成要素
## 状態とデータ構造
## 処理
### 前提
### 判定または状態遷移
## 外部から見える動作
## 制約
## 関連メモ
## 参照リンク
```

Key test: can the reader trace an observed result backward to the rule and state that caused it?

### Protocol or flow

Use when multiple actors exchange requests, responses, tokens, messages, or authority.

```text
## 概要
## 適用範囲
## 登場主体
## 交換する情報
## 通常フロー
### 事前条件
### 要求
### 検証
### 結果
## フローの差分
## 脅威と失敗
## 参照リンク
```

Key test: for every artifact, are its issuer, holder, recipient, purpose, and validation responsibility clear?

### Product or service

Use when the page supports architecture or operations decisions about a product feature.

```text
## 概要
## 責任範囲
## リソースモデル
## ライフサイクル
## 操作
## 上限と制約
## 他サービスとの関係
## 参照リンク
```

Key test: can the reader distinguish what the service manages from what the user or another service must manage?

### Comparison or selection hub

Use when a page is mainly an entry point to several methods, products, or implementations.

```text
## 概要
## 選択軸
## 比較
## 各選択肢
## 組み合わせ
## 選択時の制約
## 関連メモ
```

Key test: can the reader select a detail note without reading every detail section first?

### Procedure or investigation

Use when the page records a reproducible operation or diagnostic sequence.

```text
## 目的
## 前提
## 手順
## 確認
## 失敗時の分岐
## ロールバックまたは後続作業
## 参照リンク
```

Key test: does each step have either an expected observation or a decision that determines the next step?

## Dependency mapping

Before rewriting, make a small private map:

```text
retrieval question
├── boundary or invariant
├── actors/components
│   └── owned artifacts/state
├── normal flow or lifecycle
│   └── validation/decision rule
├── variants
│   └── condition that changes behavior
└── constraints/failures
    └── cause and consequence
```

Use the map to detect these problems:

| Symptom                                        | Likely structural cause                   | Action                                                                                |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| the same term is redefined in several sections | dependency introduced too late            | define it once before the first use                                                   |
| sections read like unrelated facts             | missing relationship or primary axis      | name ownership, data flow, state change, or decision rule                             |
| comparison bullets keep nesting                | too many options on the same axes         | replace with a table                                                                  |
| every table row is repeated immediately below  | the page has two owners for the same fact | keep the mapping in the table; retain prose only for cause, exception, or consequence |
| examples are longer than rules                 | example is carrying the abstraction       | extract the invariant first, then shorten the example                                 |
| a page starts with commands or payloads        | evidence precedes the model               | move the abstract operation and prerequisites first                                   |
| constraints sit in a final catch-all section   | cause and consequence are separated       | move each constraint near the affected mechanism                                      |
| overview and implementation are interleaved    | multiple retrieval depths                 | keep selection in a hub and move deep operation to detail notes                       |
| every section ends with a recap                | article narration remains                 | retain only a reusable decision or invariant                                          |

## Claim preservation ledger

For a large rewrite, track each nontrivial source item privately:

| Existing item    | Destination                      | Treatment                                                 |
| ---------------- | -------------------------------- | --------------------------------------------------------- |
| verified claim   | relevant mechanism or constraint | preserve wording or paraphrase without changing certainty |
| official URL     | related section                  | preserve as `Doc:` or `API:`                              |
| code or payload  | operation it demonstrates        | keep minimal fields used by the explanation               |
| unverified claim | same topic                       | retain `（要確認）` or a callout                          |
| duplicate        | canonical section                | merge without restating                                   |
| unrelated detail | related note or omission         | move only when it remains useful                          |

This ledger prevents a visually cleaner outline from silently losing evidence or changing meaning.

## Final structural review

- The first section states the note's role, scope, or central distinction without a blog introduction
- One primary axis governs the section order
- Components or actors appear before flows that use them
- Artifacts and state have an owner, source, consumer, or lifecycle
- Variants identify the condition responsible for the difference
- Constraints sit near the mechanism that causes them
- Three or more comparable options use a stable comparison table
- A mapping or comparison has one primary representation; adjacent prose does not narrate the table row by row
- Examples demonstrate a preceding rule instead of replacing it
- Official sources sit near decision-relevant claims
- Unknown claims remain explicitly unknown
- No body `#` heading, reader address, writing-process commentary, or redundant conclusion remains
- The page still follows the repository's frontmatter, line wrapping, punctuation, and link conventions
