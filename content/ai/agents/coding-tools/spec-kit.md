---
title: Spec Kit
date: 2026-04-04
modified: 2026-07-21
draft: false
tags:
  - ai/coding-agents
aliases:
  - memos/ai-agent/speckit
  - ai/agents/speckit
description: Spec Kit による仕様駆動の開発ワークフローを整理する。
---

- GitHubが公開したオープンソースのツールキットで，AIコーディングエージェント（GitHub Copilot、Claude Code、Gemini CLIなど）と連携してSpec-Driven Development（仕様駆動開発）を実現するもの
- 従来の「vibe-coding」（アイデアを伝えてコードを生成し、動かなければ修正を繰り返す）アプローチではなく、まず仕様（spec）を定義し、それを実装・テスト・検証の基盤とすることで、より品質の高いコードを生成
- インストールは uv で行う

## 開発ワークフロー

### Phase 1: `/speckit.constitution` - 原則の定義

- constitution.mdは、プロジェクトの譲れない原則を確立するドキュメント
- テストアプローチ、技術スタック、コーディング規約などを定義する

```
/speckit.constitution
コード品質、テスト、UXの一貫性を重視する
```

### Phase 2: `/speckit.specify` - 仕様の作成

- `/specify`コマンドで高レベルなプロンプトを提供し、「何を」「なぜ」構築するかに焦点をあてる
- 技術的な詳細ではなく、目的と要件を明確にする

```
/speckit.specify
タスク管理アプリを開発する。ユーザー認証、リアルタイムコラボレーション、
モバイル対応を含める。Kanbanスタイルでタスクをボード間で移動できるようにする。
```

### Phase 3: `/speckit.plan` - 技術計画の作成

- `/plan`コマンドで技術的な実装計画を作成
- 高レベルな技術的方向性を提供し、アーキテクチャと制約を尊重した詳細な計画が生成される

```
/speckit.plan
Vite、vanilla JS、ローカルストレージ用にSQLiteを使用
```

### Phase 4: `/speckit.tasks` - タスクの分解

- `/tasks`コマンドで仕様と計画を実行可能なタスクのリストに分解

```
/speckit.tasks
```

- 生成されるタスクは非常に細かく、各ステップが明確に記述される
  - 人間がタスクを割り当てる際に陥りがちな「知識の呪い」（暗黙の前提を置いてしまう）を避け、AIが正確に実行できる形になる

### Phase 5: `/speckit.implement` - 実装の実行

- 全てのタスクを最後まで実行し、機能を構築

```
/speckit.implement
```

### 追加コマンド

- /speckit.clarify
  - 不明確な要件についてAIが質問
- /speckit.analyze
  - 仕様・計画・タスクの一貫性をチェック

## ベストプラクティス

- **仕様を先に完成させる** - 「何を」「なぜ」を明確にしてから「どのように」に進む
- **曖昧な仕様で進まない** - `/clarify`でリスクを排除してからコーディング
- **`/analyze`で整合性チェック** - 実装前に仕様・計画・タスクの不整合を検出
- **AIは補助、人間が検証** - Spec Kitはコパイロットであり、置き換えではない

## フォルダ構成

- `specify init` を実行すると、以下のような構成が作成される

