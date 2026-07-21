---
title: OCI Vault マスター暗号化キー
date: 2025-12-13
modified: 2026-07-21
draft: false
tags:
  - cloud/oci/vault
  - security/cryptography
aliases:
  - cloud/oracle/oci-vault-mek
description: OCI Vault のマスター暗号化キー、Key Version、BYOK、暗号化、署名、エクスポート操作を整理する。
---

## 概要

### MEK

- 以下のアルゴリズムを使用した鍵が生成可能

  - **AES**: Advanced Encryption Standard
  - **RSA**: Rivest-Shamir-Adleman
  - **ECDSA**: 楕円曲線暗号デジタル署名アルゴリズム

- 用途と選べる種類は以下の通り

| アルゴリズム | 利用可能な用途                         | 鍵長                                      |
| ------------ | -------------------------------------- | ----------------------------------------- |
| AES          | ・暗号化<br>・復号                     | ・128 bit<br>・192 bit<br>・256 bit       |
| RSA          | ・暗号化<br>・復号<br>・署名<br>・検証 | ・2048 bit<br>・3072 bit<br>・4096 bit    |
| ECDSA        | ・署名<br>・検証                       | ・NIST_P256<br>・NIST_P384<br>・NIST_P521 |

- また，保護モード (`protectionMode`) として次の２つから選択できる
  - HSM (`HSM`)
  - ソフトウェア (`SOFTWARE`)
- 内部的なパラメータとしては，この他に `EXTERNAL` がある
- エンドポイントはVaultごとに用意される「管理エンドポイント」を使用する

### MEKのリスト

