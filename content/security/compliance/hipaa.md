---
title: HIPAA
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
  - security/privacy
  - region/us
aliases:
  - memos/hipaa
  - HIPPA
  - memos/security-compliance/hipaa
description: 米国 HIPAA の適用対象、Privacy・Security・Breach Notification Rules と実務を整理する。
---

## 概要

HIPAA（Health Insurance Portability and Accountability Act of 1996）は米国の法律で、
医療情報のプライバシーやセキュリティに関する HIPAA Rules が定められている。

`HIPPA` はよくある誤記で、正しくは `HIPAA` である。

## 適用対象

HIPAA Rules は、主に次へ適用される。

- **Covered Entity**: Health plan、Health care clearinghouse、対象となる電子取引を行う医療提供者
- **Business Associate**: Covered Entity のために PHI を扱う一定の業務・サービス提供者
- **Subcontractor**: Business Associate から PHI を扱う業務を再委託される一定の事業者

Covered Entity と Business Associate の間では、PHI の利用目的や保護義務などを定める書面の
Business Associate Agreement（BAA）が通常必要となる。単に健康情報を扱う全てのアプリや雇用主へ
HIPAA が適用されるわけではなく、主体と役割を確認する。

## 保護対象の情報

- **PHI**: 個人を識別できる健康情報のうち、Covered Entity や Business Associate が扱うもの
- **ePHI**: 電子媒体で作成、受領、保持、送信される PHI

Security Rule は ePHI を対象とする。Privacy Rule や Breach Notification Rule の対象範囲と混同しない。

## 主なルール

| Rule                     | 要点                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| Privacy Rule             | PHI の利用・開示条件、minimum necessary、本人のアクセス・訂正などの権利 |
| Security Rule            | ePHI の機密性・完全性・可用性を守る管理的、物理的、技術的セーフガード   |
| Breach Notification Rule | 保護されていない PHI の侵害時の本人、HHS、場合によりメディアへの通知    |
| Enforcement Rule         | 調査、手続、民事制裁金などの執行                                        |

Security Rule は、リスク分析とリスク管理、セキュリティ責任者、アクセス管理、監査、インシデント対応、
緊急時対応、教育、設備・端末・媒体管理、伝送保護などを扱う。

## Required と Addressable

Security Rule の実装仕様には Required と Addressable がある。Addressable は「任意」ではない。
組織は合理的かつ適切かを評価し、実装するか、同等の代替策を採るか、採らない理由を文書化する。

## 侵害通知

保護されていない PHI の breach では、Covered Entity は原則として本人へ不合理な遅延なく、遅くとも
発見後60日以内に通知する。HHS への報告時期は影響人数によって異なり、500人以上の場合は不合理な
遅延なく遅くとも60日以内、500人未満の場合は年次報告の仕組みがある。Business Associate は
Covered Entity へ通知する。

具体的な該当性、例外、リスク評価、州法のより厳しい期限は、インシデントごとに法務と確認する。

![[attachments/hipaa-entities.png|780]]

## クラウド利用時の確認ポイント

- 自社と顧客が Covered Entity、Business Associate、Subcontractor のどれに当たるか
- BAA の対象サービス、責任、再委託、通知期限、データ返却・削除
- PHI/ePHI のデータフロー、保存場所、バックアップ、ログ
- 一意な利用者識別、最小権限、緊急アクセス、アクセスレビュー
- 保存時・通信時の暗号化と鍵管理
- 監査ログ、アラート、証跡保全、インシデント演習
- 可用性、災害復旧、緊急時運用

## 2026年時点の改定動向

HHS は 2024年12月に HIPAA Security Rule 強化の Proposed Rule を公表した。2026年7月1日時点では、
提案を確定済みの要求として扱わず、現行規則と最新の HHS 公表状況を分けて確認する。

## 参照リンク

- [Covered Entities and Business Associates](https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html)
- [The HIPAA Privacy Rule](https://www.hhs.gov/hipaa/for-professionals/privacy/index.html)
- [The HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)