```
my-project/
├── .specify/                      # Spec Kit のメインディレクトリ
│   ├── memory/                    # プロジェクトの記憶・原則
│   │   └── constitution.md        # プロジェクトの憲法（開発原則）
│   │
│   ├── scripts/                   # ヘルパースクリプト
│   │   ├── check-prerequisites.sh # 前提条件チェック
│   │   ├── common.sh              # 共通関数
│   │   ├── create-new-feature.sh  # 新機能ブランチ作成
│   │   ├── setup-plan.sh          # 計画セットアップ
│   │   └── update-claude-md.sh    # CLAUDE.md 更新
│   │
│   ├── specs/                     # 仕様書ディレクトリ
│   │   └── 001-feature-name/      # 各機能の仕様（番号付きブランチ）
│   │       ├── spec.md            # 機能仕様書
│   │       ├── plan.md            # 技術実装計画
│   │       ├── tasks.md           # タスク分解
│   │       ├── research.md        # 技術調査メモ
│   │       ├── data-model.md      # データモデル定義
│   │       ├── quickstart.md      # クイックスタートガイド
│   │       └── contracts/         # API契約
│   │           ├── api-spec.json  # REST API仕様
│   │           └── signalr-spec.md # SignalR仕様（例）
│   │
│   └── templates/                 # テンプレートファイル
│       ├── spec-template.md       # 仕様書テンプレート
│       ├── plan-template.md       # 計画テンプレート
│       ├── tasks-template.md      # タスクテンプレート
│       └── CLAUDE-template.md     # CLAUDE.md テンプレート
│
├── .claude/                       # Claude Code 用（--ai claude の場合）
│   └── commands/                  # スラッシュコマンド定義
│       ├── speckit.constitution.md
│       ├── speckit.specify.md
│       ├── speckit.plan.md
│       ├── speckit.tasks.md
│       └── speckit.implement.md
│
└── CLAUDE.md                      # プロジェクトコンテキスト（Claude用）
```

### 📁 `.specify/memory/`

| ファイル          | 説明                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `constitution.md` | プロジェクトの**憲法**。コード品質、テスト基準、UX一貫性などの譲れない原則を定義 |

### 📁 `.specify/specs/<feature>/`

- 各機能ごとに番号付きディレクトリが作成される（例: `001-create-taskify`）

| ファイル        | 説明                                         | 作成タイミング        |
| --------------- | -------------------------------------------- | --------------------- |
| `spec.md`       | 機能仕様書（ユーザーストーリー、要件）       | `/speckit.specify` 後 |
| `plan.md`       | 技術実装計画（アーキテクチャ、技術スタック） | `/speckit.plan` 後    |
| `tasks.md`      | 実装タスクの詳細分解                         | `/speckit.tasks` 後   |
| `research.md`   | 技術調査・ライブラリ調査メモ                 | 計画時に自動生成      |
| `data-model.md` | データベース/データモデル設計                | 計画時に自動生成      |
| `contracts/`    | API仕様（OpenAPI等）                         | 計画時に自動生成      |

### 📁 `.specify/templates/`

- 各ドキュメントのテンプレート。カスタマイズ可能。

### 📁 `.specify/scripts/`

- Git操作やセットアップを自動化するシェルスクリプト。

### フローにおけるフォルダ構成の変化

```
初期化後:
.specify/
├── memory/constitution.md     ← 空または基本テンプレート
├── templates/
└── scripts/

↓ /speckit.constitution 実行後

.specify/
├── memory/constitution.md     ← 原則が記載される
├── templates/
└── scripts/

↓ /speckit.specify 実行後

.specify/
├── memory/constitution.md
├── specs/
│   └── 001-my-feature/
│       └── spec.md            ← 仕様書が作成される
├── templates/
└── scripts/

↓ /speckit.plan 実行後

.specify/
├── memory/constitution.md
├── specs/
│   └── 001-my-feature/
│       ├── spec.md
│       ├── plan.md            ← 技術計画が追加
│       ├── research.md        ← 調査メモが追加
│       ├── data-model.md      ← データモデルが追加
│       └── contracts/
│           └── api-spec.json  ← API仕様が追加
├── templates/
└── scripts/

↓ /speckit.tasks 実行後

.specify/
├── specs/
│   └── 001-my-feature/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md           ← タスク分解が追加
│       └── ...
└── ...
```

## 開発サイクル

```
┌─────────────────────────────────────────────────────────────┐
│                      開発サイクル                            │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │ Constitution │  ← プロジェクト原則（最初に1回、必要時に更新）
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐     ┌──────────────┐
    │   Specify    │ ←→  │   Clarify    │  ← 仕様と明確化を往復
    └──────┬───────┘     └──────────────┘
           │
           ▼
    ┌──────────────┐
    │     Plan     │  ← 技術計画
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐     ┌──────────────┐
    │    Tasks     │ ←→  │   Analyze    │  ← 整合性チェック
    └──────┬───────┘     └──────────────┘
           │
           ▼
    ┌──────────────┐
    │  Implement   │  ← 実装
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ テスト・検証  │
    └──────┬───────┘
           │
           ├──→ 問題なし → 完了 ✓
           │
           └──→ 問題あり → 該当フェーズに戻る ↺
```

