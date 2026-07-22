---
title: SOC 2
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
aliases:
  - memos/soc2
  - memos/security-compliance/soc2
description: SOC 2 のTrust Services Criteria、Type 1・Type 2、報告書レビューの要点を整理する。
---

## 概要

SOC は System and Organization Controls の略で、AICPA が整備する保証業務の体系である。
SOC 2 は、サービス組織のシステムと統制を Trust Services Criteria に基づいて独立した CPA が評価する
保証報告書である。行政機関が付与する認証や、製品の安全性保証ではない。

## Trust Services Criteria

| Category             | 対象                                   |
| -------------------- | -------------------------------------- |
| Security             | 不正アクセス、不正利用、損傷からの保護 |
| Availability         | 合意・約束した可用性を満たす運用       |
| Processing Integrity | 処理の完全性、正確性、適時性、承認     |
| Confidentiality      | 機密指定された情報の保護               |
| Privacy              | 個人情報の収集、利用、保持、開示、廃棄 |

Security は全 SOC 2 examination の共通カテゴリーで、その他はサービスと顧客要求に応じて対象となる。
報告書ごとに選択カテゴリーを確認する。

## Type 1とType 2

| 種類   | 評価対象                                       | 読み方                                 |
| ------ | ---------------------------------------------- | -------------------------------------- |
| Type 1 | 特定日時点のシステム記述と統制の設計           | 統制がその時点で適切に設計されているか |
| Type 2 | 一定期間のシステム記述、統制の設計と運用有効性 | 統制が対象期間を通じて実際に機能したか |

Type 2 の対象期間は報告書に記載される。「必ず6か月」などと固定せず、自社が依拠したい期間を十分に
カバーしているか確認する。対象期間後は Bridge Letter などで重要変更や事象を補う場合があるが、
これは新しい監査報告書ではない。

## SOC 1・SOC 2・SOC 3

- **SOC 1**: 利用企業の財務報告に係る内部統制（ICFR）に関係する統制
- **SOC 2**: Trust Services Criteria に関係する統制。詳細を含み、利用が制限される報告書
- **SOC 3**: SOC 2 と同じカテゴリーを基礎にするが、一般利用向けの簡潔な報告書

ベンダーのセキュリティを評価したい場合でも、財務システムへの影響が目的なら SOC 1 も必要になり得る。

## 報告書レビューの順序

1. **監査人の意見**: 限定、除外、否定的意見などがないか
2. **対象範囲**: 法人、サービス、システム、拠点、Trust Services Category
3. **期間**: 自社の利用期間と重なるか
4. **システム記述**: 境界、データ、インフラ、手順、人、委託先
5. **統制とテスト**: テスト方法、サンプル、結果
6. **例外**: 原因、件数、期間、影響、是正状況
7. **Subservice Organization**: carve-out か inclusive か
8. **CUEC**: Complementary User Entity Controls として顧客側に要求される統制
9. **CSOC**: 委託先側で必要な補完的統制が示されているか
10. **期末後の変化**: Bridge Letter、重大インシデント、サービス変更

## Carve-outとInclusive

- **Carve-out method**: 下位サービス組織の統制を SOC 2 の直接評価対象から外す
- **Inclusive method**: 下位サービス組織の関連統制も報告書の対象に含める

主要クラウドやデータセンターが carve-out されている場合、その事業者の報告書や責任共有を別途確認する。

![[attachments/soc2-carveout.png|820]]

## よくある誤解

- 「SOC 2 compliant」という表示だけでは、Type、期間、範囲、意見、例外が分からない
- Type 2 でも、報告書の対象外サービスや顧客の誤設定は保証されない
- 例外が1件あるだけで直ちに不適格とは限らず、母集団、影響、再発性、是正を評価する
- SOC 2 と ISO/IEC 27001 は目的と評価方法が異なり、相互に同一ではない

## 参照リンク

- [AICPA System and Organization Controls](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services)
- [AICPA SOC for Service Organizations Overview](https://www.aicpa-cima.com/soc4so?exec=cydoc)
