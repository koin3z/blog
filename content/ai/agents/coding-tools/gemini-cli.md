---
title: Gemini CLI
date: 2025-12-07
modified: 2026-07-21
draft: false
tags:
  - ai/coding-agents
aliases:
  - memos/gemini-cli
  - memos/ai-agent/coding-tools/gemini-cli
  - ai/agents/coding-tools/gemini-cli-mcp
  - memos/gemini-cli-mcp
  - memos/ai-agent/coding-tools/gemini-cli-mcp
description: Gemini CLI のプロンプト、コンテキストファイル、MCP 連携、設定構成を整理する。
---

## Prompt

- `/quit`でやめることができる
  - もしくはCtrl+Dを２回
- `@ファイル名`でファイルを読み込ませる
  - 例：`@package.json を見て，プロジェクトの概要を教えて`
- `!コマンド` でシェルコマンドを実行。
  - 例：`!ls -la`
  - escでもとに戻る
- `/clear`: 会話の履歴を忘れてリセット（新しい話題に移りたいとき）
- **`/chat save 名前`**: 今の会話を保存
- **`/chat resume 名前`**: 保存した会話を再開

## コンテキストファイル

- `.gemini/GENIMI.md`に配置
- `/memory add <指示内容>`でcliから指示ができる

```shell
> /memory add 日本語で返してください


ℹ Attempting to save to memory: "日本語で返してください"
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✓  SaveMemory in ~/.gemini/GEMINI.md                                                                                 │
│                                                                                                                      │
│ Okay, I've remembered that: "日本語で返してください"                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

ℹ Refreshing hierarchical memory (GEMINI.md or other context files)...

ℹ Memory refreshed successfully. Loaded 125 characters from 1 file(s).

╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ You are running Gemini CLI in your home directory. It is recommended to run in a project-specific directory.         │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

```

- ファイルができている

```shell
→ cat GEMINI.md
## Gemini Added Memories
- 日本語で返してください
```

## フォルダ構成

- Gemini CLIでは以下のようなディレクトリの構成を取る
- Claude Codeとは思想が異なり，階層的なコンテキストの結合と，MCPを中心として拡張に重きをおく

```
your-project/
├── GEMINI.md                  # チームの指示・プロジェクト全体のコンテキスト (コミット対象)
├── .geminiignore              # AIの読み取りから除外するファイル設定 (コミット対象)
│
├── frontend/
│   └── GEMINI.md              # サブディレクトリ固有のルール (階層的に結合される)
│
└── .gemini/
    ├── settings.json          # プロジェクト固有の設定 (グローバル設定を上書き)
    ├── sandbox-macos.sb       # (任意) 安全にコマンドを実行するためのカスタムサンドボックス設定
    └── sandbox.Dockerfile     # (任意) カスタムDockerサンドボックス環境
    │
    └── commands/              # カスタムスラッシュコマンド (拡張機能)
        ├── review.toml        # → /review コマンドを定義
        └── deploy.toml        # → /deploy コマンドを定義

~/.gemini/                     # グローバル (ユーザー) ディレクトリ
├── settings.json              # グローバル設定，MCPサーバー定義，UIテーマなど
├── GEMINI.md                  # 全プロジェクトに適用されるあなたのグローバル指示
├── .env                       # APIキーや環境変数 (ここに置くことも可能)
├── commands/                  # グローバルなカスタムコマンド (.tomlファイル群)
└── cache/                     # トークンキャッシュやセッション履歴などの内部データ
```

- `skills/` と `agents/` は「MCPサーバー」に集約される
  - Claude Codeのように専用のディレクトリを作ってプロンプトベースのWorkflow（スキルやエージェント）を管理するのではなく，Gemini CLIは業界標準の MCP (Model Context Protocol) の利用を推奨している
    - Geminiでの運用:
      - `~/.gemini/settings.json`（またはプロジェクトの `settings.json`）の `"mcpServers"` ブロックに，ローカルまたは外部のMCPサーバーを登録
      - これにより，コードレビュー用ツールやセキュリティ監査ツールなどを「外部ツール」としてAIにシームレスに提供
  - とはいえ，Agent Skillsに対応しているようなので，`skills`ディレクトリは作成可能
    - https://zenn.dev/hutonman/articles/47549ccf2ece12
    - https://geminicli.com/docs/cli/skills/