### 仕様を変更したい場合

- 仕様を変更した場合、planとtasksを再生成する必要がある

```
# 1. 仕様書を直接編集、または対話で変更を指示
/speckit.specify 追加要件：ユーザーがタスクにラベルを付けられるようにする

# 2. 計画を再生成（仕様変更を反映）
/speckit.plan

# 3. タスクを再生成
/speckit.tasks

# 4. 整合性チェック
/speckit.analyze

# 5. 実装
/speckit.implement
```

### 実装に問題が見つかった場合

```
実装中にバグ発見
       │
       ▼
┌─────────────────────────────────────────┐
│ 問題の種類を判断                          │
└─────────────────────────────────────────┘
       │
       ├─── 単純なバグ ──→ その場で修正（AIに指示）
       │
       ├─── 設計の問題 ──→ plan.md を更新 → tasks再生成
       │
       └─── 要件の問題 ──→ spec.md を更新 → plan → tasks 再生成
```

### 既存プロジェクトへの機能追加

```
# 1. 既存プロジェクトで初期化
cd existing-project
specify init --here --ai claude

# 2. 既存のアーキテクチャを反映したconstitutionを作成
/speckit.constitution
既存のSpring Boot + PostgreSQLアーキテクチャを尊重する。
既存のAPIパターンに従う。セキュリティ要件を維持する。

# 3. 追加機能の仕様を作成
/speckit.specify
既存の請求マイクロサービスに保留中トランザクション検証機能を追加

# 4. 以降は通常のフロー
/speckit.plan
/speckit.tasks
/speckit.implement
```

### イテレーション戦略

- Spec Kitは「ビッグバン」コーディングアプローチを分解パイプラインに置き換える
- Feature → User Stories → Tasks → Iterative Implementation
- 20〜30ファイルにまたがる機能全体を一度に実装するのではなく、1〜2ファイル、数分で完了する小さなタスクに分解する

```
大きな機能
    │
    ▼
┌─────────────────┐
│  User Story 1   │ → Task 1.1 → Task 1.2 → Task 1.3 → ✓ 検証
├─────────────────┤
│  User Story 2   │ → Task 2.1 → Task 2.2 → ✓ 検証
├─────────────────┤
│  User Story 3   │ → Task 3.1 → Task 3.2 → Task 3.3 → Task 3.4 → ✓ 検証
└─────────────────┘
```

### 品質のチェック

- 各フェーズで品質を確保する
- `clarify`と`analyze`は、通常スキップしがちな曖昧さを見つけ、コーディング中に誰かに質問したり、回答がなくブロックされたりすることを防ぐ

| タイミング   | コマンド              | 目的                                 |
| ------------ | --------------------- | ------------------------------------ |
| 仕様作成後   | `/speckit.clarify`    | 曖昧な要件を特定・明確化             |
| 計画作成後   | `/speckit.checklist`  | 要件の完全性・一貫性を検証           |
| タスク作成後 | `/speckit.analyze`    | 仕様・計画・タスク間の整合性チェック |
| 実装後       | 手動テスト + レビュー | 動作確認                             |

### イテレーションパターン

| 状況               | 戻るフェーズ | 再実行が必要なフェーズ   |
| ------------------ | ------------ | ------------------------ |
| 要件の追加・変更   | Specify      | Plan → Tasks → Implement |
| 技術スタックの変更 | Plan         | Tasks → Implement        |
| タスクの順序変更   | Tasks        | Implement                |
| 実装の軽微な修正   | なし         | その場で修正             |
| 原則・規約の変更   | Constitution | 影響範囲に応じて         |

## 参照リンク

- https://github.com/github/spec-kit
