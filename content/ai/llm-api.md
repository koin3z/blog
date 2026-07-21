---
title: LLM API 形式
date: 2026-05-12
modified: 2026-07-21
draft: false
tags:
  - ai/llm
aliases:
  - memos/llm-api
  - memos/ai-agent/llm-api
  - ai/agents/llm-api
description: OpenAI Chat Completions、OpenAI Responses、Anthropic Messages の形式と状態管理を比較する。
---

## 概要

各APIの設計目的と対応している機能の全体像は以下の通り

| **項目**                 | **Chat Completions API**       | **Responses API**                                  | **Messages API**             |
| ------------------------ | ------------------------------ | -------------------------------------------------- | ---------------------------- |
| **プロバイダー**         | OpenAI                         | OpenAI                                             | Anthropic                    |
| **設計目的**             | ステートレスなテキスト生成     | 組み込みツールを活用したエージェント型ワークフロー | Claudeのネイティブ機能の活用 |
| **状態（履歴）管理**     | クライアント側（手動）         | サーバー側（オプションで可能）                     | クライアント側（手動）       |
| **組み込みツール**       | なし（外部で実行・管理が必要） | あり（Web検索、コード実行など）                    | あり（サーバーツール経由）   |
| **拡張思考機能**         | 非対応                         | 非対応                                             | 対応（Claudeのみ）           |
| **プロンプトキャッシュ** | 非対応                         | 非対応                                             | 対応                         |
| **エコシステムの互換性** | 最も広い（事実上の標準）       | 成長中                                             | Claude特化                   |
| **エンドポイント**       | `POST /v1/chat/completions`    | `POST /v1/responses`                               | `POST /v1/messages`          |

## 構造とデータの流れ（図解と詳細説明）

それぞれのAPIがどのようにデータをやり取りし、処理を行っているのかをシーケンス図で示し、各要素を補足する

### 1. Chat Completions API：事実上のユニバーサルスタンダード

```
[Client]                                    [API Endpoint]
     |                                              |
     |--- 1. メッセージ配列(user: こんにちは) --------->|
     |<-- 2. 応答メッセージ(assistant: はい) ---------|
     |                                              |
     |--- 3. メッセージ配列(以前の履歴 + 新しい質問) ---->| ※履歴は毎回全て送信する
     |<-- 4. 応答メッセージ -------------------------|
```

- **メッセージ配列の送信 (1, 3):** システム、ユーザー、アシスタントの各ロールを持ったメッセージの配列を送信
- **ステートレスな設計:** API側は以前の会話を記憶しない (3)。そのため、文脈を維持するには、クライアント側で会話履歴を管理し、毎回の通信で履歴全体を再送信する必要がある。
- **特徴:** 非常にシンプルなため、ほぼすべての主要なプロバイダー（Anthropic、Gemini、Mistralなど）で広くサポートされており、ベンダーの切り替えが最も容易な形式

### 2. Responses API：エージェント向けに構築された形式

```
[Client]                                    [API Endpoint (OpenAI)]
     |                                              |
     |--- 1. 入力("最新のニュースを調べて") ----------->|
     |                                              |---> [組み込みツール実行]
     |                                              |     (Web検索、ファイル検索など)
     |                                              |<--- [ツール実行結果]
     |<-- 2. 最終的な応答メッセージ ------------------|
     |                                              |
     |--- 3. 前回の応答ID + 新しい指示 -------------->| ※履歴全体を送る必要なし
```

- **組み込みツールの自動実行:** クライアントが1回リクエストを送るだけで、API側（サーバー側）が自律的に必要なツール（Web検索やコードインタープリタなど）を呼び出し、その結果を踏まえた最終的な回答を返す
- **サーバー側での状態管理 (3):** 以前の応答ID（`previous_response_id`）を参照するか、サーバー側で会話オブジェクトを維持することで、履歴全体を再送信することなく文脈を引き継ぐことができる。これによりトークンのオーバーヘッドを削減できる。

### 3. Messages API：Claudeのネイティブインターフェース

```
[Client]                                    [API Endpoint (Anthropic)]
     |                                              |
     |--- 1. メッセージ + 画像/PDFなどのリッチデータ --->|
     |                                              |---> [Extended Thinking]
     |                                              |     (複雑な推論プロセス)
     |<-- 2. 思考ブロック(推論過程) ------------------|
     |<-- 3. テキストブロック + 引用(Citations) ------|
```

- **リッチデータとプロンプトキャッシュ (1):** テキストだけでなく、画像やPDFなどを送信できる。また、特定のコンテンツブロックをキャッシュ（`cache_control`）して再利用し、コストとレイテンシを削減できる。
- **Extended Thinking (2):** Claude特有の機能で、最終的な回答を生成する前に、APIが内部で行った「思考・推論のプロセス（`thinking` ブロック）」を返す。
- **詳細な応答ブロック (3):** 応答は単一のメッセージではなく、思考ブロック、テキスト、ツール使用などの要素が配列として順番に返される。ソースドキュメントのどこを参照したかを示す「引用（Citations）」も含まれる。

## 具体的な使用例（Portkeyを介した呼び出し）

### 1. Chat Completions API の例

```
from portkey_ai import Portkey
portkey = Portkey(api_key="PORTKEY_API_KEY")
response = portkey.chat.completions.create(
    model="@openai-provider/gpt-5.2",
    messages=[{"role": "user", "content": "量子コンピューティングを簡単に説明して"}]
)
print(response.choices[0].message.content)
```

### 2. Responses API の例

```
from portkey_ai import Portkey
portkey = Portkey(api_key="PORTKEY_API_KEY")
response = portkey.responses.create(
    model="@openai-provider/gpt-4o",
    input="量子コンピューティングを簡単に説明して"
)
print(response.output_text)
```

### 3. Messages API の例

```
import anthropic
client = anthropic.Anthropic(api_key="PORTKEY_API_KEY", base_url="https://api.portkey.ai")
message = client.messages.create(
    model="@anthropic-provider/claude-sonnet-4-5-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "量子コンピューティングを簡単に説明して"}]
)
print(message.content[0].text)
```

## 参照リンク

- https://portkey.ai/blog/open-ai-responses-api-vs-chat-completions-vs-anthropic-anthropic-messages-api/
