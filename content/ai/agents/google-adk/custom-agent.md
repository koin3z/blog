---
title: Google ADK Custom Agent
date: 2026-03-30
modified: 2026-07-21
draft: false
tags:
  - ai/agents/google-adk
aliases:
  - memos/ai-agent/custom-agent
  - ai/agents/custom-agent
description: Google ADK Custom Agent の InvocationContext、Event、Action、実装パターンを整理する。
---

## カスタム・エージェント

https://adk-labs.github.io/adk-docs/ja/agents/custom-agents/

- `BaseAgent`を直接継承して独自の制御フローを実装することで，任意のオーケストレーションロジックを定義
- 上記の `SequentialAgent`，`LoopAgent`，`ParallelAgent`といった事前定義のパターンを超えたフローを定義できる

- 本質的には`google.adk.agents.BaseAgent`を継承し，中核となる実行ロジックを`_run_async_impl`非同期メソッド内に実装して作成する任意のクラス

- 一般的なパターンでは実装できない以下のような要件で使用する
  - **条件付きロジック**：実行時の条件や前のステップの結果に基づいて、異なるサブエージェントを実行したり、異なるパスをたどる場合
  - **複雑な状態管理**：単純な逐次的な受け渡しを超えて、ワークフロー全体で状態を維持・更新するための複雑なロジックを実装する場合
  - **外部との統合**：オーケストレーションのフロー制御内で、外部API、データベース、またはカスタムライブラリへの呼び出しを直接組み込む場合
  - **動的なエージェント選択**：状況や入力の動的な評価に基づいて、次に実行するサブエージェントを選択する場合
  - **独自のワークフローパターン**：標準的なシーケンシャル、パラレル、またはループ構造に適合しないオーケストレーションロジックを実装する場合

![[Pasted image 20260330002946.png]]
![[Pasted image 20260330002231.png]]

```python
from typing import AsyncGenerator
from typing_extensions import override
from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event

class MinimalCustomAgent(BaseAgent):
    """最小限のカスタムエージェント"""

    name: str = "minimal_agent"
    description: str = "シンプルなカスタムエージェント"

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        # 何らかの処理...
        result = "Hello from Custom Agent!"

        # 必ず1つ以上のEventをyieldする
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=result)]
            )
        )
```

![[Pasted image 20260330002310.png]]

```python
# InvocationContextの使い方

async def _run_async_impl(self, ctx: InvocationContext):

    # ===== 状態の読み書き =====
    # 読み取り
    user_name = ctx.session.state.get("user_name", "ゲスト")

    # 書き込み
    ctx.session.state["processed"] = True
    ctx.session.state["result"] = {"score": 95}

    # ===== ユーザー入力の取得 =====
    if ctx.user_content and ctx.user_content.parts:
        user_message = ctx.user_content.parts[0].text

    # ===== 会話履歴の参照 =====
    for event in ctx.session.events:
        print(f"{event.author}: {event.content}")
```

- Eventの構造

```python
from google.adk.events import Event, EventActions
from google.genai import types

# 基本的なEvent
yield Event(
    author=self.name,  # 誰が発行したか
    content=types.Content(
        role="model",
        parts=[types.Part(text="結果テキスト")]
    )
)

# アクション付きEvent（ループ終了など）
yield Event(
    author=self.name,
    actions=EventActions(
        escalate=True,  # ループを抜ける
        skip_summarization=True
    )
)
```

### 例１：条件分岐エージェント

![[Pasted image 20260330002446.png]]

