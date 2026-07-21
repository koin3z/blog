---
title: OCI Vault
date: 2025-12-13
modified: 2026-07-21
draft: false
tags:
  - cloud/oci/vault
  - security/cryptography
aliases:
  - cloud/oracle/oci-vault
description: OCI Vault のVault、マスター暗号化キー、シークレット、エンドポイント、バックアップ、レプリケーションを整理する。
---

## 概要

- OCIが提供するマネージドの鍵管理サービス（KMS: Key Management Service）
- FIPS 140-2 レベル3認定済みのHSMを使用
- データの暗号化、復号化、署名の生成・検証に使用

## Vault

- Vaultは、暗号化キーとシークレットを格納するための論理的なコンテナ。
- コンパートメントに属し、リージョン単位で作成
- 以下の2種類のタイプがある：
  - **仮想プライベート・ボールト (Virtual Private Vault):**
    - 顧客専用のHSMパーティションを使用。より高い分離性とスループットが必要な場合に選択。
  - **デフォルト・ボールト (Default Vault):**
    - マルチテナントのHSMパーティションを使用。コスト効率が良く、一般的な用途向け。
- 以下２種類のクレデンシャルを管理できる
  - マスター暗号化キー（[[cloud/oracle/vault/oci-vault-mek]]）
  - シークレット（[[cloud/oracle/vault/oci-vault-secret]]）

## マスター暗号化キー (MEK)

- データの暗号化に使用される「データ暗号化キー (DEK)」を守るための鍵
- 実際のデータを直接暗号化するのではなく、データを暗号化している鍵 (DEK) を暗号化する（エンベロープ暗号化）ような使い方をされることが多い
- ライフサイクル管理: キーの作成、有効化/無効化、ローテーション（新しいバージョンへの更新）、削除（猶予期間あり）が可能。
- BYOK (Bring Your Own Key): オンプレミス等で生成した独自の鍵素材をインポートして使用することも可能。
- 非対称キーのサービス制限に対する使用率を計算する場合、各キー・バージョンのカウントは2ずつ増加します。これは、公開キーと秘密キーの両方で計算されるためです。

## シークレット (Secrets)

- パスワード、APIキー、SSH鍵、認証トークンなどの機密情報を安全に格納・取得する機能。
- 主な特徴:
  - コードや構成ファイルにパスワードをハードコーディングするのを防ぐことができる。
  - シークレットの内容（Secret Bundle）はBase64でエンコードされて保存される。
  - 自動的にバージョン管理され、アプリケーションは最新版または特定バージョンを取得可能。

## エンドポイント

- Vaultごとに，次の２つのエンドポイントが払い出される
  - **暗号エンドポイント**
    - 暗号操作の実行対象となるサービス・エンドポイント。暗号操作には、'Encrypt'、'Decrypt'および'GenerateDataEncryptionKey'、'Sign'および'Verify'操作が含まれます
    - 形式
      - `https://<randomId>-crypto.kms.<region>.oraclecloud.com`
  - **管理エンドポイント**
    - 管理操作の実行対象となるサービス・エンドポイント。管理操作には、'Create'、'Update'、'List'、'Get'および'Delete'操作が含まれます。
    - 形式
      - `https://<randomId>-management.kms.<region>.oraclecloud.com`
- また，それとは別にメタ的な操作をするエンドポイントとして以下が存在している
  - **Baseurl Vault Key Management API**
    - 形式
      - `https://kms.<region>.oraclecloud.com`
  - **Vault Secret Management API**
    - シークレットとシークレットのバージョンを管理
    - 形式
      - `https://vaults.<region>.oci.oraclecloud.com`
  - **Vault Secret Retrieval API**
    - シークレットとシークレットバージョンを取得する
    - 形式
      - `https://secrets.vaults.<region>.oci.oraclecloud.com`

## OCIサービスとの統合

- 作成したVaultとキーは他のOCIサービスとシームレスに連携して，データを暗号化する鍵をユーザー側で管理できる
  - Block Volume / File Storage
  - Object Storage
  - Database: TDE (Transparent Data Encryption)
