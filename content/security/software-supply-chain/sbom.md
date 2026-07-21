---
title: SBOM
date: 2026-07-01
modified: 2026-07-21
draft: false
tags:
  - security/supply-chain
aliases:
  - security/compliance/sbom
  - memos/sbom
  - memos/security-compliance/sbom
description: SBOM の目的、主要形式、生成・配布・利用のライフサイクルと限界を整理する。
---

## 概要

SBOM（Software Bill of Materials、ソフトウェア部品表）は、ソフトウェアを構成するコンポーネントと
依存関係を機械処理可能な形式で記録したもの。脆弱性対応、ライセンス、調達、インシデント調査などに使う。

SBOM は「脆弱性一覧」や「安全証明書」ではない。正確な部品情報を、別の脆弱性・悪用・資産情報と
組み合わせるための基礎データである。

## 主な形式

- **SPDX**: Linux Foundation のオープン標準で、ISO/IEC 5962:2021 として国際標準化されている
- **CycloneDX**: OWASP と Ecma International が開発する BOM 標準で、供給網・脆弱性用途に広く使われる

取引先が読める形式、必要なフィールド、ツール互換性、署名・配布方法を先に決める。単に JSON/XML であれば
相互運用できるわけではない。

## 最低限確認する情報

- SBOM の作成者とソフトウェアの提供者
- コンポーネント名、バージョン、識別子
- 直接・推移的な依存関係
- 作成日時、生成ツール、生成時点・コンテキスト
- コンポーネントのハッシュ
- ライセンス
- 対象範囲、既知の未把握部分、完全性
- 更新頻度、配布・アクセス方法

CISA は2025年に Minimum Elements for an SBOM を更新している。調達要件では、参照している版と必須項目を
明記する。

## SBOMの種類と生成時点

設計、ソース、ビルド、解析、デプロイ、実行環境など、生成時点によって見える部品が異なる。

- ソース解析だけでは、ビルド時に追加される依存や配布物を見落とすことがある
- バイナリ解析だけでは、部品名や正確なバージョンを特定できないことがある
- コンテナイメージの SBOM だけでは、外部 SaaS や実行時ダウンロードを表せないことがある

目的に合う複数手法を組み合わせ、最終成果物との対応を確認する。

## 運用ライフサイクル

### 生成側

1. CI/CD の再現可能な工程で SBOM を生成する
2. 対象成果物のハッシュや署名と結び付ける
3. 品質ゲートで欠落、未知バージョン、禁止ライセンスを確認する
4. リリースごとに更新し、改ざん防止した経路で提供する
5. 問い合わせ、脆弱性開示、更新通知の窓口を設ける

### 利用側

1. 製品、バージョン、環境と SBOM を資産台帳へ関連付ける
2. CVE、VEX、CISA KEV などと継続的に照合する
3. 実際に到達・実行可能か、設定と補完統制を含めて影響判定する
4. ベンダーへ修正予定や緩和策を確認する
5. 製品更新・廃止まで追跡し、古い SBOM を履歴として保持する

```mermaid
flowchart LR
    SRC["ソース・ビルド・バイナリ・実行環境"] --> GEN["CI/CD などで SBOM を生成"]
    GEN --> B["成果物の版・ハッシュ・署名と結び付ける"]
    B --> DIST["リリースごとに安全な経路で提供"]
    DIST --> INV["利用側の製品・環境・資産台帳と関連付ける"]
    CVE["CVE・KEV・脅威情報"] --> IMP["自組織への影響を判定"]
    VEX["VEX<br/>影響状態と根拠"] --> IMP
    INV --> IMP
    IMP --> ACT["修正・緩和・例外・ベンダー照会"]
    ACT --> TRACK["更新・廃止まで追跡"]
    TRACK --> INV
```

## VEXとの関係

VEX（Vulnerability Exploitability eXchange）は、特定製品が脆弱性の影響を受けるか、修正済みか、調査中か
などの状態と根拠を伝える。SBOM にコンポーネントが含まれていても、脆弱なコード経路を利用していない場合が
あるため、VEX はノイズ低減に役立つ。

VEX の `not affected` を無条件に信用せず、製品・バージョン一致、発行者、根拠、更新日時、署名を確認する。

## よくある失敗

- 生成して納品するだけで、脆弱性管理へ接続しない
- 推移的依存、静的リンク、コンテナ層、ファームウェアを見落とす
- パッケージ名・バージョン・識別子の品質が低く CVE と照合できない
- SBOM 自体に機密情報が含まれる可能性を評価せず公開する
- 製品のリリースと SBOM が一致しているか検証しない
- 誤検知・未検知を考慮せず、ツール出力を正解とみなす

## 参照リンク

- [CISA SBOM Resources Library](https://www.cisa.gov/topics/cyber-threats-and-advisories/sbom/sbomresourceslibrary)
- [CISA 2025 Minimum Elements for an SBOM](https://www.cisa.gov/resources-tools/resources/2025-minimum-elements-software-bill-materials-sbom)
- [SPDX Specifications](https://spdx.dev/use/specifications/)
- [CycloneDX Specification Overview](https://cyclonedx.org/specification/overview/)
