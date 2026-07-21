---
title: Google ADK Workflow Agent
date: 2026-03-29
modified: 2026-07-21
draft: false
tags:
  - ai/agents/google-adk
aliases:
  - memos/ai-agent/workflow-agent
  - ai/agents/workflow-agent
description: Google ADK Workflow Agent の順次実行、並列実行、ループによる構成を整理する。
---

## Workflow Agent

- サブエージェントの実行フローを制御する特殊なエージェント
- サブエージェントの実行フローをオーケストレーションするために設計されている特殊なADKのコンポーネント
- 主な役割は次の通り

  - 他のエージェントの実行方法実行タイミングを管理
  - プロセスの制御フローを定義

- LLMとは異なり，**事前定義されたロジックに基づいて動作**する
  - オーケストレーション自体についてはLLMを参照することはない
  - タイプ（シーケンシャル，パラレル，ループなど）に応じて実行順序を決定する
- これにより，決定論的で予測可能な実行パターンを実現する

※ 内部のサブエージェントはLLMを使用する

## Workflow Agent Type

### Sequential Agents（順次実行）

https://google.github.io/adk-docs/agents/workflow-agents/sequential-agents/

- サブエージェントをリストで指定された順序で実行するワークフローエージェント
- 固定された厳密な順序で実行したい場合に使用する

- データの受け渡し（Session State）
  - `output_key`で書き込み → 次のエージェントが `[key_name]` で読み取る

![[Pasted image 20260329161829.png]]

````python
from google.adk.agents import SequentialAgent, LlmAgent

# 定数
MODEL = "gemini-2.5-flash"

# ===== Step 1: コード生成 =====
code_writer = LlmAgent(
    name="CodeWriter",
    model=MODEL,
    instruction="""
    ユーザーのリクエストに基づいてPythonコードを生成してください。
    コードブロック（```python ... ```）のみを出力してください。
    """,
    description="Pythonコードを生成する",
    output_key="generated_code",  # ← 結果をstateに保存
)

# ===== Step 2: コードレビュー =====
code_reviewer = LlmAgent(
    name="CodeReviewer",
    model=MODEL,
    instruction="""
    以下のコードをレビューしてください: {generated_code}

    チェック項目:
    - バグや問題点
    - 改善できる点
    - セキュリティの懸念

    箇条書きでフィードバックを出力してください。
    """,
    description="コードをレビューする",
    output_key="review_comments",  # ← 結果をstateに保存
)

# ===== Step 3: リファクタリング =====
code_refactorer = LlmAgent(
    name="CodeRefactorer",
    model=MODEL,
    instruction="""
    元のコード: {generated_code}
    レビューコメント: {review_comments}

    レビューコメントに基づいてコードを改善してください。
    最終的なコードブロック（```python ... ```）のみを出力してください。
    """,
    description="レビューに基づいてコードを改善する",
    output_key="final_code",
)

# ===== パイプラインを組み立て =====
root_agent = SequentialAgent(
    name="CodePipeline",
    sub_agents=[code_writer, code_reviewer, code_refactorer],
    description="コードの生成、レビュー、改善を順次実行する",
)
````

**実行イメージ**:

```
[user]: フィボナッチ数列を計算する関数を作って

[CodeWriter → CodeReviewer → CodeRefactorer]

最終出力: 改善されたコード
```

### Parallel Agents（並列実行）

https://google.github.io/adk-docs/agents/workflow-agents/parallel-agents/#how-it-works

- サブエージェントを同時に（並行して）実行するワークフローエージェント
- 独立したタスクを並列実行することで，処理時間を大幅に短縮できる

※ 競合を避けるため，各エージェントは異なる`output_key`に書き込む

![[Pasted image 20260329162024.png]]

