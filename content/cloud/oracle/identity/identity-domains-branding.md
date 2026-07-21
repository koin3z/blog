---
title: Identity Domainsで設定できるログイン画面デザイン
date: 2025-11-24
modified: 2026-07-21
draft: false
tags:
  - cloud/oci/identity
aliases:
  - cloud/oracle/idce-branding
  - cloud/oracle/identity/idce-branding
description: OCI Identity Domains で設定できるログイン画面デザインとブランディングを整理する。
---

## 方法

- OCI IAM Identity Domainsではログイン画面をスクラッチ開発して完全自作でカスタムすることもできるが，簡単にテンプレートとしてログイン画面をデザインできる方法として次の2つがある

  - カスタムブランディング

- デフォルトのオラクルブランディングでは以下のようなデザイン

### カスタム・ブランディング

- 設定できる画像としては次の通り

  - 翻訳（日本語）
  - 会社名（会社名として入力した文字列）
  - 「サインインに進む」ボタンの非表示（無効）
  - ログイン・テキスト（ログイン・テキストとして入力した文字列）
  - サインイン・ページのロゴ（green）
  - サインイン・ページの背景ロゴ（red）
  - 自分のアプリケーションのイメージ（blue）
  - 電子メール・テンプレートのヘッダー・ロゴ（yellow）

- すると以下のようなデザインになる
  ![[Pasted image 20251124210552.png]]
  ![[Pasted image 20251124211030.png]]

### Hosted Sign-in

## 参照リンク

-