```python
from typing import AsyncGenerator
from typing_extensions import override
from google.adk.agents import BaseAgent, LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event

MODEL = "gemini-2.0-flash"

class ConditionalRoutingAgent(BaseAgent):
    """ユーザータイプに基づいて異なるエージェントにルーティング"""

    name: str = "routing_agent"
    description: str = "ユーザータイプ別にルーティングする"

    # サブエージェントを属性として定義
    premium_agent: LlmAgent = None
    standard_agent: LlmAgent = None

    def __init__(self, **kwargs):
        # サブエージェントを初期化
        premium = LlmAgent(
            name="PremiumAgent",
            model=MODEL,
            instruction="""
            あなたはプレミアムユーザー専用のアシスタントです。
            高度な分析、優先サポート、詳細な回答を提供してください。
            """,
        )
        standard = LlmAgent(
            name="StandardAgent",
            model=MODEL,
            instruction="""
            あなたは一般ユーザー向けのアシスタントです。
            基本的な質問に簡潔に回答してください。
            """,
        )

        super().__init__(
            premium_agent=premium,
            standard_agent=standard,
            sub_agents=[premium, standard],  # ADKに登録
            **kwargs
        )

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        # 状態からユーザータイプを取得
        user_type = ctx.session.state.get("user_type", "standard")

        # 条件分岐！
        if user_type == "premium":
            # プレミアムエージェントを実行
            async for event in self.premium_agent.run_async(ctx):
                yield event
        else:
            # スタンダードエージェントを実行
            async for event in self.standard_agent.run_async(ctx):
                yield event


# 使用例
root_agent = ConditionalRoutingAgent()
```

### 例２：状態チェッカー（LoopAgentと組み合わせ）

```python
from typing import AsyncGenerator
from typing_extensions import override
from google.adk.agents import BaseAgent, LlmAgent, LoopAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event, EventActions

class QualityChecker(BaseAgent):
    """品質をチェックし、基準を満たしたらループを終了"""

    name: str = "quality_checker"
    description: str = "品質基準をチェックする"

    quality_threshold: int = 80  # 品質基準

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        # 状態から品質スコアを取得
        quality_score = ctx.session.state.get("quality_score", 0)
        iteration = ctx.session.state.get("iteration", 0)

        # イテレーション数を更新
        ctx.session.state["iteration"] = iteration + 1

        print(f"[QualityChecker] スコア: {quality_score}, 反復: {iteration + 1}")

        # 品質基準を満たしたか、最大反復数に達したか
        if quality_score >= self.quality_threshold:
            print("[QualityChecker] 品質基準を満たしました！ループ終了")
            yield Event(
                author=self.name,
                actions=EventActions(escalate=True)  # ループを抜ける
            )
        elif iteration >= 5:
            print("[QualityChecker] 最大反復数に達しました")
            yield Event(
                author=self.name,
                actions=EventActions(escalate=True)
            )
        else:
            # 続行
            yield Event(
                author=self.name,
                content=None  # 何も出力せず続行
            )


# LoopAgentと組み合わせ
processor = LlmAgent(
    name="Processor",
    model="gemini-2.0-flash",
    instruction="""
    {current_draft}を改善してください。
    改善後、品質スコア（0-100）を判定し、state["quality_score"]に記録してください。
    """,
    output_key="current_draft",
)

quality_loop = LoopAgent(
    name="QualityLoop",
    sub_agents=[processor, QualityChecker()],
    max_iterations=10,
)
```

### 例３：複雑なワークフロー（ストーリー生成）

![[Pasted image 20260330002731.png]]

