---
title: OCI Vault シークレット
date: 2025-12-13
modified: 2026-07-21
draft: false
tags:
  - cloud/oci/vault
  - security/cryptography
aliases:
  - cloud/oracle/oci-vault-secret
description: OCI Vault シークレットの更新、ローテーション、取得、レプリケーションを整理する。
---

## 概要

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/managingsecrets.htm

- 上限サイズは25KB
- シークレット内容はBase64エンコードして送る必要がある
  - そのため，元データとしては25KBより少し小さくなる
- 自動生成シークレットの場合は種類ごとにさらに小さい上限がある
  - Passphrase:
    - 最大32文字、Bytes は 512/1024 bytes 生成
  - SSH鍵:
    - 長さ2048、3072および4096のRSAキー・ペアを生成。
    - 秘密鍵はPKCS#8 PEM形式で格納され、公開鍵はX.509 PEM形式で格納
  - BYTES:
    - FIPS準拠のバイナリ秘密鍵として、512バイトおよび1024バイトを生成する。バイト列はBase64コード化されている。

## シークレット

### 更新

Doc: [シークレットのコンテンツの更新](https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/managingsecrets_topic-To_update_a_secrets_contents_to_create_a_new_secret_version.htm)

- シークレットの内容を更新したいときは新規バージョンを作成する
- メタデータだけ変えたい場合は中身ではないので，プロパティ更新はバージョンに関係なくできる

Doc: [シークレットの編集](https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/tasks_managingsecrets_topic_to_update_a_secret_dita.htm)

- 一回の更新で，CURRENTの変更，contentsの更新，secret rulesの更新は同時にできない

```json
[
    {
        "compartmentId": "ocid1.compartment.oc1..<compartment_ocid>",
        "definedTags": {
            "Oracle-Tags": {
                "CreatedBy": "<user>",
                "CreatedOn": "2025-10-10T02:12:55.362Z"
            }
        },
        "description": "<説明文>",
        "freeformTags": {},
        "systemTags": null,
        "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
        "id": "ocid1.vaultsecret.oc1.iad.<secret_ocid>",
        "lifecycleDetails": null,
        "lifecycleState": "ACTIVE",
        "replicationConfig": null,
        "isReplica": null,
        "sourceRegionInformation": null,
        "rotationConfig": null,
        "rotationStatus": "NOT_ENABLED",
        "lastRotationTime": null,
        "nextRotationTime": null,
        "secretName": "<シークレット名>",
        "timeCreated": "2025-10-10T02:12:55.275Z",
        "timeOfCurrentVersionExpiry": null,
        "timeOfDeletion": null,
        "vaultId": "ocid1.vault.oc1.iad.<vault_ocid>",
        "secretGenerationContext": null,
        "isAutoGenerationEnabled": false
    },
...
```

`secretGenerationCOntext`は以下の通り

```json
"secretGenerationContext": {
	"generationType": "PASSPHRASE",
	"secretTemplate": "",
	"generationTemplate": "SECRETS_DEFAULT_PASSWORD",
	"passphraseLength": 14
},
"secretGenerationContext": {
	"generationType": "PASSPHRASE",
	"secretTemplate": "",
	"generationTemplate": "DBAAS_DEFAULT_PASSWORD",
	"passphraseLength": 14
},
"secretGenerationContext": {
	"generationType": "SSH_KEY",
	"secretTemplate": "",
	"generationTemplate": "RSA_2048"
},
"secretGenerationContext": {
	"generationType": "BYTES",
	"secretTemplate": "",
	"generationTemplate": "BYTES_512"
},
```

- シークレット本体に対して複数のバージョンを持ち，更新やローテーションのたびに新しいバージョンを増やす
- シークレット内容を更新すると，新しいシークレットバージョンが作成される（？）
- １つのシークレットにつき，active最大30バージョン，削除街最大30バージョン

## ローテーション

