---
title: OCI Cache
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-cache
  - cloud/oracle/database/oci-cache
description: OCI Cache の Valkey／Redis 互換エンジン、非 Shard 構成、Shard 構成、可用性、容量、運用上の注意を整理する。
---

## 概要

Doc: [About OCI Cache](https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm)

- OCI Cache は、Valkey または Redis 互換エンジンを使うフルマネージドのインメモリデータストア
- Oracle は Cluster の作成、Node 配置、Security Update、Patch、監視機能を管理する
- 利用者は Key 設計、TTL、Eviction Policy、Client、容量、可用性、正本からの再生成を管理する
- Cache、Session、Rate Limit、一時状態、低遅延の Key-Value Access に向く

## エンジン

2026 年 7 月時点の公式ドキュメントでは、次のエンジンを選択できる。

| エンジン   | 位置づけ                               |
| ---------- | -------------------------------------- |
| Valkey 8.1 | 推奨される現行エンジン                 |
| Valkey 7.2 | 互換性要件に応じて選択する旧系列       |
| Redis 7.0  | Redis 7.0 互換性が必要な場合に選択する |

対応バージョンと推奨バージョンは変更される。Client Library、Command、Parameter、Persistence、Cluster Mode の互換性を作成時点の資料で確認する。

## Cluster 構成

| 構成 | Data 配置 | Node 構成 | 主な用途 |
| --- | --- | --- | --- |
| Non-sharded Cluster | 全 Key を Primary と Replica が保持 | 1 Primary、最大 4 Replica | 容量が 1 Node に収まり、構成を単純にする |
| Sharded Cluster | Hash Slot によって Key を複数 Shard へ分割 | 3 以上の Shard、各 Shard に 1 Primary と最大 4 Replica | Memory と Throughput を水平方向に拡張する |

- Non-sharded Cluster は 1 Node から 5 Node で構成する
- Sharded Cluster は 3 Shard から 99 Shard で構成し、各 Shard は最大 5 Node を持つ
- Sharded Cluster 全体の Node 数は最大 100
- 1 Node あたりの Memory は 2026 年 7 月時点で最大 500 GB
- Node 数、Shard 数、Node あたり Memory を変更して拡張する
- Memory を増やすと割り当てられる Network Bandwidth も増える

上限は Service Limits として変更される可能性がある。テナンシーの Limit、対応 Region、Engine Version を設計時に確認する。

## 可用性

- Non-sharded Cluster では Primary が Write を受け付け、Replica が Data を複製する
- Sharded Cluster では各 Shard が個別の Primary と Replica を持つ
- Service は可能な範囲で Node を Fault Domain と Availability Domain に分散する
- Oracle の Best Practice は、高可用性が必要な Non-sharded Cluster に 1 Primary と 2 Replica 以上を使う
- Failover、Resize、Patch では Endpoint や接続が切り替わるため、Client は自動再接続と再試行に対応する必要がある

Replica は正本 Database の代替ではない。Application Error、`FLUSHALL`、TTL、Eviction、誤更新は Cluster 内へ反映されるため、必要な Data は別の正本から再生成する。

## Patch と変更

Doc: [About OCI Cache](https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm)

- Service は新しい Patch Image の Node を作成し、Data を複製した後で旧 Node と入れ替える
- Node Swap では Client の再接続が必要になり、短い接続断が発生する可能性がある
- Engine Version を Upgrade する場合は、Custom Configuration が新しい Version と互換である必要がある
- Custom Configuration は作成後に内容を直接変更せず、Copy を作成して新しい設定を割り当てる
- Resize と Patch を通常運用へ含め、Client Library ごとに Failover と Cluster Topology 更新を試験する

## Key と Memory の設計

- Key には有効期限を設定し、不要な一時 Data が残り続けないようにする
- `maxmemory-policy`は Memory 上限に達したときの Eviction を決める
- `noeviction`では新しい Write が失敗し、LRU／LFU 系では既存 Key が削除される
- `KEYS`などの O(n) Command は大規模 Keyspace を停止させる可能性があるため、`SCAN`系 Command を使う
- Sharded Cluster で複数 Key Command を使う場合は、Key が同じ Hash Slot に入る条件を確認する
- Hot Key、Large Value、Connection 数、Pipeline、Memory Fragmentation を Metrics で監視する

## セキュリティ

- OCI IAM は Cluster、Configuration、Backup、OCI Cache User などの制御リソースを管理する
- OCI Cache User の Access Control List（ACL）は、Command、Key、Channel の利用範囲を制御する
- Cluster は VCN 内から接続し、NSG と Zero Trust Packet Routing で Network Access を制御できる
- Client は TLS と Authentication に対応する Version を使う
- 危険な Command と不要な Key Prefix への Access を ACL で制限する

## 選定条件

### 向く条件

- Database Query の結果、Session、Token Bucket、Feature Flag など、再生成できる Data を低遅延で保持する
- TTL と Eviction を許容し、Memory 容量を優先する
- Valkey または Redis Protocol に対応する Client を使う
- Shard Key に相当する Key 設計を行い、水平分割できる

### 向かない条件

- 消失や Eviction を許容できない唯一の業務データを保持する
- 複雑な Join、永続的な分析、完全な監査履歴が必要
- Client が Failover、Cluster Topology、再接続、TLS、Authentication に対応できない
- 必要な Redis／Valkey Command や Module が OCI Cache の対応範囲外

## 参照リンク

- [About OCI Cache](https://docs.oracle.com/en-us/iaas/Content/ocicache/overview.htm)
- [OCI Cache Configurations](https://docs.oracle.com/en-us/iaas/Content/ocicache/configsets-clusters.htm)
- [Supported Configurations for OCI Cache](https://docs.oracle.com/en-us/iaas/Content/ocicache/supported-configurations.htm)
- [OCI Cache Client Best Practices](https://docs.oracle.com/en-us/iaas/Content/ocicache/ocicachebestpractices.htm)
