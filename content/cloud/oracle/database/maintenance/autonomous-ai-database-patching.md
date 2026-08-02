---
title: Autonomous AI Database のパッチ運用
date: 2026-07-27
modified: 2026-07-27
draft: true
tags:
  - cloud/oci/database
aliases: []
description: Autonomous AI Database のパッチ頻度、アプリケーション影響、スケジュール制御、事前検証方法を配置モデル別に整理する。
---

← [[cloud/oracle/database/services/oci-autonomous-ai-database|OCI Autonomous AI Database]]

このメモは2026年7月27日時点の OCI Public Cloud 上の Autonomous AI Database Serverless／Dedicated と、Dedicated を顧客サイトへ配置する Autonomous AI Database on Exadata Cloud@Customer を対象にする。Dedicated Region Cloud@Customer と Oracle AI Database@AWS、Oracle AI Database@Azure、Oracle AI Database@Google Cloud 上の Multicloud 配置は対象外とする。

## 判断の前提

Doc: [View Patch and Maintenance Window Information, Set the Patch Level](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/maintenance-windows-patching.html)

Doc: [Service Maintenance of Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/service-maintenance-of-autonomous-ai-database-on-dedicated.html)

- Oracle は OS、Grid Infrastructure、Database software、Exadata software などのパッチ適用作業を実行する
- 利用者は提供される選択肢の範囲で適用時期、順序、方式を決め、必須保守を恒久的には拒否できないことを前提にアプリケーションを設計する
- Serverless は週次の継続デリバリー、Dedicated は四半期の Fleet maintenance が基本であり、Autonomous AI Database 全体を一つの頻度で説明できない
- Rolling maintenance は Database の計画停止を避ける仕組みであり、既存セッション、長時間処理、SQL 性能まで無影響になることを意味しない
- 事前検証は可能だが、Serverless の Early／Regular と Dedicated の ACD 単位の段階適用では仕組みが異なる

## 保守単位

| 形態 | Oracle が更新する主な範囲 | 利用者が制御する単位 | パッチの先行検証 |
| --- | --- | --- | --- |
| 標準 Serverless | Database、Dictionary、OS、Grid Infrastructure、Exadata Storage、Firmware | Autonomous AI Database の Patch level と割当済み Maintenance window | Early の Database または Refreshable Clone |
| Serverless の Dedicated Elastic Pool | 標準 Serverless と同じサービススタック | Pool 共通の Maintenance window と一時停止 | Early の別 Database または Refreshable Clone を使い、Pool との差を考慮する |
| Dedicated Exadata Infrastructure | Exadata Infrastructure、Autonomous Exadata VM Cluster（AVMC）、Autonomous Container Database（ACD） | EI、AVMC、ACD の Maintenance policy | 開発／テスト ACD を本番 ACD より先に更新する |
| Autonomous AI Database on Exadata Cloud@Customer（Dedicated） | 顧客サイトの Exadata 上にある EI、AVMC、ACD、Database | EI、AVMC、ACD の保守スケジュールと、サイト側 Network／業務予定との調整 | 開発／テスト ACD の段階適用と、顧客 Network を含む接続試験 |

> [!NOTE] Dedicated Elastic Pool と Dedicated Exadata の違い
>
> Dedicated Elastic Pool は Serverless の Pool 形態である。Autonomous AI Database on Dedicated Exadata Infrastructure の ACD、AVMC、専有 Exadata を管理する形態とは異なる。

配置モデルごとの先行検証と保守の流れは次のように異なる。

![[autonomous-ai-database-patching-model.png|Oracleによる自動パッチ適用を共通点として、ServerlessはEarlyからRegularへ週次、Dedicatedは開発・テストACDから本番ACDへ四半期、Cloud@CustomerはPrecheckとCustom actionを経て基盤保守する流れを比較した図|900]]

## パッチの頻度

### Serverless

Doc: [View Patch and Maintenance Window Information, Set the Patch Level](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/maintenance-windows-patching.html)

Doc: [Test Workloads Against an Upcoming Patch](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-real-application-testing-upcoming-patch.html)

Doc: [About Dedicated Elastic Pools](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/dedicated-elastic-pools.html)

#### Early と Regular

Serverless で選択する**Patch level**は、Database の Edition や Patch version を固定する設定ではない。Oracle の継続デリバリーで、今後の Patch をどの順番で受け取るかを選ぶ設定である。

