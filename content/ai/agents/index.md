---
title: AI Agent
date: 2026-07-21
modified: 2026-07-21
draft: false
tags:
  - ai/agents
aliases: []
description: AI Agent の共通要素、Google ADK、Coding Agent、MCP 関連メモへの入口。
---

## 概要

- Agent の共通要素と、Framework や Coding tool に固有の実装を分けて参照する
- Protocol の認可を確認する場合は MCP、Model API の形式を比較する場合は LLM API へ進む

## 選択

| 確認する対象                        | 入口                                                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool の引数、戻り値、エラー処理     | [[ai/agents/tools\|Agent Tools]]                                                                                                                                                               |
| Google ADK の制御フロー             | [[ai/agents/google-adk/workflow-agent\|Workflow Agent]]、[[ai/agents/google-adk/custom-agent\|Custom Agent]]                                                                                   |
| Coding Agent と仕様駆動ワークフロー | [[ai/agents/coding-tools/claude-code\|Claude Code]]、[[ai/agents/coding-tools/codex\|Codex]]、[[ai/agents/coding-tools/gemini-cli\|Gemini CLI]]、[[ai/agents/coding-tools/spec-kit\|Spec Kit]] |
| MCP Authorization の仕様版          | [[ai/agents/mcp/index\|MCP Authorization]]                                                                                                                                                     |
| LLM API の形式                      | [[ai/llm-api\|LLM API 形式]]                                                                                                                                                                   |
