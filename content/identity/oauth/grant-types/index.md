---
title: OAuth グラントタイプ
date: 2025-11-20
modified: 2026-07-21
draft: false
tags:
  - identity/oauth
aliases:
  - memos/identity/oauth/grantTypes/_grant_type
description: OAuth 2.0 の主要グラントタイプと認可/トークンリクエストを整理する。
---

## 概要

- Grant type は、Client が Access Token を取得するために Authorization Server へ提示する認可の形を表す
- 利用者の有無、Client の入力環境、既存 Token の再利用または交換の必要性から方式を選ぶ

## 選択

| 方式                                                                      | 主な条件                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| [[identity/oauth/grant-types/authorization-code\|Authorization Code]]     | 利用者を Authorization Endpoint へ誘導できる             |
| [[identity/oauth/grant-types/client-credentials\|Client Credentials]]     | Client が自身の資格情報で Token を取得する               |
| [[identity/oauth/grant-types/device-authorization\|Device Authorization]] | 入力が制限された端末と、利用者が操作できる別の端末を使う |
| [[identity/oauth/grant-types/refresh-token\|Refresh Token]]               | 発行済み Refresh Token を使って Access Token を更新する  |
| [[identity/oauth/grant-types/token-exchange\|Token Exchange]]             | 既存の Token を別の Token へ交換する                     |
| [[identity/oauth/grant-types/id-jag\|ID-JAG]]                             | IdP を介して異なる信頼ドメインへ権限委譲する             |

## リクエスト例

### 認可リクエスト

```http
GET https://auth.server.com/authorize
	?client_id=r4y78fhusfrhs7i4
	&response_type=code
	&scope=openid+email
	&state=frji48H8f4i*h
	&redirect_uri=https%3A%2F%2Foauth.client.com%2Fcallback
	&code_challenge=jirsojgirsjfr
	&code_challenge_method=2389
	HTTP/1.1
```

### トークンリクエスト

```http
POST https://auth.server.com/token
Content-type: application/x-www-form-urlencoded

client_id=jgriojifrs
&grant_type=authorization_code
&code=
&redirect_uri=
&code_verifier
```
