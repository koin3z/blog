---
title: FedRAMP
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
  - security/cloud
  - region/us
aliases:
  - memos/fedramp
  - memos/security-compliance/fedramp
description: 米国政府のクラウド評価制度 FedRAMP と2026年の移行状況を整理する。
---

## 概要

FedRAMP（Federal Risk and Authorization Management Program）は、米国連邦政府が利用する
クラウド製品・サービスについて、セキュリティ評価と認可に再利用可能な標準アプローチを提供する制度である。
対象は、連邦政府機関が利用する非機密情報を処理するクラウドサービスが中心となる。

FedRAMP Certification は、クラウドサービスの評価資料が機関の Authorization to Operate（ATO）判断に
再利用できることを示す。FedRAMP 自体が各機関に代わって ATO を発行したり、リスクを受容したりする
ものではない。

## 主な関係者

- **Cloud Service Provider（CSP）**: クラウドサービスと統制を実装・運用する
- **Federal Agency**: 利用目的とリスクを評価し、必要な認可判断を行う
- **Independent Assessor / 3PAO**: 独立評価を行う
- **FedRAMP**: 共通ルール、レビュー、Marketplace、再利用の仕組みを運営する

![[attachments/fedramp-authorization.png|880]]

## 2026年の重要な変更

> [!warning] 2026年7月1日時点
> FedRAMP は2026年6月24日に Consolidated Rules for 2026 を公開し、FedRAMP 20x を広く利用可能な
> Certification path とした。過去の解説には失効予定の用語・手順が多いため、公式ルールを優先する。

- 20x は、より測定可能で再利用しやすい証拠と自動化を重視する新しい経路
- Rev. 5 は移行期間中も残るが、新しいルールと期限が適用される
- 公式発表では、Consolidated Rules は2027年1月1日に全関係者へ必須となる予定
- 新規 Rev. 5 Certification 申請の受付終了は2027年6月11日と案内されている

日付や経路は変更され得るため、案件開始時に公式 Timeline と適用ルールを確認する。

## Rev. 5で理解しておく要素

従来の Rev. 5 は、[[security/compliance/nist-sp-800-53|NIST SP 800-53 Rev. 5]] を基礎とする統制ベースライン、
System Security Plan（SSP）、Security Assessment Plan / Report（SAP/SAR）、Plan of Action and
Milestones（POA&M）、継続的モニタリングなどを用いる。

Low、Moderate、High などの影響区分は、扱う情報と想定影響に基づく。サービスのマーケティング上の
「セキュリティレベル」ではない。

## 20xで理解しておく要素

20x は、Key Security Indicators、機械可読・自動検証可能な証拠、継続的な可視性を重視する。
ただし、文書が全て不要になるという意味ではない。サービス境界、責任、リスク判断、例外、証拠の由来を
説明できることが必要である。

## 調達・利用側の確認ポイント

- Marketplace の正式なサービス名、Certification、Class、状態
- 対象となる機能、リージョン、サービス境界
- Agency Authorization / Certification など適用経路と再利用可能な資料
- 自機関の ATO に必要な追加統制と責任
- Customer Responsibility Matrix と共有統制
- FIPS 検証済み暗号、脆弱性管理、インシデント報告、継続的モニタリング
- 外部サービス、下位クラウド、再委託先の扱い

## ISMAPとの違い

[[security/compliance/ismap|ISMAP]] は日本政府、FedRAMP は米国連邦政府のクラウド利用を主眼とする。統制に共通点はあるが、
法的根拠、対象組織、評価手続、提出物、用語、継続監視が異なり、相互に自動代替されない。

## 参照リンク

- [FedRAMP Consolidated Rules for 2026](https://www.fedramp.gov/2026/)
- [FedRAMP 20x](https://www.fedramp.gov/20x/)
- [2026年6月25日の公式発表](https://www.fedramp.gov/2026-06-25-propelling-change-fedramp-launches-consolidated-rules-for-2026/)
- [FedRAMP Marketplace](https://marketplace.fedramp.gov/)