```python
from google.adk.agents import SequentialAgent, ParallelAgent, LlmAgent
from google.adk.tools import google_search

MODEL = "gemini-2.0-flash"

# ===== 並列で実行するリサーチャー =====

news_researcher = LlmAgent(
    name="NewsResearcher",
    model=MODEL,
    instruction="""
    指定されたトピックについて、最新のニュースを検索してください。
    主要な3つのニュースを要約してください。
    """,
    description="ニュースを検索する",
    tools=[google_search],
    output_key="news_results",  # 固有のキー
)

academic_researcher = LlmAgent(
    name="AcademicResearcher",
    model=MODEL,
    instruction="""
    指定されたトピックについて、学術的な情報を検索してください。
    重要な研究や論文の概要を説明してください。
    """,
    description="学術情報を検索する",
    tools=[google_search],
    output_key="academic_results",  # 固有のキー
)

social_researcher = LlmAgent(
    name="SocialResearcher",
    model=MODEL,
    instruction="""
    指定されたトピックについて、SNSやコミュニティでの反応を検索してください。
    一般的な意見や傾向をまとめてください。
    """,
    description="SNSの反応を検索する",
    tools=[google_search],
    output_key="social_results",  # 固有のキー
)

# ===== 並列実行エージェント =====
parallel_research = ParallelAgent(
    name="ParallelResearch",
    sub_agents=[news_researcher, academic_researcher, social_researcher],
    description="3つのソースから同時に情報を収集する",
)

# ===== 結果を統合するエージェント =====
synthesizer = LlmAgent(
    name="Synthesizer",
    model=MODEL,
    instruction="""
    以下の3つのソースからの情報を統合してレポートを作成してください:

    ## ニュース情報
    {news_results}

    ## 学術情報
    {academic_results}

    ## SNSの反応
    {social_results}

    これらを総合的に分析し、構造化されたレポートを作成してください。
    """,
    description="複数ソースの情報を統合する",
)

# ===== Sequential + Parallel の組み合わせ =====
root_agent = SequentialAgent(
    name="ResearchPipeline",
    sub_agents=[parallel_research, synthesizer],  # 並列実行 → 統合
    description="並列リサーチと統合を行う",
)
```

### Loop Agents（繰り返し実行）

https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/

- サブエージェントをループ（反復的に）実行するワークフローエージェント
- 指定された回数または終了条件が満たされるまで繰り返し実行する

- 終了条件は次の２つ
  1.  `max_iterations`に達する
  2.  `exit_loop`ツールが呼ばれる

![[Pasted image 20260329162700.png]]

```python
from google.adk.agents import SequentialAgent, LoopAgent, LlmAgent
from google.adk.tools.tool_context import ToolContext

MODEL = "gemini-2.5-flash"

# ===== 終了ツールの定義 =====
def exit_loop(tool_context: ToolContext) -> dict:
    """
    品質が十分と判断されたときに呼び出して、ループを終了します。
    批評で「問題なし」と判断された場合にのみ呼び出してください。
    """
    print(f"[exit_loop] ループ終了が {tool_context.agent_name} によってトリガーされました")
    tool_context.actions.escalate = True
    return {"status": "loop_terminated"}


# ===== Step 1: 批評家 =====
critic = LlmAgent(
    name="Critic",
    model=MODEL,
    instruction="""
    以下の文章をレビューしてください: {current_draft}

    チェック項目:
    - 文法の誤り
    - 論理の一貫性
    - 表現の明確さ

    問題がある場合: 具体的な改善点を指摘してください。
    問題がない場合: 「問題なし」とだけ回答してください。
    """,
    description="文章を批評する",
    output_key="criticism",
)

# ===== Step 2: 改善者 =====
refiner = LlmAgent(
    name="Refiner",
    model=MODEL,
    instruction="""
    元の文章: {current_draft}
    批評: {criticism}

    批評が「問題なし」の場合:
    → exit_loop ツールを呼び出してループを終了してください。

    改善点がある場合:
    → 文章を改善して出力してください。
    """,
    description="批評に基づいて文章を改善する",
    tools=[exit_loop],
    output_key="current_draft",  # 改善版で上書き
)

# ===== ループエージェント =====
refinement_loop = LoopAgent(
    name="RefinementLoop",
    sub_agents=[critic, refiner],
    max_iterations=5,  # 最大5回まで
    description="批評と改善を繰り返す",
)

# ===== 初稿作成 + ループ =====
initial_writer = LlmAgent(
    name="InitialWriter",
    model=MODEL,
    instruction="""
    ユーザーのリクエストに基づいて、初稿を作成してください。
    """,
    description="初稿を作成する",
    output_key="current_draft",
)

# ===== 全体のパイプライン =====
root_agent = SequentialAgent(
    name="WritingPipeline",
    sub_agents=[initial_writer, refinement_loop],
    description="初稿作成 → 反復改善",
)
```

## 参照リンク

- https://google.github.io/adk-docs/agents/workflow-agents/
