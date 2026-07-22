---
title: FIPSとFIPS 140-3
date: 2026-07-01
modified: 2026-07-22
draft: false
tags:
  - security/compliance
  - security/cryptography
aliases:
  - memos/fips
  - FIPS 140-3
  - memos/security-compliance/fips
description: FIPS の位置付けと、暗号モジュール検証規格 FIPS 140-3 の確認方法を整理する。
---

## FIPSとは

FIPS（Federal Information Processing Standards）は、米国連邦政府向けの情報処理標準の系列である。
1つの認証名ではない。例えば、暗号モジュールの FIPS 140-3、AES の FIPS 197、デジタル署名の
FIPS 186-5、PQC の FIPS 203・204・205 など、目的の異なる文書がある。

案件で「FIPS 対応」と言われたら、対象の FIPS 番号、要求される版、対象製品・機能、運用モードを確認する。

## FIPS 140-3

FIPS 140-3 は暗号モジュールのセキュリティ要求を定める。暗号アルゴリズムだけでなく、インターフェース、
役割と認証、ソフトウェア・ファームウェア、物理セキュリティ、機密パラメータ管理、自己テスト、
ライフサイクル保証などを扱う。

セキュリティレベルは Level 1 から Level 4 まである。数字が高ければ全製品・全用途で優れているという
単純な評価ではなく、モジュール形態と利用環境の要求から必要レベルを決める。

## CMVPとCAVP

- **CMVP**: 暗号モジュール全体を FIPS 140-3 に対して検証するプログラム
- **CAVP**: 暗号アルゴリズム実装をテストするプログラム

承認済みアルゴリズムを実装したことや、アルゴリズム証明書を持つことだけでは、製品やモジュールが
FIPS 140-3 validated とはいえない。

![[attachments/fips-cmvp-cavp.png|880]]

## 製品選定時の確認

1. CMVP の Validated Modules Search で証明書番号を確認する
2. モジュール名、ベンダー、正確なバージョンを製品と照合する
3. 検証対象の Operating Environment を確認する
4. Active、Historical、Revoked など証明書の状態を確認する
5. Security Policy で FIPS-approved mode の有効化方法と制約を確認する
6. 製品の全暗号処理が検証済みモジュールを通るか、ベンダーに確認する
7. 非承認アルゴリズム、デバッグ、鍵の持込みなどがモードを外さないか確認する

「ライブラリが同系統」「クラウド事業者が別サービスで取得済み」だけでは、対象構成の検証を証明できない。

## FIPS 140-2からの移行

FIPS 140-3 は FIPS 140-2 を置き換えた。CMVP の2026年6月時点の案内では、FIPS 140-2 の Active
モジュールは2026年9月21日まで新規システムに利用でき、その後は Historical List へ移る予定である。
既存システムでの扱いを含め、調達主体の移行方針と最新の証明書状態を確認する。

## 他制度との関係

FedRAMP などでは、保護対象情報に暗号を使う際に検証済みモジュールが要求されることがある。
クラウドサービスでは、事業者が提供する FIPS モードだけでなく、利用するリージョン、API、鍵管理サービス、
TLS終端、アプリケーション内暗号の全経路を確認する。

## 参照リンク

- [FIPS 140-3](https://csrc.nist.gov/pubs/fips/140-3/final)
- [Cryptographic Module Validation Program](https://csrc.nist.gov/projects/cryptographic-module-validation-program)
- [CMVP Validated Modules](https://csrc.nist.gov/Projects/cryptographic-module-validation-program/validated-modules)
