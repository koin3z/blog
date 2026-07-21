---
title: SCIM
date: 2025-11-24
modified: 2026-07-21
draft: false
tags:
  - identity/scim
aliases:
  - memos/scim
  - memos/identity/scim/scim
description: SCIM の User、Group 連携と Filter に関するメモの入口。
---

## 概要

- SCIM は、SCIM Client と SCIM Server の間で User や Group などの Identity resource を連携する
- OAuth の権限委譲とは目的が異なるため、Identity の同期と API アクセス認可を分けて設計する

## 詳細メモ

- [[identity/scim/filter\|SCIM 2.0 Filter]]
  - User や Group から条件に一致する Resource を検索する構文を扱う

## 関連メモ

- [[identity/index\|Identity]]
- [[identity/oauth/index\|OAuth]]
