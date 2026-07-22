---
title: NIST SP 800-53
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
aliases:
  - memos/nist-sp-800-53
  - memos/security-compliance/nist-sp-800-53
description: NIST SP 800-53 Rev. 5 の統制カタログ、ベースライン、評価文書の関係を整理する。
---

## 概要

NIST SP 800-53 Rev. 5 は、情報システムと組織のためのセキュリティおよびプライバシー統制の
カタログである。法令そのものでも認証制度でもなく、組織がリスクと要求に応じて統制を選択・調整する。

2026年7月1日時点では Rev. 5 が現行で、NIST は 2025年8月に Release 5.2.0 の小規模更新を公開した。

## 文書の関係

| 文書       | 役割                                               |
| ---------- | -------------------------------------------------- |
| SP 800-53  | 統制と統制強化のカタログ                           |
| SP 800-53B | Low、Moderate、High などの統制ベースライン         |
| SP 800-53A | 統制の評価手順                                     |
| SP 800-37  | Risk Management Framework（RMF）のライフサイクル   |
| OSCAL      | カタログ、プロファイル、評価情報などの機械可読形式 |

![[attachments/nist-800-53-relationship.png|880]]

## 主な統制ファミリー

Access Control（AC）、Audit and Accountability（AU）、Configuration Management（CM）、
Incident Response（IR）、Risk Assessment（RA）、System and Communications Protection（SC）、
System and Information Integrity（SI）、Supply Chain Risk Management（SR）などがある。

ファミリー名は担当部署を意味しない。1つの統制に、セキュリティ、IT運用、開発、人事、法務、調達など
複数部署が関わることがある。

## 統制の読み方

例として `AC-2` は Account Management、`AC-2(1)` はその統制強化を表す。本文中の
`[Assignment: organization-defined ...]` や `[Selection: ...]` は、組織が値や選択肢を決めて
文書化するパラメータである。原文をコピーするだけでは実装仕様にならない。

1. 統制の目的と適用範囲を理解する
2. 組織定義パラメータを決める
3. 実装責任と責任分界を決める
4. 実装方法と証跡を記述する
5. SP 800-53A の評価観点を参考に設計・運用を確認する

## FedRAMPとの関係

[[security/compliance/fedramp|FedRAMP]] の Rev. 5 は NIST SP 800-53 Rev. 5 の統制を基礎に、クラウド向けのベースライン、
パラメータ、追加要求、継続的モニタリングを定める。SP 800-53 を使っただけで FedRAMP Certified に
なるわけではない。

## 初学者の注意点

- 全統制を無条件に実装するのではなく、ベースライン、法令、契約、リスクから選ぶ
- 統制の対応表は一対一とは限らず、「マッピング済み」は「同等」を意味しない
- 統制の存在だけでなく、対象期間中の運用有効性を証跡で確認する
- ベースラインからの追加・除外・変更（tailoring）は理由と承認を残す

## 参照リンク

- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [NIST Risk Management Framework](https://csrc.nist.gov/projects/risk-management)
