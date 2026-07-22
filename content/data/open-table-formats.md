---
title: オープンテーブルフォーマット
date: 2026-07-22
modified: 2026-07-22
draft: false
tags:
  - data/platform
  - data/lakehouse
aliases: []
description: オブジェクトストレージ上のファイル群をテーブルとして管理する形式と、Apache Iceberg、Delta Lake、Apache Hudi、Apache Paimonの選択軸を整理する。
---

← [[data/index|データ基盤の構成要素]]

## 概要

- オープンテーブルフォーマットは、共有ストレージ上の複数ファイルを1つの論理テーブルとして扱うための公開仕様と実装
- ファイル形式の上に、次の状態と規則を加える
  - 現在のテーブルに属するファイル集合
  - スキーマ、パーティション、ソート順、列統計
  - 更新を一括して公開するコミット
  - 過去のテーブル状態と行の削除表現
- 実行エンジン、ストレージ、カタログ、ガバナンスを置き換える製品ではない
- 代表的な形式は、Apache Iceberg、Delta Lake、Apache Hudi、Apache Paimon
  - 同じ機能名でも形式バージョンと実行エンジンにより対応範囲が異なるため、単純な機能数では選ばない

## ファイル形式との境界

Doc: [Apache Parquet documentation](https://parquet.apache.org/docs/)

| 対象             | ファイル形式                                    | テーブル形式                                                                   |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| 管理単位         | 1ファイル                                       | 複数のデータファイルとメタデータ                                               |
| 主な情報         | 値の符号化、列、圧縮、row group、ファイル内統計 | スキーマ、ファイル所属、スナップショット、追加、削除、パーティション、コミット |
| 代表例           | Parquet、ORC、Avro                              | Iceberg、Delta Lake、Hudi、Paimon                                              |
| 答えられる問い   | このファイルの列と値をどう読むか                | 現在のテーブルを構成するファイルはどれか                                       |
| 答えられない問い | 他ファイルとの一貫した状態                      | SQLをどの計算資源で実行するか                                                  |

Parquetファイルを直接列挙すると、削除済みだが履歴保持中のファイルや、失敗した書き込みが残した未参照ファイルまで読み得る。
テーブル形式を使う読み手は、ストレージの全ファイルではなく、コミット済みメタデータから到達できるファイルだけを読む。

## 必要になった理由

- [[data/apache-hive|従来型の非transactional native Hive table]]は、テーブルやパーティションをディレクトリへ対応づけ、各ディレクトリ内のファイルをデータとして扱う
- HDFSは大容量ファイル、追記、原子的なrenameを前提にした処理と相性がよかった
- 一般的なflat-namespace object storageでは、ディレクトリは名前のprefixであり、filesystemと同じatomic renameを持たない
  - Amazon S3のgeneral purpose bucketなどでは、renameをcopyとdeleteで模倣するため、表全体の公開境界として使いにくい
  - [ADLSのhierarchical namespace](https://learn.microsoft.com/en-us/azure/storage/blobs/data-lake-storage-namespace)と[Google Cloud Storageのhierarchical namespace](https://docs.cloud.google.com/storage/docs/hns-overview)はatomicなdirectory／folder renameを提供する
  - [S3 Express One Zoneのdirectory bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/directory-buckets-objects-rename.html)は`RenameObject`を提供する
  - 例外ごとにscopeと制約が異なるため、「object storageでは常にcopyとdelete」と一般化しない
- 複数の実行エンジンが同じファイルへ書き込むと、各エンジンが独自の更新手順を使うだけでは次の状態を共有できない
  - 更新前か更新後か
  - 競合した2つの書き込みのどちらが有効か
  - 削除されたファイルと失敗して未参照になったファイルの違い
  - 過去の集計が参照したテーブル状態
- テーブル形式は、データファイルを書いてから新しい状態をコミットし、書き込みと公開を分離する

## 共通する機構

### 不変ファイルとMVCC

- Parquetなどの分析用ファイルは、既存行をその場で更新せず、新しいファイルへ書き直すことが多い
- テーブル形式は、新旧ファイルを保持し、どの版が各ファイルを参照するかで状態を切り替える
- 読み手は開始時に選んだ版を読み続けるため、同時書き込みの途中状態を避けられる
- 古いファイルは、保持中の版から参照されなくなった後に削除できる

### Copy-on-writeとmerge-on-read

| 方式          | 更新方法                                                 | 読み取り                                 | 主な負担                               |
| ------------- | -------------------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| Copy-on-write | 変更対象行を含むデータファイルを新しいファイルへ書き直す | 新しいデータファイルだけを読む           | 更新時の書込量とrewrite競合            |
| Merge-on-read | 元のデータファイルに削除や差分の表現を重ねる             | 読取時またはcompaction時に差分を統合する | 読取時のmerge、delete file、compaction |

形式が両方式を表現できても、対象エンジンが同じ削除方式を読み書きできるとは限らない。
更新頻度だけでなく、読取遅延、書込増幅、compactionの計算費、競合範囲から選ぶ。

### Metadata pruning

- パーティション値と列統計をメタデータへ記録し、不要なファイルを開く前に除外する
- データファイル数が増えても、ストレージ全体を毎回LISTして対象を探さない
- 列統計は索引と同じではなく、範囲外と証明できるファイルを除外するための要約
  - データ配置とクエリ条件が合わなければ、多数のファイルを読む

### Schemaとpartitionの進化

- 多くのテーブル形式は、スキーマと物理配置の変更履歴をmetadataまたはtransaction logで管理する
- 進化規則、互換性判定、metadata-onlyで変更できる範囲は形式ごとに異なる
- Icebergはschema IDとpartition spec IDを保持し、新旧の定義を同じtable内で扱う
- スキーマ変更やpartition定義の変更がmetadata-onlyでも、既存ファイルの物理配置や値は自動的に書き換わらない
- 古いファイルを新しい配置へ揃える場合は、別途rewriteが必要

## 形式の比較

Doc: [Apache Iceberg specification](https://iceberg.apache.org/spec/)

Doc: [Delta Transaction Log Protocol](https://github.com/delta-io/delta/blob/master/PROTOCOL.md)

Doc: [Apache Hudi Technical Specification](https://hudi.apache.org/learn/tech-specs/)

Doc: [Apache Paimon concepts](https://paimon.apache.org/docs/master/concepts/)

| 形式           | 状態管理の中心                                                             | 設計の中心                                                                         | 選定時の確認                                                                |
| -------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Apache Iceberg | catalogからtable metadata、snapshot、manifest list、manifestへたどる参照木 | 巨大な分析テーブル、複数エンジン、hidden partitioning、schema／partition evolution | catalogのコミット方式、spec version、engineごとのrow-level operation        |
| Delta Lake     | テーブル配下の連番transaction logとcheckpoint                              | Spark／Databricksを起点とするbatchとstreamingの統合、transaction logからの増分処理 | storageのcommit要件、Delta protocol feature、非Spark engineの読取／書込範囲 |
| Apache Hudi    | timeline、file group、base file、log file、index、table service            | CDC、upsert、incremental query、Copy-on-Write／Merge-on-Readの運用                 | record key、index、compaction／clustering、query type、engine integration   |
| Apache Paimon  | snapshot、manifest、data file、primary-key tableのLSM構造                  | Flinkを起点とするstreaming update、CDC、batch／stream統合                          | primary keyとbucket、changelog、compaction、他エンジンの書込対応            |

この表は優劣ではなく設計の中心を示す。
各形式は機能を追加し続けているため、採用時は対象バージョンの仕様とコネクタの互換表を確認する。

## カタログとの関係

Doc: [Apache Iceberg REST Catalog specification](https://iceberg.apache.org/rest-catalog-spec/)

- テーブル形式は1テーブルの内部状態を定義し、カタログはテーブル名を現在のメタデータへ解決する
- カタログは、テーブルの作成、削除、rename、名前空間、コミット調整を担う場合がある
- Icebergでは、Hive Metastore、JDBC、AWS Glue、Nessie、REST Catalogなどを選べる
  - Apache PolarisはIceberg REST Catalog protocolのオープンソース実装
- Delta Lakeは従来、テーブル配下のtransaction logだけでも状態を復元できる設計を取る
  - 現行仕様にはcatalog-managed commitもあるため、利用するprotocol featureとcatalogを確認する
- ガバナンス製品は、table catalogの責任に加えて、RBAC、credential vending、リネージ、監査、用語集を提供する場合がある

「テーブル形式がオープン」であることと、「どの認証主体でもデータファイルへ直接アクセスできる」ことは別である。
カタログ経由の権限と、ストレージのIAM、暗号鍵、実行エンジンの権限を同じテーブル境界に合わせる。

## 選択軸

### 実行エンジン

- 主ライターを先に決め、そのエンジンで形式の主要機能とメンテナンス操作が安定しているか確認する
- 追加のエンジンごとに次を確認する
  - readとwrite
  - DDL、append、overwrite、`UPDATE`、`DELETE`、`MERGE`
  - format versionとtable feature
  - position delete、equality delete、deletion vector
  - timestamp、decimal、nested typeのmapping
  - branch、tag、time travel
  - catalog、認証、credential vending

### 更新特性

- 追記中心か、CDCによるupsertとdeleteが多いか
- 1回の更新が触るファイル数とpartition数
- 書込遅延と読取遅延のどちらを優先するか
- 変更を下流へ増分配信する必要があるか
- 複数ライターの競合をどの単位で検出するか

### 運用

- small file compaction
- manifestまたはtransaction logの再編
- snapshot、tombstone、履歴の保持期間
- orphan fileの検出と削除
- 統計、clustering、sort orderの更新
- 障害復旧、監視、費用帰属

マネージドサービスが自動化する範囲と、形式そのものの機能を分ける。
自動compactionやgarbage collectionが製品にあっても、外部ライターとの所有権が曖昧な場所では相手のファイルを削除し得る。

### 移植性

- データファイルを読めるだけでなく、現在のテーブル状態と削除を正しく解釈できるか
- カタログAPI、SQL方言、認可、共有、監査、メンテナンスを移行先で置き換えられるか
- 独自table featureを有効にした後も、古いreaderが安全に拒否できるか
- 外部ストレージへの直接アクセスとdata egressが許可されるか

## 提供しないもの

- 業務システム向けの低遅延な行単位OLTP
- 任意の複数テーブルを必ず1トランザクションで更新する機能
  - catalogやengineが追加機能として提供する場合はある
- データ品質、業務用語、所有者、個人情報分類の自動決定
- バックアップ、別障害ドメインへの複製、ランサムウェア対策
- どのクエリにも最適なファイル配置
- すべてのエンジン間で同一のSQLと同一の書込機能

## 関連メモ

- [[data/index|データ基盤の構成要素]]
- [[data/apache-hive|Apache Hive]]
- [[data/apache-iceberg|Apache Iceberg]]
- [[cloud/oracle/ai/oracle-ai-data-platform|Oracle AI Data Platform]]

## 参考資料

- [“まるっとわかる” Open Table Format（Apache Iceberg）](https://qiita.com/yushibats/items/cf774e9c4ac3d6036622)
- [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/)
- [Delta Lake documentation](https://docs.delta.io/)
- [Apache Hudi 1.2.0 documentation](https://hudi.apache.org/docs/overview/)
- [Apache Paimon 1.4 documentation](https://paimon.apache.org/docs/1.4/concepts/overview/)
