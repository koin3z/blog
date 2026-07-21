---
title: OCI Block Volume
date: 2026-07-21
modified: 2026-07-21
draft: false
tags:
  - cloud/oci/storage
description: OCI Block Volumeのリソース構造、VPU/GBによる性能設定、IOPSとスループットの上限、Performance SLA、監視とデータ保護を整理する。
---

## Overview

Doc: [ブロック・ボリュームの概要](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/overview.htm)

- OCI Block Volumeは、Computeインスタンスへアタッチする永続的なネットワーク接続型ブロックストレージ
- 容量と性能を別々に設定でき、作成後もボリュームを再作成せずに性能を変更できる
- VPU/GBは実際に発生したIOPSではなく、容量1 GB当たりに購入する性能と月額課金を表す設定値
- 実効性能は、ボリューム、アタッチメント、Computeインスタンス、ワークロードの各上限のうち最も低い値に制約される
- Performance SLAは条件を満たす構成の4 KiB IOPSを対象とし、最大IOPS、スループット、レイテンシ、アプリケーション応答時間を一括して保証するものではない

IOPS、スループット、レイテンシ、I/Oサイズ、キュー深度の一般的な関係は、[[cloud/oracle/database/performance/storage-performance|ストレージ性能のIOPS、スループット、レイテンシ]]を参照。

## リソースモデル

| リソース          | 役割                                                                   | 利用者が管理する主な項目                                  |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Block Volume      | インスタンスからデタッチできるデータ用ブロックデバイス                 | 容量、VPU/GB、暗号化鍵、バックアップ、レプリケーション    |
| Boot Volume       | OSイメージを含み、インスタンスの起動に使用するボリューム               | 容量、性能、保持または削除、バックアップ                  |
| Volume Attachment | ボリュームとインスタンスをiSCSIまたはParavirtualizedで接続するリソース | アタッチメント方式、アクセス方式、デバイスパス、multipath |
| Volume Backup     | ボリュームから作成する復旧用コピー                                     | バックアップ方式、ポリシー、保持、リージョン間コピー      |
| Volume Replica    | 別のAvailability Domainまたはリージョンへ作成する非同期レプリカ        | レプリケーション先、RPO要件、アクティブ化、切替手順       |

- ボリュームへアクセスできるインスタンスは、原則として同じAvailability Domainに存在する必要がある
  - 別のAvailability Domainやリージョンで使用する場合は、バックアップからのリストアまたはレプリケーションを使用する
- すべてのBlock VolumeとBoot Volumeは保存時に暗号化される
  - Oracle管理鍵または[[cloud/oracle/vault/oci-vault|OCI Vault]]の顧客管理鍵を使用できる
- 読取り／書込み共有可能アタッチメントでは、複数インスタンスが同じボリューム性能を共有する
  - ファイルシステムやアプリケーションがクラスタ対応でなければ、同時書込みによってデータが破損する
- OCIが提供するのはブロックデバイスまでであり、Guest OSのパーティション、LVM、ファイルシステム、ASM、データベース、アプリケーションの性能と整合性は利用者が管理する

## 性能モデル

### VPU/GB

Doc: [ブロック・ボリューム・パフォーマンス](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/blockvolumeperformance.htm)

- VPU（Volume Performance Unit）は、ボリュームへ割り当てる性能リソースの単位
  - 課金メーターは、容量1 GB当たり1か月に設定するVPU数で表す
