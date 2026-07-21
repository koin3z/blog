---
title: セキュリティ
date: 2026-07-21
modified: 2026-07-21
draft: false
tags:
  - security
aliases: []
description: セキュリティの制度、脆弱性管理、ソフトウェア供給網、暗号技術に関するメモの入口。
---

## 概要

分類は製品名ではなく、判断する対象と必要な成果物の違いを基準にする。

## メモの分類

| 分類               | 主な問い                                           | 入口                                                                  |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------- |
| コンプライアンス   | どの要求が適用され、どの統制と証跡が必要か         | [[security/compliance/index\|セキュリティ・コンプライアンス]]         |
| 脆弱性管理         | 脆弱性の技術的深刻度をどう読み、対応順へつなげるか | [[security/vulnerability-management/cvss\|CVSS]]                      |
| ソフトウェア供給網 | 製品に含まれる部品と影響範囲をどう追跡するか       | [[security/software-supply-chain/sbom\|SBOM]]                         |
| 暗号技術           | 現行方式と移行先をどの条件で選ぶか                 | [[security/cryptography/post-quantum-cryptography\|耐量子計算機暗号]] |

## 関連メモ

- [[cloud/oracle/database/security/oracledb-tde|Oracle Database TDE]]
- [[cloud/oracle/vault/oci-vault|OCI Vault]]
- [[linux/capability|Linux Capability]]
- [[linux/permission|Linux 特殊パーミッション]]
