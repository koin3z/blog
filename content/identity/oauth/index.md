---
title: OAuth
date: 2026-07-21
modified: 2026-07-21
draft: false
tags:
  - identity/oauth
aliases: []
description: OAuth の登場主体とグラントタイプを関連付け、各詳細メモへ進むための入口。
---

## 概要

- OAuth では、Client が Authorization Server から Access Token を取得し、Resource Server へ提示する
- 具体的な要求と検証は、登場主体の責任と利用する Grant を分けて確認する

## 登場主体

| 主体                 | 主な責任                                     | 詳細                                                          |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Client               | 認可要求、Token 取得、Resource への要求      | [[identity/oauth/client\|OAuth Client]]                       |
| Authorization Server | Client の登録、認可処理、Token 発行          | [[identity/oauth/authorization-server\|Authorization Server]] |
| Resource Server      | Access Token を検証し、Resource の応答を決定 | [[identity/oauth/resource-server\|Resource Server]]           |

## グラントタイプ

- [[identity/oauth/grant-types/index\|OAuth グラントタイプ]]で、利用者の有無、入力環境、Token の交換目的から方式を選ぶ
- ID-JAG は異なる信頼ドメインへの権限委譲を扱うため、[[identity/oauth/grant-types/id-jag\|ID-JAG]]で前提と検証責任を確認する

## 関連メモ

- [[ai/agents/mcp/index\|MCP Authorization]]
- [[identity/scim/index\|SCIM]]
