---
title: CIS Controls
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
aliases:
  - memos/cis-controls
  - memos/security-compliance/cis-controls
description: CIS Controls v8.1 の特徴、Implementation Group、初学者向けの使い方を整理する。
---

## 概要

CIS Critical Security Controls は、一般的なサイバー攻撃への防御を優先順位付きで整理した
具体的なベストプラクティスである。2026年7月1日時点の現行版は v8.1 で、18のControlと、
より細かなSafeguardから構成される。

法令や認証制度ではない。要求が抽象的なフレームワークに対して、「最初に何を実装するか」を
検討するときに使いやすい。

## Implementation Group

| Group | 想定                                           | 使い方                                |
| ----- | ---------------------------------------------- | ------------------------------------- |
| IG1   | 限られた人員・専門性で基本的な対策を始める組織 | 基本的なサイバー衛生として最優先する  |
| IG2   | 複数部門、機微データ、規制要求を持つ組織       | IG1 に加え、運用と専門性を強化する    |
| IG3   | 高い機密性・可用性、標的型攻撃リスクを持つ組織 | IG1・IG2 に加え、高度な対策を実施する |

IG は組織の優劣を表す認証レベルではない。資産、データ、脅威、規制、利用可能な資源に応じて選ぶ。

IG は累積的であり、IG2 は IG1 を、IG3 は IG1 と IG2 を含む。

![[attachments/cis-ig-nesting.png|860]]

## 18のControl

1. 企業資産の棚卸しと管理
2. ソフトウェア資産の棚卸しと管理
3. データ保護
4. 企業資産とソフトウェアのセキュア構成
5. アカウント管理
6. アクセス制御管理
7. 継続的な脆弱性管理
8. 監査ログ管理
9. 電子メールとWebブラウザーの保護
10. マルウェア防御
11. データ復旧
12. ネットワークインフラストラクチャ管理
13. ネットワーク監視と防御
14. セキュリティ意識向上とスキルトレーニング
15. サービスプロバイダー管理
16. アプリケーションソフトウェアセキュリティ
17. インシデント対応管理
18. ペネトレーションテスト

正式な名称と要求は必ず原文を確認する。

## 初めて使う手順

1. 対象組織とシステムを決める
2. IG1 の Safeguard から現状を確認する
3. 未実施項目を、リスクと依存関係で優先順位付けする
4. オーナー、期限、実装方法、証跡を決める
5. [[security/compliance/nist-csf|NIST CSF]] や適用される規格へマッピングする
6. 定期的に有効性を測り、IG2・IG3 の必要性を見直す

資産台帳がないまま脆弱性管理やログ監視を完全にすることは難しい。Control 1、2、3 は、他の統制の
対象範囲を決める基礎になる。

## CIS Benchmarksとの違い

- **CIS Controls**: 組織のセキュリティ活動を整理する
- **CIS Benchmarks**: OS、クラウド、製品などの具体的なセキュア設定を示す

Controls のセキュア構成を実装する手段の1つとして Benchmarks を利用する。

## 参照リンク

- [CIS Critical Security Controls](https://www.cisecurity.org/controls)
- [The 18 CIS Critical Security Controls](https://www.cisecurity.org/controls/cis-controls-list)