- - **OCIサービス連携での制限**：たとえば Block Volume/Boot Volume の暗号化で「RSA 鍵はサポートされず、AES が必要」という制限があります（これは“レプリケーション”ではなく“そのサービスがその鍵アルゴリズムを使えるか”の制限）。[Oracle Docs](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/update-cross-region-replication-bv-volume-group.htm?utm_source=chatgpt.com)
- **Secrets の暗号化キー**：Secret を Vault に取り込むときは **対称鍵（= AES）**が必要で、非対称鍵では Secret を暗号化できません。[Oracle Docs](https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/managingsecrets_topic-To_create_a_new_secret.htm?utm_source=chatgpt.com)
- **External Key（外部KMS参照）**：External key は **AES だけ**という制約があります。[Oracle Docs](https://docs.oracle.com/en-us/iaas/Content/pl-sql-sdk/doc/key_management_t.html?utm_source=chatgpt.com)

## 手順

使用するエンドポイントは以下

- `https://kms.{region}.oraclecloud.com`
  - 例: `https://kms.us-ashburn-1.oraclecloud.com`

### Vaultの作成

### Vaultのリスト

```http
GET https://kms.{region}.oraclecloud.com/20180608/vaults/{vaultId}
	?compartmentId={conpartment_ocid}
	&sortBy=TIMECREATED
	&sortOrder=DESC
```

```json
[
  {
    "compartmentId": "ocid1.compartment.oc1..<compartment_ocid>",
    "cryptoEndpoint": "https://<vault_namespace>-crypto.kms.us-ashburn-1.oraclecloud.com",
    "definedTags": {
      "Oracle-Tags": {
        "CreatedBy": "<user>",
        "CreatedOn": "2025-05-11T07:24:18.355Z"
      }
    },
    "displayName": "vault-iad-dev",
    "freeformTags": {},
    "id": "ocid1.vault.oc1.iad.<vault_ocid>",
    "lifecycleState": "ACTIVE",
    "managementEndpoint": "https://<vault_namespace>-management.kms.us-ashburn-1.oraclecloud.com",
    "timeCreated": "2025-05-11T07:24:19.027Z",
    "timeOfDeletion": null,
    "vaultType": "DEFAULT",
    "restoredFromVaultId": null,
    "wrappingkeyId": "",
    "replicaDetails": null,
    "isPrimary": true,
    "isVaultReplicable": null,
    "externalKeyManagerMetadataSummary": null
  }
]
```

### バックアップ

- 仮想プライベート・ボールトおよびMEKのバックアップ及びリストア
- ボールトがバックアップできるタイプは仮想プライベート・ボールトのみ
- MEKがバックアップできるタイプはHSMの保護モードの鍵のみ
  - ソフトウェアで保護されたMEKはバックアップできない
  - もちろんVPV内の鍵に対してのみ有効
- シークレットもバックアップできない

#### Vaultのバックアップ・リストア

Doc Vault Backup: https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/backingupvaultsandkeys_topic-To_back_up_a_vault.htm
Doc Vault Restore: https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/backingupvaultsandkeys_topic-To_restore_a_vault.htm
Doc Vault Update: https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/backingupvaultsandkeys_topic-To_restore_a_vault.htm

#### MEKのバックアップ・リストア

Doc MEK Backup: https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/backingupvaultsandkeys_topic-To_back_up_a_key.htm
Doc MEK Restore: https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/backingupvaultsandkeys_topic-To_restore_a_key.htm
Doc MEK Update: https://docs.oracle.com/en-us/iaas/Content/KeyManagement/Tasks/backingupvaultsandkeys_topic-To_update_a_key_from_a_backup.htm
API

- OCIコンソールから操作はできない

### レプリケーション

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/replicatingvaults.htm

- レプリケーションを有効化すると、キーやキー・バージョンの作成/更新/削除/移動が、ソース Vault と宛先の vault replica の間で自動同期されます。
- replica 側は 暗号操作（Encrypt/Decrypt/Sign/Verify など）には使える一方、管理操作は直接できません（replica 側でキーを新規作成…などは不可）。
- 1つのソース Vault に作れる replica は同時に1つです（別リージョンに変えたい場合は既存 replica を削除してから）。
- SOFTWAREのタイプもレプリケーションできる

#### Vault/MEKのレプリケーション

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/replicatingvaults_topic-To_create_a_vault_replica.htm

- リージョン間レプリケーション機能が導入される前に作成された仮想Vaultはレプリケーションできない
  - 一方，VPVはクロス・リージョン・レプリケーションをサポートしている
- [GetVault](https://docs.oracle.com/iaas/api/#/en/key/latest/Vault/GetVault) APIの`isVaultReplicable`パラメータを使用して，ボールトがクロス・リージョン・レプリケーションをサポートしているかどうかを確認できる
- 別のリージョンでレプリケートする必要があるボールトがあり，そのボールトでレプリケーションがサポートされていない場合，新しいボールトおよび新しいキーを作成します。既存のキーを新しいボールトにコピーできません。
- レプリケーションに追加料金はないが、ソースと宛先リージョンの両方で key version の料金が発生する
  - https://blogs.oracle.com/cloud-infrastructure/kms-crossregion-replication-virtual-vault-ga
- レプリケートされたキー・バージョンは、格納されているリージョンの制限に対してカウントされます。

  - https://docs.oracle.com/ja-jp/iaas/Content/General/Concepts/servicelimits.htm

- レプリケーションのためにはサービスポリシーが別途必要になる

```
Allow service keymanagementservice to manage vaults in tenancy
```

- Vaultのレプリケーションを行うとレプリケーション先のリージョンのVault詳細画面に以下の説明が出る

> プレミアム機能(クロス・リージョン・レプリケーションなど)を備えた仮想ボールトは、だれでも利用できるわけではありません。しかし、機能の一般提供後は、OCIは現在の価格(キー・バージョンごとに月額0.53ドル)よりも高いプレミアム価格の請求を開始します。現在、テナンシではFree Tierキーを作成する準備ができていませんが、一般提供後には作成できるようになります。

#### シークレットのレプリケーション

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Concepts/secrets-replication.htm

- 最大３つのリージョンでレプリケーションが可能

## 参考リンク

- OCI Vault ホーム (公式ドキュメント)
  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/home.htm
- ボールト、キー管理およびシークレット管理の概要 (公式ドキュメント)
  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Concepts/keyoverview.htm
- Vault API Reference - Vault Key Management API
  - https://docs.oracle.com/en-us/iaas/api/#/en/key/release/