- シークレット作成または更新の際に、自動ローテーションをオンにできる。
- rotationInterval は 1day ~ 365days 内で設定できる。
- 設定値はISO 8601に従う  
  参考）[https://qiita.com/e99h2121/items/c298fee44ea4e57986c9](https://qiita.com/e99h2121/items/c298fee44ea4e57986c9)

シークレットのメタデータを参照すると、**nextRotationTime** というパラメータにより、いつローテーションが行われるかは確認できる。

なお、ローテーションの日時を指定することはできなさそう。  
[https://docs.oracle.com/en-us/iaas/api/#/en/secretmgmt/20180608/Secret/](https://docs.oracle.com/en-us/iaas/api/#/en/secretmgmt/20180608/Secret/)

そのため、任意のタイミングでローテーションしたい場合は、Functionなどで外部から以下を実行させてあげなきゃいけない。  
[https://docs.oracle.com/en-us/iaas/api/#/en/secretmgmt/20180608/Secret/RotateSecret](https://docs.oracle.com/en-us/iaas/api/#/en/secretmgmt/20180608/Secret/RotateSecret)

ちなみにコンソールからはこの選択肢しかないので、注意
![[Pasted image 20260622231616.png]]

## シークレット・バンドル（シークレットの取得）

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Concepts/keyoverview.htm
API: https://docs.oracle.com/en-us/iaas/api/#/en/secretretrieval/20190301/SecretBundle/

- シークレットバージョンとシークレットの中身は [Vault Secret Retrieval API](https://docs.oracle.com/en-us/iaas/api/#/en/secretretrieval/20190301/) に対してリクエストを行う
- シークレットバンドル
  - シークレットの中身，シークレットのプロパティ（およびバージョン），ユーザー提供のシークレットのコンテクストデータを含む

リクエストサンプル

```json
GET /20190301/secretbundles/<secret_OCID>
Host: <secretsEndpoint>
<authorization and other headers>
```

レスポンスサンプル

```json
{
  "secretId": "ocid1.vaultsecret.oc1.iad.<vault_ocid>",
  "timeCreated": "2025-10-10T02:12:55.275Z",
  "versionNumber": 1,
  "versionName": "secretContent",
  "secretBundleContent": {
    "contentType": "BASE64",
    "content": "aGVsbG8gU2VjcmV0cyEh" // シークレットの内容
  },
  "timeOfDeletion": null,
  "timeOfExpiry": null,
  "stages": ["CURRENT", "LATEST"],
  "metadata": null
}
```

## レプリケーション

https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Concepts/secrets-replication.htm

> [!NOTE] Title
> ここはあとで確認する

- 最大３つのリージョンまでレプリケーションが可能
- 鍵はレプリケーション元とアルゴリズムが違っていても大丈夫
- レプリカはread-onlyでレプリカ側で編集はできない
- ソースでレプリケーション機能を無効化するとレプリカは削除される
- Vaultの鍵のレプリケーションをしてもSecretはレプリケーションされないので，Secretは個別にレプリケーションする必要がある
- OCIコンソールで書込み転送を有効にはできない。
  - これらの操作には、[CreateSecret](https://docs.oracle.com/iaas/api/#/en/secretmgmt/latest/Secret/CreateSecret) APIおよび[UpdateSecret](https://docs.oracle.com/iaas/api/#/en/secretmgmt/latest/Secret/UpdateSecret) APIまたはCLIコマンドを使用して、書込み転送を有効にする。
  - APIで、`isWriteForwardEnabled`を`true`に設定して機能を有効にする

## 参照リンク

- シークレット値（内容）＋そのシークレット/バージョンのメタデータをひとまとめにして返すデータ
- ボールト・シークレット・バンドルは、シークレット・コンテンツ、シークレットおよびシークレット・バージョンのプロパティ(バージョン番号やローテーション状態など)、およびユーザーが指定したシークレットのコンテキスト・メタデータで構成されます。シークレットをローテーションするとき、新しいシークレット・バージョンを作成しますが、これにも新しいシークレット・バンドル・バージョンが含まれています。