```python
from typing import AsyncGenerator
from typing_extensions import override
from google.adk.agents import BaseAgent, LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types

MODEL = "gemini-2.0-flash"

class StoryFlowAgent(BaseAgent):
    """ストーリー生成・批評・改善・トーンチェックのワークフロー"""

    name: str = "story_flow_agent"
    description: str = "ストーリーを生成し、品質が良くなるまで改善する"

    # サブエージェント
    story_generator: LlmAgent = None
    critic: LlmAgent = None
    reviser: LlmAgent = None
    tone_checker: LlmAgent = None

    max_regenerations: int = 3

    def __init__(self, **kwargs):
        story_generator = LlmAgent(
            name="StoryGenerator",
            model=MODEL,
            instruction="与えられたテーマでショートストーリーを生成してください。",
            output_key="current_story",
        )

        critic = LlmAgent(
            name="Critic",
            model=MODEL,
            instruction="""
            以下のストーリーを批評してください: {current_story}
            改善点を具体的に指摘してください。
            """,
            output_key="criticism",
        )

        reviser = LlmAgent(
            name="Reviser",
            model=MODEL,
            instruction="""
            ストーリー: {current_story}
            批評: {criticism}

            批評を反映してストーリーを改善してください。
            """,
            output_key="current_story",
        )

        tone_checker = LlmAgent(
            name="ToneChecker",
            model=MODEL,
            instruction="""
            以下のストーリーのトーンを判定してください: {current_story}

            "positive"（前向き・希望がある）または "negative"（暗い・悲観的）
            のどちらか1単語だけを出力してください。
            """,
            output_key="tone",
        )

        super().__init__(
            story_generator=story_generator,
            critic=critic,
            reviser=reviser,
            tone_checker=tone_checker,
            sub_agents=[story_generator, critic, reviser, tone_checker],
            **kwargs
        )

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        regeneration_count = 0

        while regeneration_count < self.max_regenerations:
            print(f"[StoryFlow] === 生成サイクル {regeneration_count + 1} ===")

            # Step 1: ストーリー生成
            print("[StoryFlow] ストーリー生成中...")
            async for event in self.story_generator.run_async(ctx):
                yield event

            # Step 2: 批評
            print("[StoryFlow] 批評中...")
            async for event in self.critic.run_async(ctx):
                yield event

            # Step 3: 改善
            print("[StoryFlow] 改善中...")
            async for event in self.reviser.run_async(ctx):
                yield event

            # Step 4: トーンチェック
            print("[StoryFlow] トーンチェック中...")
            async for event in self.tone_checker.run_async(ctx):
                yield event

            # トーンを確認
            tone = ctx.session.state.get("tone", "").strip().lower()
            print(f"[StoryFlow] 検出されたトーン: {tone}")

            if "positive" in tone:
                print("[StoryFlow] ポジティブなトーン！完成！")
                # 最終結果を出力
                final_story = ctx.session.state.get("current_story", "")
                yield Event(
                    author=self.name,
                    content=types.Content(
                        role="model",
                        parts=[types.Part(text=f"【完成したストーリー】\n\n{final_story}")]
                    )
                )
                return  # 終了
            else:
                print("[StoryFlow] ネガティブなトーン。再生成します...")
                regeneration_count += 1

        # 最大回数に達した
        print("[StoryFlow] 最大再生成回数に達しました")
        final_story = ctx.session.state.get("current_story", "")
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"【最終ストーリー（改善上限）】\n\n{final_story}")]
            )
        )

# 使用
root_agent = StoryFlowAgent()
```

## `_run_aync_impl`

- カスタムエージェントの中心はこの `_run_async_impl`メソッドになる
  - **ここで独自の動作を定義する**

```python
async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
```

- `_run_async_impl` は必ず最低1つの Event を yield しなければならない

![[Pasted image 20260330004159.png]]

- aync である理由
  - エージェントはAPI呼び出し、DB接続、ファイル読み書きなど「待機」が発生する処理が多い。
  - `async`を使うと、待機中に他の処理を実行でき効率的。

```python
# 普通の関数
def normal_function():
    return "結果"

# 非同期関数（async）
async def async_function():
    await some_io_operation()  # I/O待機中に他の処理ができる
    return "結果"
```

## AsyncGenerator

`async` + `Generator` = `AsyncGenerator`

- `async def`関数であり、`AsyncGenerator`を返す必要がある

  - これにより、サブエージェントや自身のロジックによって生成されたイベントを`yield`でランナーに返すことができる

- 型ヒント: `AsyncGenerator[YieldType, SendType]`
  - `YieldType`: yield する値の型（ADKでは `Event`）
  - `SendType`: 外部から送り込む値の型（通常 `None`）

```python
from typing import AsyncGenerator

# 非同期ジェネレータ
async def my_async_generator() -> AsyncGenerator[str, None]:
    await asyncio.sleep(1)
    yield "結果1"  # 1秒後

    await asyncio.sleep(1)
    yield "結果2"  # 2秒後

    await asyncio.sleep(1)
    yield "結果3"  # 3秒後

# 使う側（async for で受け取る）
async for item in my_async_generator():
    print(item)
```