- `rules/` は「ディレクトリごとの `GEMINI.md`」で代用する
  - モジュール化されたルールファイル（`testing.md` など）を1箇所に集めるアプローチも可能だが，Gemini CLIの強みは階層型コンテキスト
    - Geminiでの運用:
      - フロントエンドのルールは `frontend/GEMINI.md` に，バックエンドの規約は `backend/GEMINI.md` に配置します。CLIを実行したディレクトリに応じて，ルートから現在のディレクトリまでの `GEMINI.md` が自動的に収集・マージされるため，必要なルールだけが動的に適用される
- `CLAUDE.local.md` や `settings.local.json` のような個人用の上書き機能
  - Gemini CLIには，デフォルトで `.local` のつく予約ファイルはない
    - Geminiでの運用:
      - プロジェクトの `.gemini/settings.json` にて `"contextFileName": ["GEMINI.md", "GEMINI.local.md"]` と指定し，`GEMINI.local.md` を `.gitignore` に追加することで全く同じ運用が可能

### settings.json

https://geminicli.com/docs/reference/configuration/#settings-files

- 設定ファイル

## Claude Clode と比較しての Gemini Cli の思想について

Doc: [MCP servers with the Gemini CLI](https://geminicli.com/docs/tools/mcp-server/)

- Claude Codeの `skills/` や `agents/` は，基本的に「高度なプロンプト（自然言語の指示）の集まり」
  - 仕組み:
    - 「あなたはセキュリティ監査員です。コードを読むときは以下の手順に従いなさい…」といった指示をMarkdownファイルに書き，特定のフォルダにおく
  - 特徴:
    - 自然言語で書けるため手軽だが，Claude Codeというツールの中でしか機能しない。また，基本的には「AIに対するテキストの指示」であるため，システムへの直接的なファイル操作や外部APIとの複雑な通信を行うには，LLM自身の能力やCLI側の暗黙の実装に強く依存する
- Gemini CLIが推奨する「MCP (Model Context Protocol)」のアプローチ

  - 一方の MCP (Model Context Protocol) は，「AIモデル」と「ローカルのデータやツール」を安全かつ標準的な方法で接続するために策定された業界標準のオープン規格
  - 専用のフォルダにMarkdownを書かせる代わりに，このMCPに対応した「MCPサーバー（独立したプログラム）」を連携させる方法をとっている

- これによって以下のようなメリットがある

1. **ツール非依存（Write once, use everywhere）**
   - Claude Code専用のスキルを作るとClaude Codeでしか使えないが，MCPサーバーとして「セキュリティ監査ツール」や「GitHub連携ツール」を作れば，Gemini CLIだけでなく，Claude Desktop，Cursor，その他のMCP対応AIエディタのどれからでも全く同じように呼び出して使うことができる
2. **「指示」ではなく「確実なプログラム実行」**
   - MCPサーバーはPythonやTypeScriptなどで書かれた実際のプログラム。
   - AIに「データベースを調べて」とテキストで曖昧に指示するのではなく，MCPサーバーが提供する `query_database` という明確な機能（Tool）をAIが呼び出し，プログラムが確実にSQLを実行して結果をAIに返す。
3. **セキュリティと権限の分離**
   - MCPサーバーはCLI本体とは別のプロセス（場合によってはDockerコンテナ内など）で動くため，「このMCPサーバーには読み取り権限しか与えない」といった細かなセキュリティ制御が可能

## 参照リンク

- https://github.com/google-gemini/gemini-cli
- https://zenn.dev/schroneko/articles/gemini-cli-tutorial