| 比較軸 | Early | Regular |
| --- | --- | --- |
| 適用順序 | Regular の予定より1週間早く適用 | Early の1週間後に通常順序で適用 |
| 主な用途 | 開発、テスト、Refreshable Clone での先行検証 | 本番 Database |
| 作成時の既定 | 新規 Database の既定ではない。Clone は Source が Early なら Early を継承する | 新規 Database の既定値。Clone は Source が Regular なら Regular を継承する |
| 問題検出時 | Regular へ到達する前に Service Request を起票する | Oracle が Early の報告を基に Patch の一部削除、Parameter での無効化、Regular 側の適用一時停止などを判断する |

通常サイクルでは、週Nに Early へ入った変更が週N+1の Regular 適用候補になる。Early で回帰が見つかると Oracle が内容を変更または Regular 側の適用を止める場合があるため、「Early と Regular には常に同一Binaryが適用される」という意味ではない。

![[autonomous-ai-database-early-regular-timeline.png|週NにEarlyの検証DatabaseへPatch Pを先行適用し、1週間の検証とService Requestの期間を経て、問題がなければ週N+1にRegularの本番Databaseへ適用する通常サイクル。1週間は利用者がRegularを延期できる期間ではない|900]]

#### 提供スケジュールと猶予

Serverless の変更は週次の継続デリバリーサイクルで提供される。ただし、すべての週に同じ Component や利用者から見える変更が入るとは限らない。Patch 対象は`Database`、`Dictionary`、`Infrastructure`に分かれ、各 Database の実際の対象と日時は OCI Console の`Target component`と`Next maintenance`で確認する。

各 Database には異なる定義済み Maintenance window が割り当てられる。OCI Events は新しい予定の作成時、開始24時間前、開始60分前、開始時、終了時に通知できる。

| 猶予または調整手段 | 利用者が得られる時間 | できること | 限界 |
| --- | --- | --- | --- |
| Early による先行検証 | 通常は Regular 適用まで1週間 | 開発、テスト、Refreshable Clone で機能、性能、Workload Replay を検証し、問題を Service Request で報告する | Regular 本番を1週間延期する機能ではない |
| 標準 Serverless の Window 変更 | 土曜または日曜の利用可能な2時間枠 | Support Request で Region local time の別の枠を依頼する | 適用時刻の調整であり、Patch の Skip や任意期間の保留ではない |
| Early で問題を報告した後 | Oracle の是正に必要な期間 | Oracle が Patch の一部削除、無効化、Regular 側の適用一時停止を行う場合がある | 利用者が期間を指定できる延期枠ではなく、固定の追加猶予も公開されていない |
| Critical security fix | 通常の1週間差を前提にできない | 公開された予定と Event に合わせて即応する | 利用可能になり次第適用されるため、通常の Early 検証順序より優先される |
| Dedicated Elastic Pool | Security patch 以外は、最後の Patch から最大30日（4週間）以内 | Pool leader が Maintenance を Pause／Resume する | 標準 Serverless の Early／Regular とは別の制御であり、Security patch は Pause できない |

したがって、標準 Serverless で利用者が計画に組み込める検証猶予は通常1週間である。Support Request による Window 変更は、その1週間を数週間へ延ばす仕組みではない。

Patch level の選択は ECPU compute model に限られる。Early は Region または Database version によって利用できない場合があり、Autonomous Data Guard を有効にする Database は Regular だけを使用する。

### Dedicated Exadata と Cloud@Customer

