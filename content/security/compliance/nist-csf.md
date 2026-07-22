---
title: NIST Cybersecurity Framework
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
aliases:
  - memos/nist-csf
  - NIST CSF
  - memos/security-compliance/nist-csf
description: NIST Cybersecurity Framework 2.0 の構成と初学者向けの使い方を整理する。
---

## 概要

NIST Cybersecurity Framework（CSF）2.0 は、組織がサイバーセキュリティリスクを理解し、
評価し、優先順位付けし、関係者と共有するためのフレームワークである。業種や規模を問わず利用できる。

CSF は達成すべき高水準の成果を示すが、個別製品や実装方法を指定しない。認証制度でもない。

## 6つの機能

| 機能     | 要点                                 | 初学者が確認する例                       |
| -------- | ------------------------------------ | ---------------------------------------- |
| Govern   | 方針、役割、リスク戦略、監督を定める | 経営責任、方針、供給網リスクは明確か     |
| Identify | 資産、リスク、改善点を把握する       | 資産・データ・依存先を把握しているか     |
| Protect  | 事故の可能性と影響を抑える           | IAM、教育、データ保護、保守を行うか      |
| Detect   | 異常や攻撃を発見する                 | ログ、監視、検知基準があるか             |
| Respond  | 検知した事象へ対応する               | 分析、連絡、封じ込め、報告ができるか     |
| Recover  | サービスを復旧し改善する             | 復旧計画、バックアップ、教訓反映があるか |

CSF 1.1 の5機能に、CSF 2.0 で Govern が加わった。セキュリティを技術部門だけの課題ではなく、
企業リスクとして扱う意図が明確になっている。

![[attachments/nist-csf-functions.png|780]]

## Core、Profiles、Tiers

- **CSF Core**: Function、Category、Subcategoryで成果を階層化した共通言語
- **Organizational Profile**: 組織の現状（Current）と目標（Target）を選び、差分を表したもの
- **Tiers**: リスクガバナンスと管理の厳密さを4段階で説明する補助尺度

Tier は成熟度スコアや認証等級として単純比較するものではない。事業上必要な水準を対話するために使う。

## 初めて使う手順

1. 対象サービスと事業目標を決める
2. 関係者、資産、データ、依存先、法令・契約要求を確認する
3. CSF の成果から Current Profile を作る
4. リスクと事業優先度を踏まえて Target Profile を作る
5. 差分を、担当者、期限、予算のある改善計画へ変換する
6. 指標と証跡で進捗を見直す

具体的な統制が必要な場合は、CSF の Informative References を使い、
[[security/compliance/nist-sp-800-53|NIST SP 800-53]]、[[security/compliance/cis-controls|CIS Controls]]、
ISO/IEC 27001 などへ対応付ける。

## よくある誤解

- 全項目を同じ深さで実装するチェックリストではない
- CSF に沿っていることと、法令・契約への準拠は同義ではない
- Profile の差分を作るだけでは不十分で、リスクに基づく改善判断が必要である
- ツール導入だけで Govern や組織横断の責任は満たせない

## 参照リンク

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [The NIST Cybersecurity Framework (CSF) 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20)
