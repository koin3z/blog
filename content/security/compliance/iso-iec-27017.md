---
title: ISO/IEC 27017
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
  - security/cloud
aliases:
  - memos/iso-iec-27017
  - memos/security-compliance/iso-iec-27017
description: ISO/IEC 27017 のクラウドセキュリティ管理策と責任共有、2026年版の発行状況を整理する。
---

## 概要

ISO/IEC 27017 は、ISO/IEC 27002 の管理策をクラウドサービスへ適用するための追加ガイダンスと、
クラウド固有の管理策を提供する。Cloud Service Provider（CSP）と Cloud Service Customer（CSC）の
双方を対象とし、パブリック、プライベートなどの展開モデルに適用できる。

ISO/IEC 27001 のような独立した ISMS 要求規格ではなく、クラウド管理策の実装を補助する文書である。

## 版の状況

> [!warning] 2026年7月1日時点
> ISO/IEC 27017 第2版は発行工程中で、ISO は発行予定を2026年7月と表示している。発行後に
> ISO/IEC 27017:2015 を置き換える予定である。監査・契約では、適用する版と移行方針を確認する。

第2版は ISO/IEC 27002:2022 を基礎とし、CSP と CSC のためのクラウド固有ガイダンスを提供する。

## 主な論点

- CSP と CSC の役割・責任分担
- クラウドサービスの利用終了時における資産の返却・削除
- 顧客環境の分離
- 仮想マシンや仮想環境の強化
- 管理者の運用セキュリティ
- クラウド活動の監視
- 仮想ネットワークと物理ネットワークの整合
- 変更、インシデント、ログ、バックアップ、委託先の責任

正式な管理策とガイダンスは購入した規格本文で確認する。

## 責任共有の使い方

クラウドの責任は、IaaS、PaaS、SaaS のサービスモデル、管理機能、契約で変わる。

1. データ、ID、鍵、ログ、ネットワーク、OS、アプリケーション、物理設備を分解する
2. 各統制の責任を CSP、CSC、共同、第三者に分類する
3. CSP の責任は認証書、契約、監査報告書、実装ガイドで確認する
4. CSC の責任はクラウド設定標準、運用手順、監視、証跡へ落とす
5. 境界にある通知、承認、ログ提供、インシデント対応を契約で明確にする

「クラウド事業者が ISO/IEC 27017 認証を取得している」ことだけでは、利用者の設定ミスやアクセス管理、
データ分類などはカバーされない。認証の適用範囲も確認する。

![[attachments/iso27017-responsibility.png|760]]

## 他制度との関係

- [[security/compliance/iso-iec-27001|ISO/IEC 27001]]: ISMS の要求事項
- ISO/IEC 27002: 汎用の情報セキュリティ管理策ガイダンス
- ISO/IEC 27018: パブリッククラウドで PII 処理者となる場合の管理策
- [[security/compliance/ismap|ISMAP]]: 日本政府のクラウド評価制度
- [[security/compliance/fedramp|FedRAMP]]: 米国連邦政府のクラウド評価制度

規格間には重なる管理策があるが、認証や登録を相互に置き換えるものではない。

## 参照リンク

- [ISO/IEC 27017 第2版の発行状況](https://www.iso.org/standard/82878.html)
- [ISO/IEC 27017:2015](https://www.iso.org/standard/43757.html)