- `VPU/GB`を増やすと、IOPS/GB、KBPS/GB、ボリューム当たりの最大IOPSと最大スループットが増加する
- 課金はストレージ容量と性能に分かれる
  - 性能の課金量はボリューム容量と`VPU/GB`に比例するため、同じ`VPU/GB`でも大容量ボリュームほど性能料金が増える
  - VPUの単価は契約、通貨、Rate Cardで異なるため、設計時点の[OCI Price List](https://www.oracle.com/cloud/price-list/#pricing-storage)を確認する
- VPUは実際のI/O使用量を表さない
  - 実績値はOCI Monitoring、OS、データベース、`fio`などで別に測定する

次の値は2026-07-21時点の公式性能表に基づく。
Oracleの表記に合わせ、スループットはKBPSおよびMBPSで示す。

| 性能レベル             | VPU/GB | IOPS/GB | 最大IOPS／ボリューム | 最大IOPS到達サイズ | KBPS/GB | 最大MBPS／ボリューム |
| ---------------------- | -----: | ------: | -------------------: | -----------------: | ------: | -------------------: |
| Lower Cost             |      0 |       2 |                3,000 |           1,500 GB |     240 |                  480 |
| Balanced               |     10 |      60 |               25,000 |             417 GB |     480 |                  480 |
| Higher Performance     |     20 |      75 |               50,000 |             667 GB |     600 |                  680 |
| Ultra High Performance |     30 |      90 |               75,000 |             833 GB |     720 |                  880 |
| Ultra High Performance |     40 |     105 |              100,000 |             952 GB |     840 |                1,080 |
| Ultra High Performance |     50 |     120 |              125,000 |           1,042 GB |     960 |                1,280 |
| Ultra High Performance |     60 |     135 |              150,000 |           1,111 GB |   1,080 |                1,480 |
| Ultra High Performance |     70 |     150 |              175,000 |           1,167 GB |   1,200 |                1,680 |
| Ultra High Performance |     80 |     165 |              200,000 |           1,212 GB |   1,320 |                1,880 |
| Ultra High Performance |     90 |     180 |              225,000 |           1,250 GB |   1,440 |                2,080 |
| Ultra High Performance |    100 |     195 |              250,000 |           1,282 GB |   1,560 |                2,280 |
| Ultra High Performance |    110 |     210 |              275,000 |           1,310 GB |   1,680 |                2,480 |
| Ultra High Performance |    120 |     225 |              300,000 |           1,333 GB |   1,800 |                2,680 |

- 新しいBlock VolumeとBoot VolumeのデフォルトはBalanced
- Lower CostはBlock Volumeだけで選択でき、Boot Volumeの通常の性能レベルとしては選択できない
- Lower Costは大きなシーケンシャルI/Oを低コストで処理する用途、Balancedは一般用途、Higher PerformanceとUltra High Performanceは高いランダムI/O要件に向く
- Ultra High Performanceの最大値には、対応シェイプとmultipathなどの追加条件がある

### 容量と性能上限

10 VPU/GB以上では、単位性能とボリューム上限を次の式で求める。
Lower CostにはこのVPU式を適用せず、公式表の`2 IOPS/GB`と`240 KBPS/GB`を使用する。

```text
IOPS/GB = 1.5 × VPU/GB + 45
最大IOPS／ボリューム = 2,500 × VPU/GB

KBPS/GB = 12 × VPU/GB + 360
最大MBPS／ボリューム = 20 × VPU/GB + 280
```

容量から求めた値とボリューム上限の低い方が、ボリュームの仕様上限になる。

```text
ボリュームの仕様IOPS
  = min(容量 [GB] × IOPS/GB, 最大IOPS／ボリューム)

ボリュームの仕様スループット [MBPS]
  = min((容量 [GB] × KBPS/GB) ÷ 1,000, 最大MBPS／ボリューム)
```

> [!EXAMPLE] Balanced、500 GB
>
> - IOPSは`min(500 × 60, 25,000) = 25,000 IOPS`
> - 大きなI/Oでのスループットは`min((500 × 480 KBPS) ÷ 1,000, 480 MBPS) = 240 MB/s`
> - 8 KiB I/Oでは、`25,000 IOPS × 8 KiB ≒ 195 MiB/s`となり、公式サイズ別表では約200 MB/s
> - 同じボリュームでも、I/OサイズによってIOPS上限とスループット上限のどちらが先に効くかが変わる

ボリューム上限へ到達した後は、容量だけを増やしても性能は増えない。
必要容量、必要IOPS、必要スループット、月額性能料金を別々に計算する。

## 実効性能

### アタッチメントとCompute上限

Doc: [インスタンスへのブロック・ボリュームのアタッチ](https://docs.oracle.com/ja-jp/iaas/Content/Block/Tasks/attach-compute-volume-attachment.htm)

- iSCSIはGuest OSで接続を構成する必要があるが、Paravirtualizedより高いIOPSへ到達できる構成がある
- ParavirtualizedはVMで追加のiSCSI接続操作を必要としないが、アタッチメント固有の上限がある
- Computeシェイプごとに、インスタンス当たりの最大IOPS、最大Block Volumeスループット、アタッチメント数、Ultra High Performance対応可否が異なる
  - 複数ボリュームのIOPSとスループットは、インスタンス当たりの上限を共有する
  - VMのスループットは、利用可能なネットワーク帯域にも制約される
- 共有可能アタッチメントでは、ボリューム当たりの性能をすべてのアタッチ先で共有する
- 転送中暗号化、Guest OSのセキュリティ製品、ファイルシステム、暗号化、CPU、キュー深度が実効性能を下げる場合がある

```text
実効IOPS
  ≤ min(
       容量 × IOPS/GB,
       ボリューム当たりの最大IOPS,
       アタッチメントのIOPS上限,
       インスタンス当たりの合計IOPS上限,
       同時実行I/O数 ÷ 平均レイテンシ
     )

実効スループット
  ≤ min(
       容量 [GB] × KBPS/GB ÷ 1,000,
       ボリューム当たりの最大スループット,
       インスタンス当たりの合計スループット上限,
       利用可能なネットワーク帯域,
       実効IOPS × 平均I/Oサイズ
     )
```

シェイプ表は更新されるため、固定値を設計書へ転記するだけでなく、作成時点の[シェイプのパフォーマンスの詳細](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/blockvolumeperformance.htm#Performance_Details_for_Shapes)を確認する。

### Ultra High Performance

Doc: [超高パフォーマンス](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/blockvolumeultrahighperformance.htm)

Doc: [Ultra High Performance Volumeへのアタッチメントの構成](https://docs.oracle.com/ja-jp/iaas/Content/Block/Tasks/configuringmultipathattachments.htm)

Doc: [高パフォーマンス](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/blockvolumehigherperformance.htm)

- データ用Ultra High Performance Volumeの性能を引き出すには、対応OS、対応シェイプ、consistent device path、Block Volume Managementプラグインなどの条件を満たすmultipath対応アタッチメントが必要
  - Consoleの「Multipath」列またはAPIの`is-multipath`で、実際に有効になったことを確認する
  - Bare Metalではmultipath対応iSCSIを使用し、Paravirtualized multipathは使用できない
- 一般性能表の最大300,000 IOPSをすべてのアタッチメントで達成できるわけではない
  - ParavirtualizedでアタッチしたUltra High Performance Volumeは最大150,000 IOPS／ボリューム
  - VMのUltra High Performance Boot Volumeはmultipathを使用せず、最大50,000 IOPS
  - Boot Volumeで最大50,000 IOPSへ到達するには8 OCPU以上が必要
- 他の性能レベルからUltra High Performanceへ変更する場合は、multipathを有効にするためにデタッチと再アタッチが必要
  - device pathを設定せずにアタッチしたボリュームは、性能レベルだけを変更してもmultipathにならない
- LinuxでiSCSIアタッチメントをBalancedまたはLower CostからHigher Performanceへ変更する場合は、最大50,000 IOPSへ到達するために`node.session.queue_depth`を128へ変更する

## Performance SLA

Doc: [Oracle PaaS and IaaS Public Cloud Services Pillar Document](https://www.oracle.com/contracts/docs/paas_iaas_pub_cld_srvs_pillar_4021422.pdf?download=false)（June 2026、3.6.19）

> [!IMPORTANT] 最大性能の常時保証ではない
>
> Performance SLAは、条件を満たすraw環境で十分な4 KiB I/Oを提示したときに、単一Block Volumeが提供できるIOPSを月単位で評価する。アイドル状態やI/O発行量が少ない状態で実績IOPSが基準を下回っただけでは、SLA違反を意味しない。性能表の最大IOPSや最大スループットを常時達成する保証でもない。

```text
Block Volume Performance Decay Rate
  = 暦月中に単一ボリュームの4 KiB IOPSが公開最小IOPSの90%未満だった時間数
    ÷ 暦月の総時間数

Monthly Performance Rate
  = 100% - Block Volume Performance Decay Rate

Service Commitment
  = Oracleが商業的に合理的な努力により
    Monthly Performance Rate 99.9%以上を提供するコミットメント
```

### 適用条件

| 条件            | Performance SLAの要件                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| 性能レベル      | Balanced、Higher Performance、Ultra High Performance                                         |
| ボリューム      | rawかつ未フォーマット                                                                        |
| iSCSI           | iSCSI Volume Attachment                                                                      |
| Paravirtualized | Balanced／Higher Performanceは8 core以上のVM、Ultra High Performanceは16 core以上のVM        |
| 測定            | 単一ボリュームの4 KiB IOPS                                                                   |
| 除外時間        | バックアップまたはスナップショットの実行中、Pillar DocumentのCommon Exclusionsに該当する時間 |

- Lower CostはPerformance SLAの対象外
- `8 core`と`16 core`はPillar Documentの契約表記であり、OCIシェイプのOCPU数へ独自に換算せず、対象シェイプと契約条件を確認する
- Pillar Documentの算式が直接対象とするのはIOPS
  - スループット、平均またはP99レイテンシ、ファイルシステム、ASM、データベース、アプリケーション応答時間は算式の対象ではない
- Computeシェイプ、ネットワーク、アタッチメント、Guest OS、セキュリティ製品、顧客設定による制約をBlock Volumeサービス層の性能低下と混同しない
- 契約判断では、利用契約、注文書、最新版Pillar Documentを優先する

### Service Credit

| Monthly Performance Rate | Service Credit Percentage |
| ------------------------ | ------------------------: |
| 99.0%以上99.9%未満       |                       10% |
| 95.0%以上99.0%未満       |                       25% |
| 95.0%未満                |                      100% |

- Service Creditはクラウド利用料全体ではなく、該当月に実際に使用したNon-Compliant Serviceの正味料金を基礎に計算する
- 自動付与ではなく、原因となった事象から60暦日以内にAccount Managerへ申請する
  - サービス名、発生時刻と期間、リージョン、対象OCID、解決を試みた内容、監査ログやOSログなどが必要になる
- 同じ事象がAvailability SLAとPerformance SLAの両方に該当しても重複してCreditを受け取れず、最も高いCreditだけが適用される

### 可用性と耐久性

Performance SLAと、可用性およびデータ耐久性は別の指標である。

| 区分              | 対象                 | 2026-07-21時点の位置付け           |
| ----------------- | -------------------- | ---------------------------------- |
| Performance SLA   | 4 KiB IOPS           | Monthly Performance Rate 99.9%以上 |
| Availability SLA  | I/Oを実行できること  | 月間99.99%                         |
| Manageability SLA | 制御プレーンAPI      | 月間99.9%                          |
| Durability SLO    | データを失わないこと | 年間99.99%を提供するように設計     |

- Availability SLAのUnavailableは、pending I/Oがキューにある状態で、対象サービスのアタッチ済みボリュームすべてが読取り／書込みI/Oを実行しなかった時間に基づく
- Manageability SLAは、Availability Domain単位の制御プレーンAPIエラー率を5分間隔で評価する
- Durability SLOはAvailability SLAと同じ意味ではなく、Pillar DocumentのPerformance SLAに対するService Creditとも別
- Pillar DocumentのBlock Volume条項にDurability SLAのService Creditはなく、SLO未達に対する金銭的補償はない
- サービス内の複製は、バックアップやAvailability Domain障害への対策を不要にしない

## 監視と測定

### OCI Monitoring

Doc: [ブロック・ボリューム・メトリックのリファレンス](https://docs.oracle.com/ja-jp/iaas/Content/Block/References/volumemetrics-reference.htm)

| メトリック                                      | 種類           | 単位          | 表すもの                                 |
| ----------------------------------------------- | -------------- | ------------- | ---------------------------------------- |
| `VolumeReadOps`、`VolumeWriteOps`               | 実績カウンタ   | reads、writes | 測定間隔内の読取り回数と書込み回数       |
| `VolumeReadThroughput`、`VolumeWriteThroughput` | 実績カウンタ   | bytes         | 測定間隔内の読取りbyte数と書込みbyte数   |
| `VolumeThrottledIOs`                            | 制約の兆候     | sum           | 測定期間内にスロットリングされたI/O数    |
| `VolumeGuaranteedVPUsPerGB`                     | サービス基準値 | VPUs          | 測定期間中にアクティブだったVPU/GBの平均 |
| `VolumeGuaranteedIOPS`                          | サービス基準値 | IOPS          | 測定期間中の保証IOPSの平均               |
| `VolumeGuaranteedThroughput`                    | サービス基準値 | megabytes     | 測定間隔当たりの保証スループット         |

- `VolumeReadOps`、`VolumeWriteOps`、実績スループットは間隔当たりの値
  - 秒当たりの実績へ比較するときは、同じ間隔で`rate()`を使用する
- `VolumeGuaranteedVPUsPerGB`と`VolumeGuaranteedIOPS`は区間平均であり、`rate()`変換しない
- `VolumeGuaranteedThroughput`は測定間隔当たりのMB数であり、MB/sとして比較する場合は`rate()`で秒当たりへ変換する
- `VolumeGuaranteedThroughput`という名称はサービス側の性能基準値を表す
  - June 2026 Pillar DocumentのService Credit算式は4 KiB IOPSだけを対象とするため、メトリック名からスループットの金銭的補償を推論しない
- `VolumeThrottledIOs`が増え、実績値が現在の保証値へ達している場合は、ボリュームのVPU/GBまたは容量上限を確認する
- スロットリングがなく、複数ボリュームの合計値が一定なら、Computeシェイプ、ネットワーク、アタッチメントの合計上限を確認する
- `oci_blockstore`には実測レイテンシの直接的なメトリックがない
  - OS、`fio`、Oracle Databaseの待機イベント、アプリケーション応答時間を同じ時間帯で確認する
- `oci_computeagent`のBlock Volume関連メトリックは、インスタンス側でアタッチ済みボリューム全体を集計するため、ボリューム単位の`oci_blockstore`と測定範囲を区別する

### fio

Doc: [Linuxベース・インスタンスでのBlock VolumeのFIOサンプル](https://docs.oracle.com/ja-jp/iaas/Content/Block/References/samplefiocommandslinux.htm)

| 測定目的                 | Oracleの代表的なサンプル条件       | 主に確認する値                      |
| ------------------------ | ---------------------------------- | ----------------------------------- |
| 最大IOPS                 | 4 KiB、`iodepth=256`、`numjobs=4`  | IOPS、スロットリング、P99レイテンシ |
| 最大スループット         | 256 KiB、`iodepth=64`、`numjobs=4` | MB/s、IOPS、CPU、ネットワーク       |
| 低キュー深度のレイテンシ | 4 KiB、`iodepth=1`、`numjobs=1`    | 平均、P50、P99レイテンシ            |

- 仕様上限の検証と、本番ワークロードを模した検証を分ける
  - 最大IOPS用の深いキューは、実運用の同期I/Oや応答時間を代表しない
- rawかつ未フォーマットのボリュームによる測定はSLA条件へ近いが、ファイルシステム、ASM、データベースを含むエンドツーエンド性能を表さない
- POCでは、ボリュームサイズ、VPU/GB、シェイプ、OCPU、アタッチメント、I/Oサイズ、読取り／書込み比率、キュー深度を記録する
- 書込みテストは対象データを上書きするため、破棄可能な専用テスト用ボリュームだけで行う

測定条件の設計、`fio`出力、レイテンシ分布の読み方は、[[cloud/oracle/database/performance/storage-performance#fioによる測定|fioによる測定]]を参照。

## 性能変更と自動チューニング

Doc: [ボリュームのパフォーマンスの変更](https://docs.oracle.com/ja-jp/iaas/Content/Block/Tasks/changingvolumeperformance.htm)

Doc: [動的パフォーマンス・スケーリング](https://docs.oracle.com/ja-jp/iaas/Content/Block/Tasks/create-autotunepolicies-bv-volume.htm)

- VPU/GBはボリュームを再作成せずに変更できる
  - 変更中はLifecycle Stateが`PROVISIONING`となり、新しいアタッチメントや他のボリューム操作を実行できない
  - 同じテナンシで同時に性能を変更できるボリュームは3個
  - Ultra High Performanceへ変更する場合は、アタッチメントをmultipath対応にするためのデタッチと再アタッチを計画する
  - 性能変更後は、Guest OSのキュー、multipath、Computeシェイプ上限を再確認する
- Performance Based Auto-tuneは、設定したDefault VPU/GBとMaximum VPU/GBの間で性能を調整する
  - `VolumeThrottledIOs`、保証VPU/GB、保証IOPS、保証スループットを基に判断する
  - 負荷上昇時の引上げは数十秒単位のベストエフォートであり、瞬間的な負荷へ先回りする保証ではない
  - 負荷低下後の最初の引下げは約1時間後に行われ、その後は数分単位で調整される
- Detached Volume Auto-tuneは、デタッチから14日後にLower Cost相当の0 VPU/GBへの調整を開始し、再アタッチ時にDefault VPU/GBへ戻す
  - Performance Based Auto-tuneも有効なら、再アタッチ後に負荷に応じた調整を再開する
  - Ultra High Performanceへ戻る場合は、再アタッチ後もmultipathが有効か確認する

## データ保護

Doc: [ブロック・ボリュームの耐久性](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/overview.htm#Block_Volume_Durability)

Doc: [ブロック・ボリューム・バックアップ](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/blockvolumebackups.htm)

Doc: [ブロック・ボリューム・レプリケーション](https://docs.oracle.com/ja-jp/iaas/Content/Block/Concepts/volumereplication.htm)

- データは複数のストレージサーバーへ冗長に格納され、組込みの修復機構によって保護される
- サービス内の複製と修復は、バックアップによる過去時点への復旧やAvailability Domain障害への対策ではない
- Volume Backupは、ボリュームから独立した復旧用コピーを作成する
  - 同じリージョンの別Availability Domainへリストアでき、バックアップを別リージョンへコピーできる
- Volume Replicationは、別のAvailability Domainまたはリージョンへ継続的に非同期レプリケーションする
  - 災害対策や移行に使用するが、論理破損や誤削除から過去時点へ戻すバックアップの代替にはならない

## 他サービスとの関係

- Compute上で自己管理するデータベースやアプリケーションでは、利用者がBlock Volumeの容量、VPU/GB、アタッチメント、シェイプを直接設計する
- [[cloud/oracle/database/services/oci-base-database-service|OCI Base Database Service]]は基盤でBlock Volumeを使用するが、ストレージ構成はDB Systemのサービス機能を通して管理する
  - 汎用Block Volumeを直接操作する手順ではなく、Base Database Service固有の容量、性能、スケール条件を優先する
- OKEのPersistent Volumeなど、上位サービスから作成されるBlock Volumeでは、上位サービスのStorageClass、CSI、更新制約も確認する

## 関連メモ

- [[cloud/oracle/database/performance/storage-performance|ストレージ性能のIOPS、スループット、レイテンシ]]
- [[cloud/oracle/database/services/oci-base-database-service|OCI Base Database Service]]