Doc: [Maintenance Quarters Offset by One Month](https://docs.oracle.com/en-us/iaas/releasenotes/changes/cd098fb6-7851-4292-a1e5-0b4fbc88ba6e/index.htm)

| 種別 | 頻度 | 対象 | 補足 |
| --- | --- | --- | --- |
| Quarterly maintenance | 四半期 | EI、AVMC、ACD | ACD では既定で RU を適用する。Oracle の保守四半期は2月、5月、8月、11月に始まる |
| Infrastructure security maintenance | 重要な Security update がある月 | Database server、Storage server | 現行資料は全 CVSS score の脆弱性を対象とする。AVMC の月次保守は Government region に限られる |
| One-off patch | 重大な SR または Security issue の発生時 | 主に ACD に対する個別修正 | 既定では利用可能になってから72時間以内に予定される |

四半期保守は一つの Database event ではない。EI、AVMC、ACD がそれぞれ更新されるため、同じ四半期に複数の Maintenance event が発生する。

## アプリケーションへの影響

Doc: [Configure Drivers for Continuous Availability](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/configure-drivers-for-continuous-availability.html)

Doc: [About Application Continuity on Autonomous AI Database](https://docs.oracle.com/en-us/iaas/autonomous-database-shared/doc/application-continuity-about.html)

Doc: [Service Maintenance of Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/service-maintenance-of-autonomous-ai-database-on-dedicated.html)

Doc: [Configure Oracle-Managed Infrastructure Maintenance](https://docs.oracle.com/en-us/iaas/exadata/doc/ecc-vw-maint-hist.html)

| 事象 | Database の状態 | アプリケーションから見える可能性がある影響 |
| --- | --- | --- |
| Serverless の予定パッチ | Rolling で Online を維持し、新規接続を新しい Node へ送る | 既存接続は5分間 Drain され、解放されない接続は切断される |
| Serverless の Dictionary patch | 原則 Online | 更新対象の Dictionary object を Lock している Session は切断される場合がある |
| Dedicated／Cloud@Customer の EI Rolling maintenance | Database server と Storage server を1台ずつ更新し、他の Server で Service を継続する | Instance restart による接続影響、処理能力や I/O 容量の一時減少による性能・Throughput 低下が見える可能性がある |
| Dedicated／Cloud@Customer の EI Non-rolling maintenance | Database server と Storage server を並列更新する | Maintenance 時間は短くなるが、基盤全体が停止する |
| Dedicated ACD の Rolling maintenance | Node を1台ずつ更新し、Oracle の定義では Database downtime なし | 接続の Drain と再接続、Node 減少中の性能変化が見える可能性がある |
| Dedicated ACD の Non-rolling maintenance | ACD の全 Node を並列更新する | ACD 配下の全 Autonomous AI Database が停止する |
| Dedicated の Time zone file update | Non-rolling が必須 | ACD 配下が停止し、停止時間は Time zone sensitive data の量に左右される |
| Dedicated の月次 Infrastructure security maintenance | Database server は Ksplice、Storage server は Rolling | Oracle は Database と Application への停止影響なしとしているが、Scale、OS／GI patch、基盤拡張などの管理操作は一時制限される |

> [!NOTE] 「ダウンタイムなし」の境界
>
> Rolling は「Database 全体を計画停止しない」という可用性の説明である。処理中の Session が維持されること、応答時間が変わらないこと、SQL の実行計画や機能動作に回帰がないことを一括して保証する表現ではない。

接続影響を小さくするには、FAN 対応の Connection pool を使い、処理が終わった接続を Pool へすぐ返す。Serverless では5分を超える長時間処理を Maintenance window の直前と実行中に開始しないよう、通知と Job schedule を連携させる。

5分は2026年7月27日時点の Drain time であり、Oracle は将来の Release で変更する可能性があるとしている。Connection pool を使えない場合は、Oracle client 19.13以降と`isValid()`、`isUsable()`、`pingDatabase()`、`endRequest()`のいずれかを使う接続 Drain を検討する。

Application Continuity または Transparent Application Continuity は、Drain できなかった処理の再接続と Replay を補助する。既定で有効と仮定せず、使用する Database service、Driver、Request boundary、Session state、外部副作用を含む処理の再実行可否を検証する。

Stateful PL/SQL package が更新されると、既存 Session は`ORA-04068`を受ける場合がある。`SESSION_EXIT_ON_PACKAGE_STATE_ERROR=TRUE`は Session を終了させて再接続処理へ寄せる設定であり、Application 側の再試行設計と併せて評価する。

Java version update を含む Maintenance では、OCI Event の Description に Java service の Downtime が明記される。Database の新規接続が成功することを、Java や APEX を含む組込み Service 全体の無停止へ一般化しない。

## スケジュールの柔軟性

### Serverless

Doc: [View Patch and Maintenance Window Information, Set the Patch Level](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/maintenance-windows-patching.html)

Doc: [Elastic Pool Operations](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/elastic-pools-create-manage.html)

Doc: [About Dedicated Elastic Pools](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/dedicated-elastic-pools.html)

標準 Serverless の Early／Regular、2時間枠、1週間の先行検証については「提供スケジュールと猶予」で整理した。Elastic Pool では、Pool 内の配置方式によって追加の制御が変わる。

| Pool 形態 | 選べること | 選べないことまたは制約 |
| --- | --- | --- |
| 通常の Elastic Pool | 既定は Member ごとの割当枠。Pool ECPU count が1024以上なら、Support Request により Pool 全体を同じ2時間枠へまとめられる | 任意の Pool で Self-service の延期ができるわけではない |
| Dedicated Elastic Pool | 作成時または有効化時に Day と Time（UTC）を選び、Pool leader が Security patch 以外を最大4週間 Pause できる | 作成後に枠を変更できない。30日以内に少なくとも1回は Patch を受け、Security patch は Pause できない |

Dedicated Elastic Pool の Pause／Resume は同じ Region のすべての Dedicated Elastic Pool に連動する。同一 Tenancy と Region で後から作成した Pool は、最初の Dedicated Elastic Pool の Maintenance window を継承する。

### Dedicated Exadata と Cloud@Customer

| 種別 | 利用者が制御できる範囲 | 延期の限界 |
| --- | --- | --- |
| Quarterly maintenance preference | EI、AVMC、ACD ごとの月、週、曜日、4時間の開始枠。ACD の Rolling／Non-rolling、Next RU／Latest RU | Preference の変更後に当四半期の Event が作成済みなら、原則として次四半期から反映される |
| Scheduled quarterly event | 同一四半期内で開始を後ろへ変更。ACD は現行より後の RU／RUR を選択でき、EI は Rolling／Non-rolling を変更できる。Autonomous Data Guard を使わない場合は`Patch Now`を選べる | ACD は2四半期連続で Skip できない。Autonomous Data Guard では`Patch Now`を選べず、最も近い4時間枠へ変更する。関連リソースとの競合時は Queue される場合がある |
| Autonomous Data Guard | Standby を Primary より1日から7日前に更新する Buffer | Standby ACD に独立した Custom schedule は設定しない |
| Monthly infrastructure security | Oracle が示す21日間の Window 内で日時を変更する | Skip と Window 外への延期はできない |
| One-off patch | 即時適用または同一四半期内の再スケジュール | Skip できない |

Cloud@Customer では`No preference／Custom schedule`に相当する画面表記が`Oracle-managed／Customer-managed`になる場合がある。ACD の Patch 制御原則は共通だが、Exadata 基盤の Custom action、サイト側ネットワーク、保守中の容量を追加で計画する。

## 事前に影響を調べる方法

### Serverless の Early 検証

Doc: [Service Level Objectives](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/availability-slo.html)

Doc: [Test Workloads Against an Upcoming Patch](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-real-application-testing-upcoming-patch.html)

Doc: [Real Application Testing Capture Replay Views](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/real-application-testing-views.html)

Doc: [Analyzing Captured and Replayed Workloads](https://docs.oracle.com/en/database/oracle/oracle-database/26/ratug/analyzing-captured-and-replayed-workloads.html)

#### 「自動」の範囲

`WORKLOAD_AUTO_REPLAY`を本番 Database で有効化すると、指定した時間帯の Workload Capture と、Early の Refreshable Clone への Replay が一つの週次サイクルとして自動化される。Refreshable Clone を作成して Early patch level に設定しただけでは、このサイクルは開始されない。

![[autonomous-ai-database-workload-auto-replay.png|Regularの本番Databaseで指定時間のWorkloadをCaptureし、EarlyのRefreshable Cloneが次回週次パッチを受けた後に自動Replayし、Status、History、Replay Reportで差分を確認する流れ。機能を無効化するまで週次で繰り返す|900]]

設定と実行の順序は次のようになる。

1. Source は Regular patch level の本番 Database とする。
2. Source から Refreshable Clone を作成し、Target を Early patch level にする。Clone は`WORKLOAD_AUTO_REPLAY`を有効化する前に作成する。
3. Source で`DBMS_CLOUD_ADMIN.ENABLE_FEATURE`を実行し、Target の OCID、Capture 時間、任意の開始曜日と時刻を指定する。
4. Source は指定時間だけ本番 Workload を Capture する。曜日と時刻を省略した場合は、有効化した時点で最初の Capture が始まる。
5. Autonomous AI Database は Target の Patch 状態を確認し、次回の週次 Patch が Target へ適用された後に Capture 済み Workload を Replay する。
6. 機能を無効化するまで、同じ Capture と Replay のサイクルを毎週繰り返す。

Source 一つにつき自動 Replay の Target にできる Refreshable Clone は一つだけである。明示的に関連付けた Target へ、サービスが Patch 適用を待って Replay する仕組みであり、手動で取得した任意の Capture が任意の Clone へ即時または同時に再生される仕組みではない。

この文脈での「Patch を適用した Clone」とは、利用者が任意の Patch を手動適用した Clone ではない。Early patch level に設定し、Oracle が Regular より1週間早く次回の週次 Patch を適用した Refreshable Clone を指す。

設定例では、毎週月曜日15時から120分間の Workload を Capture する。

```sql
begin
  dbms_cloud_admin.enable_feature(
    feature_name => 'WORKLOAD_AUTO_REPLAY',
    params => json_object(
      'target_db_ocid' value '<Early の Refreshable Clone の OCID>',
      'capture_duration' value 120,
      'capture_day' value 'MONDAY',
      'capture_time' value '15:00'
    )
  );
end;
/
```

Capture されるのは、指定時間内に外部 Client から Database へ届いた Request である。Replay では、記録された SQL、Bind 値、Transaction 情報を使い、元の Timing、Concurrency、Transaction dependency を再現する。したがって、代表的な Online transaction や Batch が Capture 時間内に実行されるように Schedule を選ぶ必要がある。Application の画面操作、Database の外部にある API、Message、File 出力の正しさまで自動判定するものではない。

#### 影響の確認

Replay が完了したことと、Application への影響がないことは別の判定である。結果は次の順に確認する。

| 確認対象 | 確認手段 | 分かること |
| --- | --- | --- |
| 現在の処理 | `DBA_CAPTURE_REPLAY_STATUS`の`STATE`と`PROGRESS` | Capture、Download、Replay、Report upload の進行状態 |
| 過去の実行 | `DBA_CAPTURE_REPLAY_HISTORY`の`TYPE`、`STATUS`、`START_TIME`、`END_TIME` | Capture／Replay がいつ開始・終了し、成功したか |
| Database call の差分 | `REPORT_URL`または`WorkloadReplayEnd` Event の`replayDownloadURL`から取得する Replay Report | 新規・消失・変化した Error、DML の影響行数や Query の戻り行数の差異 |
| 性能差 | Replay Report と Replay Compare Period Report | Database time、User call、Top SQL、CPU／I/O、ADDM／ASH などの比較 |
| 業務上の正しさ | Application log、業務件数、Batch 終了状態、外部連携の検証 | Database Replay が直接判定しない業務結果と外部副作用 |

`DBA_CAPTURE_REPLAY_STATUS`と`DBA_CAPTURE_REPLAY_HISTORY`は次のように確認できる。

```sql
select state,
       progress
from dba_capture_replay_status;

select name,
       type,
       status,
       start_time,
       end_time,
       report_url
from dba_capture_replay_history
order by start_time desc;
```

`WorkloadCaptureBegin`、`WorkloadCaptureEnd`、`WorkloadReplayBegin`、`WorkloadReplayEnd`を受け取るには、Autonomous AI Database の Information event を購読する。 `WorkloadReplayEnd`の PAR URL は生成から7日間だけ有効なため、定期運用では Report を期限内に保存する。

Replay Report は Application 固有の合格条件を一つの Pass／Fail にまとめるものではない。差分が出た場合は、まず Error divergence、DML／Query data divergence、性能差のどこに現れたかを確認し、Capture した時間帯、Clone の論理状態、Compute 設定など Patch 以外の差を切り分ける。Patch による回帰を再現できた場合は、Regular への適用前に Capture／Replay の時刻、Report、SQL ID、Application evidence を添えて Service Request を起票する。

#### 自動 Replay と利用者試験の関係

1. 本番 Database を Regular にする。
2. Early の Refreshable Clone と`WORKLOAD_AUTO_REPLAY`で Database call の Error、Data、性能の差を継続的に検出する。
3. Capture に含まれない業務経路、接続 Drain と再接続、外部連携は別の Application test で確認する。
4. 問題を検出した場合は Regular への適用前に Service Request を起票する。

Oracle の Automatic Regression Detection は Early と Regular を監視し、AWR 情報を使って検出した問題を Oracle 内部へ報告する。ただし、公式資料もすべての問題を検出できるとはしていない。

Zero-Regression は、Early で報告された問題が Regular へ到達しないよう Oracle が Commercially reasonable efforts を行う SLO である。利用者側の Application test と監視を不要にする保証として扱わない。

### 接続挙動のシミュレーション

Doc: [Restart Autonomous AI Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-restart.html)

Serverless の Online Restart は、新しい Node へ接続を移し、既存接続を5分 Drain するパッチ時の接続 Drain と再接続の挙動をシミュレートする。Connection pool、再接続、長時間処理、Application Continuity の試験には使えるが、Patch による SQL、Optimizer、Dictionary、APEX の変更内容は再現しない。

### Dedicated の段階適用

Doc: [Service Maintenance of Autonomous AI Database on Dedicated Exadata Infrastructure](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/service-maintenance-of-autonomous-ai-database-on-dedicated.html)

Doc: [Schedule a Quarterly Maintenance Update](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/schedule-a-quarterly-maintenance-update.html)

Oracle は、開発／テスト ACD を本番 ACD より先に保守するよう、ACD の Maintenance schedule をずらす方法を推奨している。個々の Autonomous AI Database ではなく ACD が Patch version と日時の境界になるため、先行検証環境は本番と別の ACD に配置する。

On-demand maintenance では、利用可能な RU、Time zone file だけの更新、既存の Custom database software image のいずれかを選べる。過去の RU に相当する Custom image は選べない。

検証用 ACD へ先に更新を適用し、Application の機能試験、性能比較、Batch、接続回復を確認する。本番に予定された Patch と検証対象が一致するかは Maintenance page の Patch version で照合し、OCI Public Cloud では`DB_NOTIFICATIONS`の`PATCH_ID`も確認する。

Doc: [Oracle Database Features with Limited Support in Autonomous AI Database](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/adbaa/oracle-database-features-with-limited-support-in-autonomous.html)

必要な Workload fidelity が高い場合は、Real Application Testing の Database Replay または SQL Performance Analyzer を評価する。Dedicated での RAT は制約付きの機能であり、Replay client の最低 version や AWR import の制限など、実施時点の要件を公式資料で確認する。

> [!NOTE] Standby 先行更新の位置付け
>
> Autonomous Data Guard は Standby ACD を Primary より先に更新する。ただし、通常の Application traffic を流して回帰を評価する開発／テスト ACD と同じ役割ではない。DR の保守順序と Application の先行検証を別々に設計する。

### Cloud@Customer の Infrastructure precheck

Doc: [Configure Oracle-Managed Infrastructure Maintenance](https://docs.oracle.com/en-us/iaas/exadata/doc/ecc-vw-maint-hist.html)

Cloud@Customer の Infrastructure maintenance では、Oracle が開始約2週間前と約24時間前に Precheck を実行する。Precheck 中も基盤は Online であり、保守の成功を妨げる問題を検出する。

この Precheck は Application の機能・性能回帰を予測する試験ではない。ACD の段階適用と Application test を別に実施する。

Quarterly infrastructure maintenance では、Database server の更新前に利用者の Custom action を挟める。Rolling では各 Database server の前、Non-rolling では全 Database server の前に15分から120分の待機枠を設け、サイト固有の退避や確認を行う。

## 予定、履歴、変更内容の確認

### Serverless

OCI Console の`Maintenance`領域には Patch level、`Next maintenance`、`Target component`、過去の Planned／Unplanned event が表示される。OCI Events は新しい予定、24時間前、1時間前、開始、終了に加え、Critical security fix、Regression、予定保守の失敗に伴う`UnplannedMaintenanceBegin`と`UnplannedMaintenanceEnd`を通知する。Events の時刻は UTC である。

Database 内では次の View から予定と実績を確認できる。

```sql
select *
from db_notifications
where type = 'MAINTENANCE';
```

`DBA_CLOUD_PATCH_INFO`は、顧客が報告した Bug と、その修正が含まれた Patch version を確認する View である。

```sql
select bug_num,
       bug_title,
       component_name,
       patch_version
from dba_cloud_patch_info
order by patch_version, bug_num;
```

この View に行がないことは「変更がない」ことを意味しない。公式説明上は顧客報告 Bug の修正情報であり、Patch の完全な変更一覧ではない。

Customer Contacts は未計画保守などの運用連絡を Email で受ける設定であり、通常保守の Schedule、Start、End を通知する OCI Events の購読を置き換えない。

### Dedicated Exadata と Cloud@Customer

EI、AVMC、ACD の各 Maintenance page には、共通して Event の状態、種別、OCID、予定開始日時が表示される。Rolling／Non-rolling は EI、Patch version は ACD の Event に表示される。OCI Events と Notifications では Scheduled、Reminder、Begin、End を購読する。

OCI Public Cloud の Dedicated では`DB_NOTIFICATIONS`を使い、`OP_MODE`、`DATABASE_IMPACT`、`PATCH_ID`を含む Maintenance 状態を Database 内から確認できる。この View の Dedicated 向け機能は Oracle Public Cloud に限られる。

Cloud@Customer では各リソースの Maintenance History と OCI Events／Notifications を中心にし、顧客サイト側の基盤作業記録と関連付ける。Serverless または Public Cloud Dedicated の SQL View を Cloud@Customer の監視手段と仮定しない。

## 運用サイクル

> [!NOTE] 説明モデル
>
> 次の表は Oracle の各機能を一つの運用サイクルへまとめたモデルであり、Oracle が公開する単一の標準 Runbook ではない。

| 段階 | 利用者側の処理 | 判断に使う情報 |
| --- | --- | --- |
| 方針設定 | Serverless では本番を Regular、検証環境を Early にする。Dedicated では本番と検証を別 ACD に置き、Maintenance window をずらす | 配置モデル、Patch level、ACD policy |
| 継続検証 | Workload replay、機能試験、性能比較、Online Restart による接続試験を定期実行する | Replay report、Application metric、接続 Error |
| 予定検知 | Maintenance event を Events／Notifications で受け、対象 Component、Patch version、開始時刻を記録する | Console、OCI Events、Maintenance History |
| 実施前 | Drain 時間を超える Batch と ETL の開始を止め、Connection pool、Retry、業務処理の再実行可否を確認する | Job schedule、Driver 設定、業務の冪等性 |
| 実施中 | Database availability、接続 Error、長時間処理、性能、基盤操作の制限を監視する | Database metric、Application log、OCI event |
| 実施後 | 業務 Smoke test、Batch 再開、性能差、Maintenance status を確認する | 業務監視、Replay／SQL 比較、履歴 |
| 回帰対応 | Patch ID、発生時刻、再現手順、性能差を添えて SR を起票する | History、Serverless／OCI Public Cloud Dedicated の`DB_NOTIFICATIONS`、Application evidence |

## 誤解しやすい点

| 誤解 | 実際の境界 |
| --- | --- |
| 自動パッチなら Application test は不要 | Oracle は適用作業を担うが、利用者固有の SQL、接続、Batch、外部副作用は利用者が検証する |
| Rolling なら接続も無影響 | Database は Online でも、Drain 時間を超える Session や Dictionary object を使う Session は切断され得る |
| Early は本番 Patch を任意期間延期する仕組み | Early は Regular より1週間先行する検証 Channel である |
| Early の Refreshable Clone を作れば本番 Workload が自動で流れる | Source で`WORKLOAD_AUTO_REPLAY`を有効化し、Target OCID と Capture 条件を設定した場合だけ、次回 Patch 後の Replay までが週次で自動化される |
| Zero-Regression SLO が回帰しないことを保証する | Oracle の検出と是正目標であり、Automatic Regression Detection が見つけない問題もある |
| Dedicated なら Patch を無期限に拒否できる | 四半期保守は2回連続で Skip できず、月次 Security maintenance と One-off patch は Skip できない |

## 関連する深掘り

- APEX の Patch Set Bundle と新 Release は、Database の週次 Rolling patch と別の適用規則を持つ
- Time zone file update は、配置モデルによって Restart または Non-rolling maintenance を必要とする
- Application Continuity と Transparent Application Continuity は、Replay 可能性と外部副作用を含めて Application 単位で設計する
- Multicloud では Provider 側の Console、通知、Maintenance control を個別に確認する
- Oracle Database の RU、MRP、One-off patch の一般的な関係は[[cloud/oracle/database/maintenance/patch|Oracle Database パッチの種類]]を参照する
