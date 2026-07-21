---
title: Identity Domains で生成されるトークンサンプル
date: 2025-11-23
modified: 2026-07-21
draft: false
tags:
  - cloud/oci/identity
  - identity/oauth
  - identity/oidc
aliases:
  - cloud/oracle/idcs-token
  - cloud/oracle/identity/idcs-token
description: OCI Identity Domains が発行する Access Token、ID Token、UserInfo、認証トークンのサンプルを整理する。
---

## Access Token

### ヘッダー

```json
{
  "x5t#S256": "TBoKExKiK4EwfN--Niu2tOX1gSI_q7q8ag09Ef2Tbm0",
  "x5t": "5zhuAWbnp2LW7cr9O_rzZgeb60I",
  "kid": "SIGNING_KEY",
  "alg": "RS256"
}
```

### ペイロード

```json
{
  "client_ocid": "ocid1.domainapp.oc1.iad.<applicationOcid>",
  "user_tz": "America/Chicago",
  "sub": "User01 - Dev Domain",
  "user_locale": "ja",
  "sidle": 480,
  "idp_name": "UserNamePassword", // IdP Name
  "user.tenant.name": "idcs-<domainUrl>",
  "idp_guid": "UserNamePassword", // 外部IdPの場合，idp_nameとは別のランダム文字列のIDが表示
  "amr": [
    "USERNAME_PASSWORD" // SAMLの場合は「SAML」
  ],
  "iss": "https://identity.oraclecloud.com/",
  "domain_home": "us-ashburn-1",
  "ca_ocid": "ocid1.tenancy.oc1..<tenantOcid>",
  "user_tenantname": "idcs-<domainUrl>",
  "client_id": "<client_id>",
  "sid": "a717ca40ce164b1ca595bcf152e10697:fa2d9d",
  "domain_id": "ocid1.domain.oc1..<domainOcid>",
  "sub_type": "user",
  "scope": "urn:opc:idm:t.security.client openid urn:opc:idm:t.user.me urn:opc:idm:t.user.me.passwordvalidator urn:opc:idm:t.user.authn.factors",
  "user_ocid": "ocid1.user.oc1..<userOcid>",
  "client_tenantname": "idcs-<domainUrl>",
  "region_name": "us-ashburn-idcs-1",
  "user_lang": "en",
  "userAppRoles": ["Authenticated"],
  "exp": 1763909141,
  "iat": 1763905541,
  "client_guid": "<applicationId>",
  "client_name": "Postman - Confidential Client",
  "idp_type": "LOCAL", // 外部IdPによるSAMLの場合は「SAML」
  "tenant": "idcs-<domainUrl>",
  "jti": "30ddadef731f45dfa45da0ca5d4ac842",
  "gtp": "azc",
  "user_displayname": "user-dev-01",
  "opc": false,
  "sub_mappingattr": "userName",
  "primTenant": false,
  "tok_type": "AT", // Token Type
  "aud": [
    "https://idcs-<domainUrl>.identity.oraclecloud.com",
    "https://idcs-<domainUrl>.us-ashburn-idcs-1.secure.identity.oraclecloud.com",
    "https://idcs-<domainUrl>.identity.oraclecloud.com:443",
    "urn:opc:lbaas:logicalguid=idcs-<domainUrl>"
  ],
  "ca_name": "<tenancyName>",
  "user_id": "c7dfb14d6530414e97dd2064fe23c695",
  "domain": "koit-domain-iad-dev",
  "clientAppRoles": [
    "DB Administrator",
    "Global Viewer",
    "Authenticated Client",
    "Identity Domain Administrator"
  ],
  "tenant_iss": "https://idcs-<domainUrl>.identity.oraclecloud.com:443"
}
```

## ID Token

- `responce_type` に `idtoken` を含めずとももらえる

### ヘッダー

```json
{
  "x5t#S256": "TBoKExKiK4EwfN--Niu2tOX1gSI_q7q8ag09Ef2Tbm0",
  "x5t": "5zhuAWbnp2LW7cr9O_rzZgeb60I",
  "kid": "SIGNING_KEY",
  "alg": "RS256"
}
```

### ペイロード

```json
{
  "user_tz": "America/Chicago",
  "client_ocid": "ocid1.domainapp.oc1.iad.<applicationOcid>",
  "at_hash": "98HIYHGEwWEQ4AWa5nPSHA",
  "sub": "User01 - Dev Domain",
  "user_locale": "ja",
  "idp_name": "UserNamePassword",
  "sidle": 480,
  "idp_guid": "UserNamePassword",
  "amr": [
    // 使用された認証方法
    "USERNAME_PASSWORD"
  ],
  "iss": "https://identity.oraclecloud.com/", // トークンを発行したプリンシパル（認可サーバー）
  "ca_ocid": "ocid1.tenancy.oc1..<tenantOcid>",
  "user_tenantname": "idcs-<domainUrl>",
  "client_id": "<client_id>",
  "sid": "a717ca40ce164b1ca595bcf152e10697:fa2d9d",
  "domain_id": "ocid1.domain.oc1..<domainOcid>",
  "authn_strength": "2",
  "azp": "<client_id>",
  "auth_time": 1763905537,
  "user_ocid": "ocid1.user.oc1..<userOcid>",
  "session_exp": 1763934337,
  "client_tenantname": "idcs-<domainUrl>",
  "region_name": "us-ashburn-idcs-1",
  "user_lang": "en",
  "exp": 1763934337,
  "iat": 1763905541,
  "client_name": "Postman - Confidential Client",
  "client_guid": "<applicationId>",
  "idp_type": "LOCAL",
  "tenant": "idcs-<domainUrl>",
  "jti": "a2d76d76fd8a49b5b2790fc7f3f18172", // JWT ID
  "user_displayname": "user-dev-01",
  "sub_mappingattr": "userName",
  "primTenant": false,
  "tok_type": "IT", // Token Type
  "aud": ["https://identity.oraclecloud.com/", "<client_id>"],
  "ca_name": "<tenancyName>",
  "user_id": "c7dfb14d6530414e97dd2064fe23c695",
  "domain": "koit-domain-iad-dev",
  "tenant_iss": "https://idcs-<domainUrl>.identity.oraclecloud.com:443",
  "pulp": "MyApps"
}
```