- API: [ListVaults](https://docs.oracle.com/en-us/iaas/api/#/en/key/release/VaultSummary/ListVaults)

#### List

レスポンスサンプル

```json
{
  "compartmentId": "ocid1.compartment.oc1..<compartment_ocid>",
  "definedTags": {},
  "displayName": "<MEK Name>",
  "freeformTags": {},
  "id": "ocid1.key.oc1.iad.<mek_ocid>",
  "lifecycleState": "PENDING_DELETION",
  "timeCreated": "2025-07-18T09:14:28.268Z",
  "vaultId": "ocid1.vault.oc1.iad.<vault_ocid>",
  "protectionMode": "SOFTWARE",
  "algorithm": "RSA",
  "externalKeyReferenceDetails": null,
  "isAutoRotationEnabled": false
}
```

- Body: [VaultSummary Reference](https://docs.oracle.com/en-us/iaas/api/#/en/key/release/VaultSummary/)
  - `lifecycleState`
    - `CREATING`
    - `ACTIVE`
    - `DELETING`
    - `DELETED`
    - `PENDING_DELETION`
    - `SCHEDULING_DELETION`
    - `CANCELLING_DELETION`
    - `UPDATING`
    - `BACKUP_IN_PROGRESS`
    - `RESTORING`

#### Get

レスポンスサンプル

```json
{
  "compartmentId": "ocid1.compartment.oc1..<<compartment_ocid>>",
  "cryptoEndpoint": "https://<vault_namespace>-crypto.kms.us-ashburn-1.oraclecloud.com",
  "definedTags": {
    "Oracle-Tags": {
      "CreatedBy": "<user名>",
      "CreatedOn": "2025-05-11T07:24:18.355Z"
    }
  },
  "displayName": "vault-iad-dev",
  "freeformTags": {},
  "id": "ocid1.vault.oc1.iad.<key_ocid>",
  "lifecycleState": "ACTIVE",
  "managementEndpoint": "https://<vault_namespace>-management.kms.us-ashburn-1.oraclecloud.com",
  "timeCreated": "2025-05-11T07:24:19.027Z",
  "timeOfDeletion": null,
  "vaultType": "DEFAULT",
  "restoredFromVaultId": null,
  "wrappingkeyId": "ocid1.key.oc1.iad.<key_ocid>",
  "replicaDetails": null,
  "isPrimary": true,
  "isVaultReplicable": true,
  "externalKeyManagerMetadataSummary": null
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/Vault/

### MEKの作成

リクエストサンプル

```json
POST {管理エンドポイント}/20180608/keys
	?opc-request-id=<option: string>
	&opc-retry-token=<option: string>
Host: <managementEndpoint>
<authorization and other headers>

{
  "compartmentId": "ocid1.tenancy.oc1..<<compartment_ocid>>",
  "displayName": "Foo Key",
  "keyShape": {
    "algorithm": "AES"
    "length": 16
  }
}
```

- API: [CreateKey](https://docs.oracle.com/en-us/iaas/api/#/en/key/release/Key/CreateKey)
- Bodyはここを参照
  - https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/CreateKeyDetails
- KeyShapeはここを参照
  - https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/KeyShape

### MEKの更新

- MEKを更新する

### バージョン

- 各MEKはバージョンを持ち，以下のようなOCIDで管理される
  - `ocid1.keyversion.oc1.iad.xxxxxxxxxxxxxx`
- ソースとして「Internal」「External」の２つがあるが，これはVaultサービスで作成・管理されるか，サードパーティツールで作成しVaultサービスがインポートするかの違いになる
  - ローテーションする際も，外部キーをインポートすることができる
- Response Bodyはここを参照
  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/importingkeys.htm

### BYOK

- インポートはHSM保護のキーにしかインポートできない
  - Software保護キーはだめ
  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/importingkeys_topic-To_import_the_key_material_as_a_new_external_key.htm
- インポート可能なアルゴリズム
  - AES: 128 / 192 / 256 bit (16 / 24 / 32 byte)
  - RSA: 2048 / 3072 / 4096 bit (256 / 384 / 512 byte)
  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/importingkeys.htm
- 用意した鍵長が，作成・インポート時に指定した長さと一致している必要がある

#### Wrapping Key

- Wrappingの制限・要件

  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/importingkeys.htm
  - PCI準拠の観点を考慮すると，ラップに使う鍵より強い鍵はインポートできない（機能ではなくPCI準拠のための制約）
    - ラッピングに使う鍵が「`RSA 4096`」なので，`AES 128 bit`を超える鍵はインポートできないことになる

- Wrapping KeyはVault Summaryからkeyidを確認することができる。
  - 以下はGetMEKで取得したときのレスポンスサンプル

```json
{
  "compartmentId": "ocid1.compartment.oc1..<compartment_ocid>>",
  "currentKeyVersion": "ocid1.keyversion.oc1.iad.<keyversion_ocid>",
  "definedTags": {},
  "displayName": "RSA wrapping key",
  "freeformTags": {},
  "id": "ocid1.key.oc1.iad.<key_ocid>",
  "keyShape": {
    "algorithm": "RSA",
    "length": 512,
    "curveId": null
  },
  "protectionMode": "HSM",
  "lifecycleState": "ENABLED",
  "timeCreated": "2025-05-11T07:24:32.441Z",
  "timeOfDeletion": null,
  "vaultId": "ocid1.vault.oc1.iad.<vault_ocid>",
  "restoredFromKeyId": null,
  "replicaDetails": {
    "replicationId": "<replicationId>"
  },
  "isPrimary": true,
  "isAutoRotationEnabled": false,
  "autoKeyRotationDetails": null,
  "externalKeyReferenceDetails": null
}
```

## 処理

- MEKを使ったよりは暗号エンドポイント「`cryptoEndpoint`」を使用する

### 暗号化操作

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/ekms_encryption_data.htm

リクエストサンプル

```json
POST {{cryptoEndpoint}}/20180608/encrypt

{
  "encryptionAlgorithm": "RSA_OAEP_SHA_1", // デフォルトは「AES_256_GCM」になる
  "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
  "plaintext": "SGVsbG8gT0NJIFZhdWx0" // Base64でエンコードしておく
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/EncryptDataDetails

レスポンスサンプル

```json
{
  "ciphertext": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
  "keyVersionId": "ocid1.keyversion.oc1.iad.<mek_keyversion_ocid>",
  "encryptionAlgorithm": "AES_256_GCM"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/EncryptedData/

### 復号操作

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/ekms_decryption_data.htm
API: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/DecryptedData/Decrypt

リクエストサンプル

```json
POST {{cryptoEndpoint}}/20180608/decrypt

{
    "ciphertext": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
    "keyVersionId": "ocid1.keyversion.oc1.iad.<mek_keyversion_ocid>",
    "encryptionAlgorithm": "RSA_OAEP_SHA_256"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/DecryptDataDetails
- よく見ると分かるが，暗号化時のレスポンスBodyをそのまま送ると復号できる

レスポンスサンプル

```json
{
  "plaintext": "SGVsbG8gT0NJIFZhdWx0",
  "plaintextChecksum": "1735056167",
  "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
  "keyVersionId": "ocid1.keyversion.oc1.iad.<mek_keyversion_ocid>",
  "encryptionAlgorithm": null
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/DecryptedData/

### データ暗号化キーを取得

Doc: https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/ekms_generating_dek.htm

- ４KBを超えるデータをMEKに送って暗号化してもらうことはできない
- 暗号化してもらうデータが大きい場合，`Generate DEK`でデータ暗号化のための暗号化鍵を生成し送ってもらう
  - ネットワーク転送による性能面でも，エンベロープ暗号化が有利なときもある
  - https://www.oracle.com/jp/security/cloud-security/key-management/faq/
- DEK生成に使えるMEKはAESのみが対象

  - また，コンソールからはDEKは生成できない

- 暗号化して利用するときのフローは以下のようになる

  1.  MEK(KMS)にGenerate DEKを要求。
  2.  応答として次の２つが返る
      1. 平文DEK
      2. 暗号化されたDEK
  3.  アプリケーションは平文DEKを使ってデータ本体を暗号化。必要に応じてIVやNonceも生成する，その後，平文DEKは消去する。
  4.  アプリケーションは最終的に次の２つをセットで保存する
      - 暗号化データ
      - 暗号化されたDEK
      - （必要なら）IV，Nonce，その他暗号化のコンテキスト

- 復号して利用するときのフローは以下のようになる

  1.  保存されている暗号化DEKをとりだす
  2.  KMSに暗号化DEKの復号を要求。平文DEKを取得する。（このとき，同じMEKを指定することに注意する）
  3.  平文DEKでデータを復号
  4.  平文DEKは再び破棄

- API
  - 参照: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/GeneratedKey/GenerateDataEncryptionKey

リクエストサンプル

```json
POST {cryptEndpoint}/20180608/generateDataEncryptionKey

{
  "keyId": "ocid1.key.oc1.iad.<mek_ocid>", // 生成したDEKを暗号化するためのmek_ocid
  "includePlaintextKey": "true",
  "keyShape": {
    "algorithm": "AES",
    "length": 16
  }
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/GenerateKeyDetails
- keyShape: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/KeyShape

レスポンスサンプル

```json
{
  "ciphertext": "AAwRhavVBkAAAJNF0nE7tBz/CQDanO33toIAWpw/lCn9GuadiyNNZ2QCmeUksvor8HD00o0TiUHzj6IsDJ5z1j/AEXZrhBtEcz4=", // MEKから生成された暗号化されているDEK
  "plaintext": "lqGERnQJYzljUfMITDub/uV5ZbQkvCE906Wg/mflz2s=", // Base64されたDEK平文
  "plaintextChecksum": "1140988275" // includePlaintextKeyがtrueだと返る
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/GeneratedKey/

### 署名

API: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/SignedData/Sign

リクエストサンプル

```json
POST {cryptoEndpoint}/20180608/sign

{
  "keyId": "ocid1.key.oc1.iad.exampledaaeug.examplestkvmbjdnbickxcvbotxd5q23tteidhj4q2c6qfauxm32i577yu5a",
  "message": "SGVsbG8gT0NJIFZhdWx0IQ0KVGhpcyBpcyBTYW1wbGUgRGF0YQ==", // base64エンコードしておく
  "signingAlgorithm": "SHA_224_RSA_PKCS1_V1_5"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/SignDataDetails

- `messageType`
  - `message`が生のメッセージかダイジェストかを示す
  - `RAW`か`DIGEST`があり，デフォルトは`RAW`
  - `DIGEST`を使う場合，ダイジェストを作成した時を同じアルゴリズムを`signingAlgorithm`で指定する

レスポンスサンプル

```json
{
  "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
  "keyVersionId": "ocid1.keyversion.oc1.iad.<mek_keyversion_ocid>",
  "signature": "Jsj0gPuxvcwDLXodRFeQYH/0xKKwhrefZuKaIrkE8X6tPqpy+th34f+fbzQjkPYdc5qR7hjHWiBa8ZvXGg+km+gZ/a7lTzSe6Ek91A4l4lhwtfkXlUPfGBVAGAWekbShPajCrCk6gD2EjFzbbZ9ahuHcVKaYWg9DMDH34Nccqh2AJKojnpuqdEtcPsoKH++VOyBTIBGEjpi77FFryaj/b5di8midjrwhBhdkyDeKUcPe39ksagOenebTjbdX6a2ukVap8q8Wa7/1ynkl87yL/IMNRcBejxgvca2adNY/7QHCyQAazIQOzr8N1hOPioiMeMmTr55FVMIHWhk7KE2ehz2mlSP+iz0cs4hJwQiuGlyZZYYA7txHOwE6qc8pz/6AzWQG2XCJ3xM9HfaVGO+/mG7/6WtKSW1oXig6mWs6moeWikmjQZqRDpGnOlJjdqdWPwpI8SY3BgQxb0wtWJYp8Rw72YnB3nLYIYYAGJWRicpKcu6AickP0igejpb7KnteiyZkJ2SvFopMdqGyGFqd2T3OJY2VWbwvKdnwx2qJkyywMHDqKXnYCl4/mgJPsx9lIpC+NENLeYIHedMu/iW/2dkfvWStdk0l+qLv6YJJOm9y0GKYdyU+UN4oxE9ujTeBGjRjIrpEmE7nraD4h2kaNVcrn9qKwPB2hiPuZ/2vkvo=",
  "signingAlgorithm": "SHA_224_RSA_PKCS1_V1_5"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/SignedData/

### 検証

API: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/VerifiedData/Verify

リクエストサンプル

```json
POST {cryptoEndpoint}/20180608/verify

{
    "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
    "keyVersionId": "ocid1.keyversion.oc1.iad.<mek_keyversion_ocid>",
    "message": "SGVsbG8gT0NJIFZhdWx0IQ0KVGhpcyBpcyBTYW1wbGUgRGF0YQ==",
    "signature": "Jsj0gPuxvcwDLXodRFeQYH/0xKKwhrefZuKaIrkE8X6tPqpy+th34f+fbzQjkPYdc5qR7hjHWiBa8ZvXGg+km+gZ/a7lTzSe6Ek91A4l4lhwtfkXlUPfGBVAGAWekbShPajCrCk6gD2EjFzbbZ9ahuHcVKaYWg9DMDH34Nccqh2AJKojnpuqdEtcPsoKH++VOyBTIBGEjpi77FFryaj/b5di8midjrwhBhdkyDeKUcPe39ksagOenebTjbdX6a2ukVap8q8Wa7/1ynkl87yL/IMNRcBejxgvca2adNY/7QHCyQAazIQOzr8N1hOPioiMeMmTr55FVMIHWhk7KE2ehz2mlSP+iz0cs4hJwQiuGlyZZYYA7txHOwE6qc8pz/6AzWQG2XCJ3xM9HfaVGO+/mG7/6WtKSW1oXig6mWs6moeWikmjQZqRDpGnOlJjdqdWPwpI8SY3BgQxb0wtWJYp8Rw72YnB3nLYIYYAGJWRicpKcu6AickP0igejpb7KnteiyZkJ2SvFopMdqGyGFqd2T3OJY2VWbwvKdnwx2qJkyywMHDqKXnYCl4/mgJPsx9lIpC+NENLeYIHedMu/iW/2dkfvWStdk0l+qLv6YJJOm9y0GKYdyU+UN4oxE9ujTeBGjRjIrpEmE7nraD4h2kaNVcrn9qKwPB2hiPuZ/2vkvo=",
    "signingAlgorithm": "SHA_224_RSA_PKCS1_V1_5"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/VerifyDataDetails

- 署名レスポンスに`message`を加える必要があるので注意（必須）

レスポンスサンプル

```json
{
  "isSignatureValid": true
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/VerifiedData/

### キーのエクスポート

API: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/ExportedKeyData/ExportKey

リクエストサンプル

```json
POST {cryptoEndpoint}/20180608/exportKey

{
  "keyId": "ocid1.key.oc1.iad.<mek_ocid>",
  "algorithm": "RSA_OAEP_AES_SHA256",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuRma/WlBafhUH1tja7Sh\nKZwlDgS1ATt9JplgKDpk1CTWxQ5iOLFr0eNzti9Ha3Zd0UA6BSq9YFCxLGQNOFIT\nCDbWdjBdagRKvY4mE5jz/UNY3aqYiEzyf7BevpZlVhrcZGEVkR5RCigUrpX7qYmB\n9zJJgEKtHJ1C0CF8T90qdspCaKvkPoVgiD+iusQmFm4BQG9NVUryUBdc+0ndcCRq\nBv0ArWKtVzCctVMO3BL5SPVwJzh71UkOjTacVT9dEbz0SychhKw8DAHzXBHDoJWO\nOnZ/H/LTAhi7kmWBi13rrc4r1rwNvALYuQjz8Exzutrldld2RWzzp+n6Oo5W9usH\noQIDAQAB\n-----END PUBLIC KEY-----"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/datatypes/ExportKeyDetails

- RSA鍵は`RSA_OAEP_AES_SHA256`でないとエクスポートできない

レスポンスサンプル

```json
{
  "keyVersionId": "ocid1.keyversion.oc1.iad.<mek_keyversion_ocid>",
  "keyId": "ocid1.key.oc1.iad.<key_ocid>",
  "timeCreated": "2025-12-13T08:38:14.411Z",
  "vaultId": "ocid1.vault.oc1.iad.<vault_ocid>",
  "encryptedKey": "nw1mHxl9AUSZu77+wPGU7C+AKAIORGxzDd4xAXXfJ6OakwXtWxKbb79pC6es1vciIWspdSBGeo91urAXLCYrUgzQuiOsbv9ihMl0GotKOw94YzTSoRzFzT/pm3cP/uhyjA0VUzTwer8zlXhAcX42P8ZrB8DCw6lhkL...E3kg+T6VUlKVSRjKvFRuk7GRAn0INyCo5y/3bDnD42xMFRvMvoJkrgoCtlT5rtJgwi2jn0SeZpysYrJgFVU6I6yfqw==",
  "algorithm": "RSA_OAEP_AES_SHA256"
}
```

- Body: https://docs.oracle.com/en-us/iaas/api/#/en/key/release/ExportedKeyData/
- 今回はRSA鍵をエクスポートしているが秘密鍵が返ってきている

## 参照リンク

- キーの作成
  - https://docs.oracle.com/ja-jp/iaas/Content/KeyManagement/Tasks/managingkeys_topic-To_create_a_new_key.htm
-