## ctx (InvocationContext)

- 要な実行時情報
- 特に`ctx.session.state`へのアクセスを提供
  - カスタムエージェントがオーケストレーションするステップ間でデータを共有する主要な方法

## Event

- Event の構造
  ![[Pasted image 20260330004545.png]]
- Event の生成

```python
from google.adk.events import Event, EventActions
from google.genai import types

# ===== パターン1: テキストを出力 =====
yield Event(
    author=self.name,
    content=types.Content(
        role="model",
        parts=[types.Part(text="こんにちは！処理が完了しました。")]
    )
)

# ===== パターン2: 何も出力せず続行（内部イベント） =====
yield Event(
    author=self.name,
    content=None  # または省略
)

# ===== パターン3: ループを終了 =====
yield Event(
    author=self.name,
    actions=EventActions(escalate=True)
)

# ===== パターン4: テキスト出力 + ループ終了 =====
yield Event(
    author=self.name,
    content=types.Content(
        role="model",
        parts=[types.Part(text="完了しました！")]
    ),
    actions=EventActions(escalate=True)
)
```

## Event yield

![[Pasted image 20260330004049.png]]

```python
# ===== return: 全部終わってから1回だけ返す =====
def get_results():
    results = []
    results.append(process_1())  # 3秒
    results.append(process_2())  # 3秒
    results.append(process_3())  # 3秒
    return results  # 9秒後にまとめて返す

# ===== yield: 途中で何度も返せる =====
def get_results_streaming():
    yield process_1()  # 3秒後に返す
    yield process_2()  # 6秒後に返す
    yield process_3()  # 9秒後に返す

# 使う側
for result in get_results_streaming():
    print(result)  # 3秒ごとに表示される！
```

![[Pasted image 20260330004617.png]]

### パターン１：シンプル（最後に1回yield）

```python
from typing import AsyncGenerator
from typing_extensions import override
from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types

class SimpleAgent(BaseAgent):
    name: str = "simple_agent"

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        # 処理1
        data = ctx.session.state.get("input", "デフォルト")

        # 処理2
        result = f"処理結果: {data.upper()}"

        # 処理3
        ctx.session.state["output"] = result

        # 最後に1回だけ yield
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=result)]
            )
        )
```

### パターン2： 進捗表示（途中で複数回yield）

```python
class ProgressAgent(BaseAgent):
    name: str = "progress_agent"

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        # ステップ1
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text="📊 データを取得中...")]
            )
        )

        await asyncio.sleep(1)  # 模擬的な処理時間
        data = "サンプルデータ"

        # ステップ2
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text="🔄 データを分析中...")]
            )
        )

        await asyncio.sleep(1)
        analysis = f"分析結果: {data}"

        # ステップ3（最終）
        yield Event(
            author=self.name,
            content=types.Content(
                role="model",
                parts=[types.Part(text=f"✅ 完了！\n{analysis}")]
            )
        )
```

### パターン3: サブエージェントの中継

```python
class OrchestratorAgent(BaseAgent):
    name: str = "orchestrator"

    researcher: LlmAgent = None
    writer: LlmAgent = None

    def __init__(self, **kwargs):
        researcher = LlmAgent(
            name="Researcher",
            model="gemini-2.0-flash",
            instruction="トピックについて調査してください。",
            output_key="research",
        )
        writer = LlmAgent(
            name="Writer",
            model="gemini-2.0-flash",
            instruction="調査結果 {research} を基に記事を書いてください。",
        )

        super().__init__(
            researcher=researcher,
            writer=writer,
            sub_agents=[researcher, writer],
            **kwargs
        )

    @override
    async def _run_async_impl(
        self,
        ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:

        # サブエージェント1を実行し、全イベントを中継
        async for event in self.researcher.run_async(ctx):
            yield event  # ← そのまま外に出す！

        # サブエージェント2を実行し、全イベントを中継
        async for event in self.writer.run_async(ctx):
            yield event  # ← そのまま外に出す！
```

## 参照リンク

-