## UserInfo

- `openid` だけでも以下の情報は得られる

```json
{
  "birthdate": "",
  "family_name": "user-dev-01",
  "gender": "",
  "name": "user-dev-01",
  "preferred_username": "User01 - Dev Domain",
  "sub": "User01 - Dev Domain",
  "updated_at": 1763905537,
  "website": ""
}
```

- profile以上を含めると、同意を求められる

```
https://idcs-<domainUrl>.identity.oraclecloud.com/ui/v1/myconsole/consent
```

![[Pasted image 20251123231323.png]]

```json
{
  "birthdate": "",
  "email": "<alice@wonderland.com>",
  "email_verified": true,
  "family_name": "user-dev-01",
  "gender": "",
  "name": "user-dev-01",
  "preferred_username": "User01 - Dev Domain",
  "sub": "User01 - Dev Domain",
  "updated_at": 1763905537,
  "website": ""
}
```

## 認証トークン

- `/sso/v1/sdk/authenticate` で認証を通過したときに返されるトークン
- このレスポンスとしては以下のJSONのような形式になる

```json
{
  "authnToken": "eyJ4NXQjUzI1NiI6I...",
  "status": "success",
  "ecId": "xxxxxxxxxxxxx" // ユーザー識別子
}
```

- アプリケーションはこの `authToken` を使用してアクセストークンを取得することができる
  - グラントタイプはJWT

```
grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
scope=urn:opc:idm:__myscopes__
assertion={{authnToken}}
```

- 取得したアクセストークンは `/admin/v1/Me` とか `/admin/v1/MyGroups` とか　`/admin/v1/MyApps` なんかで，そのユーザー自身の情報を取得するのに使うのが一般的だろうか

- 以下，`authToken` をデコードしたもの
- IDトークンとほぼ同じ

### ヘッダー

```json
{
  "x5t#S256": "TBoKExKiK4EwfN--Niu2tOX1gSI_q7q8ag09Ef2Tbm0",
  "x5t": "5zhuAWbnp2LW7cr9O_rzZgeb60I",
  "kid": "SIGNING_KEY",
  "alg": "RS256"
}
```

### ペイロード

```json
{
  "client_ocid": "ocid1.domainapp.oc1.iad.amaaaaaa4kdszoaank4iwfzhmitieyafcmu4jhffbyhvnj6wtnz7mzk7zjpq",
  "user_tz": "America/Chicago",
  "sub": "User01 - Dev Domain",
  "user_locale": "ja",
  "idp_name": "UserNamePassword",
  "sidle": 480,
  "idp_guid": "UserNamePassword",
  "amr": ["USERNAME_PASSWORD"],
  "iss": "https://identity.oraclecloud.com/",
  "user_tenantname": "idcs-<domainUrl>",
  "ca_ocid": "ocid1.tenancy.oc1..<tenantOcid>",
  "client_id": "<client_id>",
  "sid": "5096bc420b214599a6072ea6b6b8ad47:fa2d9d",
  "acs": "4R5ItdPa3dlPXKvNio6PqdsMHSfdtH...", // 非公開の内部用途コンテキスト？
  "domain_id": "ocid1.domain.oc1..<domainOcid>",
  "azp": "Postman",
  "authn_strength": 2,
  "auth_time": 1763956264,
  "user_ocid": "ocid1.user.oc1..<userOcid>",
  "client_tenantname": "idcs-<domainUrl>",
  "session_exp": 1763985064,
  "region_name": "us-ashburn-idcs-1",
  "user_lang": "en",
  "exp": 1763985064,
  "iat": 1763956264,
  "client_name": "Postman",
  "client_guid": "<applicationId>",
  "tenant": "idcs-<domainUrl>",
  "idp_type": "LOCAL",
  "jti": "137d3ae6cc4b4474a0a9533d2fcdfc3b",
  "user_displayname": "user-dev-01",
  "sub_mappingattr": "userName",
  "primTenant": false,
  "tok_type": "IT",
  "aud": ["https://identity.oraclecloud.com/", "<client_id>", "Postman"],
  "ca_name": "koitenancy",
  "user_id": "c7dfb14d6530414e97dd2064fe23c695",
  "domain": "koit-domain-iad-dev",
  "pulp": "MyApps",
  "tenant_iss": "https://idcs-<domainUrl>.identity.oraclecloud.com:443"
}
```

## 参照リンク

- https://docs.oracle.com/ja-jp/iaas/Content/Identity/api-getstarted/usingopenidconnect.htm
- https://www.slideshare.net/slideshow/ochacafe5/141546360
