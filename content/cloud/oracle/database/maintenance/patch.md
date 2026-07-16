---
title: Oracle Database パッチ種別
date: 2026-06-18
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/database/patch
description: Oracle Database の CPU、CSPU、RU、MRP、個別パッチとコンポーネント別パッチの関係を整理する。
---

## 概要

- CPU、CSPU、Security Alert は、影響を受ける脆弱性と製品を判断するためのセキュリティ公開枠
- RU、MRP、one-off、コンポーネント別パッチは、製品、バージョン、プラットフォーム、構成に応じて選ぶ実際の適用物
- Oracle Database と Grid Infrastructure の通常保守では最新 RU を基準にし、対象 RU の MRP、個別パッチ、OJVM、Client、ORDS、タイムゾーンを追加確認する
- Oracle Home のバイナリへパッチを適用した状態と、`datapatch`が Database へ SQL 変更を反映した状態は別々に確認する
- このメモは Oracle Database 19c／Oracle AI Database 26ai を中心に扱う
  - 公開日と対象製品は変わるため、Oracle Security Alerts、Patch Availability Document、My Oracle Support（MOS）、各パッチの README を実施時点の正とする

Doc: [Critical Patch Updates, Critical Security Patch Updates, Security Alerts and Bulletins](https://www.oracle.com/security-alerts/)

Doc: [Software Security Recommendations](https://docs.oracle.com/en/database/oracle/oracle-database/26/haovw/software-security-recommendations.html)

## 公開情報と適用物

### セキュリティ公開枠

| 用語 | 公開タイミング | 役割 |
| --- | --- | --- |
| CPU（Critical Patch Update） | 1月、4月、7月、10月の第3火曜日 | 複数製品と複数脆弱性に対する四半期の累積的なセキュリティ更新 |
| CSPU（Critical Security Patch Update） | CPU月以外の第3火曜日 | 次の CPU を待たずに提供する、対象を絞った高優先度セキュリティ更新 |
| Security Alert | 定期日外 | 次の CPU／CSPUを待てない重大な脆弱性への臨時対応 |

### Database へ適用するパッチ

| 用語 | 性質 | 主な用途 |
| --- | --- | --- |
| RU（Release Update） | 四半期、累積、プロアクティブ | Database／GIの標準保守ベースライン |
| MRP（Monthly Recommended Patch） | 特定 RU 向け、月次、累積、任意 | RU間の推奨修正と、該当する月次セキュリティ修正 |
| Interim／one-off patch | 個別、リアクティブ | 特定の不具合、SR、緊急修正 |
| OJVM／GI／Client／TZ patch | コンポーネント別 | Database RU だけでは完結しない対象の更新 |
| Combo／Full Stack patch | パッケージ形態 | 複数の既存パッチを一括配布 |

CPU／CSPUの Advisory と RU／MRPは同じ分類ではない。

Advisory の Affected Products と Risk Matrix で影響を判断し、Patch Availability Document から対象製品、バージョン、プラットフォームへ実際に適用するパッチを特定する。

## 適用対象の決定

1. 毎月 Oracle Security Alerts を確認し、CPU、CSPU、Security Alert の新着を確認する
2. Affected Products、Risk Matrix、Patch Availability Document で製品、バージョン、構成への影響を判断する
3. Database、GI、OJVM、Client、ORDS、GoldenGate、OEM、JDK／JREなど、すべての配置場所を棚卸しする
4. Database／GIは最新 RU をベースラインにする
5. Linux x86-64では、対象 RU 向けの最新 MRP と、該当する CSPU の内容が含まれるかを確認する
6. OJVM、Client、ORDS、DST など、RU／MRPとは別の対象を確認する
7. 特定不具合が残る場合にだけ one-off／merge patch を追加する
8. Base Database Service、single instance、RAC、Data Guard などの構成に合う適用手段を選ぶ

## セキュリティ公開枠の判定

### CPU

- CPU は、サポート対象の Oracle オンプレミス製品向けに、複数のセキュリティ修正をまとめて公開する
- 通常は累積的で、1月、4月、7月、10月の第3火曜日に公開される
- Oracle Database だけでなく、GI、Client、OJVM、ORDS、Fusion Middleware、Java などを横断して確認する
- CPU Advisory の Risk Matrix は、その Advisory で新たに対処された脆弱性を示す
  - 過去の Advisory が不要になるわけではない
- 四半期 CPU は、それ以前に公開された CSPU の修正を含む累積的な更新になる

「CPUパッチ」という1つの共通バイナリを全製品へ適用するわけではない。

Oracle Database では通常、CPU公開に対応する最新 RU を保守の中心にし、OJVM、GI、Client、ORDS などの個別対象を追加確認する。

### CSPU

CSPU は2026年に開始された、対象を絞った高優先度セキュリティ更新。

- 初回は例外的に2026年5月28日に公開された
- 以降は2月、3月、5月、6月、8月、9月、11月、12月の第3火曜日に公開される
- すべての製品または Database release に毎月パッチが提供されるわけではない
- 影響製品一覧にない製品も、未適用の過去 CPU／CSPUがないか確認する
- Database／GIの Linux x86-64では、CSPUの内容は、利用可能かつ該当する場合に MRP で提供される
- Client、ORDS、関連製品は、各月の Patch Availability Document で提供形態を確認する

Doc: [Oracle Critical Security Patch Update Advisory - May 2026](https://www.oracle.com/security-alerts/cspumay2026.html)

Doc: [Oracle Critical Security Patch Update Advisory - June 2026](https://www.oracle.com/security-alerts/cspujun2026.html)

2026年7月1日時点では、2026年5月CSPUは Oracle Database Server `23.4.0-23.26.2`と ORDS `24.2.0-26.1.0`を対象にした。

Database Server の3件は23.xの Database、Grid、Client の各 Oracle Home に適用が必要で、client-only installation も該当した。

公式注記では、これらの問題に19c以前は影響されないとされている。

一方、2026年6月CSPUの対象製品一覧に Oracle Database Server は含まれていない。

月だけを見て Database へ機械的にパッチを適用せず、Affected Products と Risk Matrix を毎月確認する。

### Security Alert

- Security Alert は、次の CPU または CSPU まで待てないと Oracle が判断した脆弱性に対して不定期に公開される
- 公開された場合は、通常の月次、四半期サイクルより先に影響を確認する
- 対象製品、対象バージョン、回避策、Patch Availability Document、後続 CPU／CSPUへの取り込みを確認する
- 回避策は恒久修正ではなく、機能を壊す可能性もあるため、パッチ適用までの一時対策として扱う

## Database のパッチベースライン

Doc: [Oracle Database Patch Maintenance - 19c and later](https://docs.oracle.com/en/database/oracle/oracle-database/19/dbptc/index.html)

Doc: [Oracle AI Database Patch Maintenance Guidelines - 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/dbptc/index.html)

| 観点 | RU | MRP |
| --- | --- | --- |
| 基準 | 独立した四半期ベースライン | 特定 RU への追加 |
| 頻度 | 四半期 | 月次、最大6個 |
| 必須性 | 標準保守の中心 | 任意。ただし、該当 CSPU や重要修正があれば優先判断する |
| プラットフォーム | サポート対象プラットフォーム | Linux x86-64 |
| 主な内容 | Security、回帰、機能、Optimizer など | 推奨 one-off、回帰修正、該当する高優先度セキュリティ修正 |
| バージョン表記 | RU番号が変わる | RU番号は変わらない |

### Release Update

- RU は Oracle Database パッチ運用の標準ベースライン
- 1月、4月、7月、10月の第3火曜日に公開される累積パッチ
- security、regression、optimizer、functional fixesを含み、機能拡張を含む場合もある
- 対応するすべてのサポート対象プラットフォーム向けに提供される
- Oracle は、適用頻度にかかわらず作業時点の最新 RU を適用することを推奨している
- Optimizer の実行計画へ影響する一部の修正は、インストールされてもデフォルトで無効な場合がある

`N-1`に留まることを標準にしない。

RUを遅延させる場合は、新しい RU の既知問題を待つ利点と、その間に既知の不具合と脆弱性を保持するリスクを記録する。

### Monthly Recommended Patch

- MRP は、特定の RU に対して提供される推奨 interim patch の集合
- Oracle Database 19cでは RU 19.17から開始され、26aiにも提供される
- Linux x86-64専用であり、その他のプラットフォームでは推奨 one-off を個別に確認する
- 各 RU に対して最大6個、RU公開後の期間に月次で提供される
- 前の MRP を含む累積バンドルだが、別の RU をまたいで累積するわけではない
- MRP を適用しても Database の RU番号は変わらず、Oracle Inventory に one-off として記録される
- その月に新しい推奨修正がなければ、MRP が公開されない場合がある
- 26aiでは out-of-place 適用が推奨される
  - in-place では README に従い、`opatchauto`または`opatch napply`などを使う
  - GI MRP は system patch のため、`opatch napply`では適用できない

### Interim patch

- Interim patch または one-off patch は、特定の不具合、バージョン、プラットフォームの組み合わせに対して提供される
- SR対応や、次の RU／MRPを待てない既知不具合へのリアクティブ保守に使う
- RU より限定的なテストで提供され、後続 RU へ取り込まれる場合がある
- 最新 RU に修正が含まれる場合は、独自 one-off を増やさず RU 適用を優先する
- 適用前に競合を確認し、後続 RU／MRP向けの merge patch または置換パッチが必要か確認する
- 適用理由、Bug ID、SR番号、対象 Oracle Home、README、rollback 手順を記録する

競合確認には対象パッチディレクトリを指定する。

```bash
$ORACLE_HOME/OPatch/opatch prereq CheckConflictAgainstOHWithDetail -ph <PATCH_DIR>
```

複数パッチをまとめて確認する場合は、パッチの README に従って`-phBaseDir`を使う。

## コンポーネントと配布形態

| 対象 | Database RU と分けて確認する理由 | 主な確認 |
| --- | --- | --- |
| OJVM | Database 内の`JAVAVM`へ SQL 変更を含むパッチを適用する | `JAVAVM`の導入状態、OPatch、`datapatch` |
| GI | RAC、ASM、Clusterware、Oracle Restart の Home を更新する | parallel GI RU、全ノード、全 Home、rolling 可否 |
| Client | 接続元のライブラリを別の Oracle Home または配布物として更新する | アプリケーション、バッチ、BI、ETL、監視、コンテナ |
| Combo／Full Stack | 複数の既存パッチを1つの配布物にまとめる | Home ごとの適用順、停止、`datapatch`、rollback 単位 |
| Time Zone／DST | タイムゾーン規則と Database 内の timezone file version を扱う | `$ORACLE_HOME/oracore/zoneinfo`、`DBMS_DST`、データ変換 |

### OJVM

- `JAVAVM`がインストールされている環境では、利用していない場合も適用要否を確認する
- Base Database Service では、公式ドキュメント上、OJVM update は OPatch による手動適用が必要

```sql
select comp_id, comp_name, version_full, status
from   dba_registry
where  comp_id = 'JAVAVM';
```

### Grid Infrastructure

- Database RU と同じ四半期の parallel GI RU を使う
- GI RU は system patch として対応する Database RU の内容も含むが、適用ツールと README に従い、各 Oracle Home への反映を個別に確認する
- `opatchauto`、Fleet Patching and Provisioning、rolling／non-rolling、ノード順序、停止要否は README と構成によって変わる
- Database Home だけでなく、GI Home と全ノードの Inventory を確認する

### Client

- Oracle Client、Instant Client、JDBC、ODP.NET を配置している接続元を棚卸しする
- Risk Matrix の`client-only installations`と注記を確認する
- 2026年5月CSPUの Database Server 向け3件は、23.xの Client Home も対象だった

### Combo と Full Stack

- 新しい修正カテゴリではなく、Database RU、OJVM、GI、Exadata System Software などをまとめた配布形態
- Database RU と OJVM RU の Combo Patch、Exadata 向け Quarterly Full Stack Download Patch などがある
- 一括ダウンロードでも、各 Oracle Home への適用順、rolling 可否、`datapatch`、rollback 単位を個別に確認する

### Time Zone と DST

Doc: [Release Update 19.18 - All Time Zone Files Included](https://docs.oracle.com/en/database/oracle/oracle-database/19/newft/ru-19-18.html)

- 最新のタイムゾーン規則が必要な環境向けに、special time zone patch が提供される場合がある
- Oracle Database 19c RU 19.18以降では、利用可能な DST file が RU によって`$ORACLE_HOME/oracore/zoneinfo`へインストールされる
- RU の適用だけで、既存 Database の timezone file version または`TIMESTAMP WITH TIME ZONE`データが自動変換されるとは限らない
- Database 側の version 変更には`DBMS_DST`などの別手順が必要になる
- Data Pump、Transportable Tablespaces、クライアントとの version 差も確認する

## OCI Base Database Service の責任境界

Doc: [Update a Database - Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/update-db/index.html)

Doc: [Software Images - Base Database Service](https://docs.oracle.com/en/cloud/paas/base-database/software-images/)

Oracle Security Alerts は CPU／CSPUをサポート対象のオンプレミス製品向けと定義している。

Oracle Cloud の運用チームも該当修正を評価して適用するが、Base Database Service の公式ドキュメントでは、利用者が Database を適時更新する責任を持つ。

マネージドサービスであっても、Database RU まで常に自動適用されるわけではない。

- OCI コンソール／APIの標準更新では、直近4世代（N〜N-3）の Database update を選択できる
- Oracle は DB システムを先に更新し、その後 Database を更新することを推奨している
- 適用前に OCI の`Precheck`を実行し、バックアップとテスト環境で検証する
- 既存 interim patch は、Oracle 提供 update の前に自動 rollback される場合がある
  - 新しい RU に含まれない場合は再適用が必要になる
  - interim patch を含む custom Database Software Image を検討する
- OJVM update は OPatch による手動適用が必要
- 公開ドキュメントの標準 Update 一覧は四半期 RU が中心
  - Database CSPU／MRPが該当する場合は、Patch Availability Document、MOS、Base Database Service の手順で提供方法と適用方法を確認する

更新作業全体の流れは[[cloud/oracle/database/maintenance/oci-oracledb-update|OCI における Oracle Database のアップデート／アップグレード]]、事前バックアップは[[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ]]を参照する。

## 適用結果の確認

### Oracle Home のバイナリ

```bash
$ORACLE_HOME/OPatch/opatch lsinventory
$ORACLE_HOME/OPatch/opatch lspatches
$GRID_HOME/OPatch/opatch lsinventory
```

`opatch lsinventory`は Oracle Home のバイナリ状態を確認する。

RACでは全ノード、複数 Home がある場合は Home ごとに確認する。

### Database の SQL patch

Doc: [`DBA_REGISTRY_SQLPATCH`](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/DBA_REGISTRY_SQLPATCH.html)

SQL script を含むパッチでは、OPatch 完了後に`datapatch`が必要になる。

README またはサービスの自動化が実行するかを確認し、CDBでは対象 PDB が開かれて処理されたことを確認する。

```sql
select install_id,
       patch_id,
       patch_type,
       action,
       status,
       action_time,
       description,
       logfile
from   dba_registry_sqlpatch
order  by action_time desc;
```

CDB全体では、PDBごとの反映状態を確認する。

```sql
select con_id,
       install_id,
       patch_id,
       patch_type,
       action,
       status,
       action_time,
       description
from   cdb_registry_sqlpatch
order  by con_id, action_time desc;
```

`DBA_REGISTRY_SQLPATCH`の各行は適用または rollback の試行を表す。

過去の`WITH ERRORS`が残る場合もあるため、目的とした最新の`APPLY`または`ROLLBACK`が`SUCCESS`であること、対象 PDB すべてに反映されたこと、`LOGFILE`に未解決エラーがないことを確認する。

## 運用サイクル

### 毎月

- Oracle Security Alerts の CPU、CSPU、Security Alert と事前通知を確認する
- Affected Products と Risk Matrix を製品台帳に突き合わせる
- Linux x86-64の Database／GIでは、最新 MRP と CSPU の内容を確認する
- Client、ORDS、関連ミドルウェアを含めて緊急度を判断する

### 四半期

- 最新 RU を基準にパッチ計画を作る
- DB システム、GI、Database、OJVM、Client の整合性を確認する
- ステージングで適用、rollback、回帰、バックアップ／リストアを試験する
- 本番適用後に Inventory と SQL patch の状態を記録する

## 補足資料

- [CPU, CSPU, MRP, RU - some clarifications](https://mikedietrichde.com/2026/06/09/cpu-cspu-mrp-ru-some-clarifications/)
