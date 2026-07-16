---
title: OCI Oracle Database Autonomous Recovery Service（RCV / ZRCV）
date: 2026-07-15
modified: 2026-07-15
draft: false
tags:
  - cloud/oci/database
aliases:
  - cloud/oracle/oci-oracledb-backup-zrcv
  - cloud/oracle/database/oci-oracledb-backup-zrcv
description: Autonomous Recovery Service の仕組み、RCV と ZRCV、保持、耐改ざん、運用上の注意。
---

Oracle Database Autonomous Recovery Service（以下、Recovery Service）は、Oracle Database のバックアップを集中管理するフルマネージド・サービス。OCI Database ではマネージド自動バックアップの保存先として構成する。

バックアップ方式全体の比較は [[cloud/oracle/database/backup/oci-oracledb-backup|OCI Oracle Database バックアップ概要]] を参照。

## 要点

- `RCV` と `ZRCV` は公式ドキュメント上の別製品名ではなく、Recovery Service で**リアルタイム・データ保護を無効／有効**にした構成を区別する際に使われる呼び方。
- Recovery Service は最初の Level 0 と、その後の Level 1 増分バックアップを受信し、指定時点の完全な Database 像を Virtual Level 0 として管理する。
- リアルタイム・データ保護を有効にすると REDO 変更を継続転送し、公式には「直近のサブ秒に近い RPO」を実現する。ただし、無条件の RPO 0 保証ではない。
- 保護ポリシー、Retention Lock、異常検知、監視、リストア試験を組み合わせて復旧可能性を維持する。

## RCV と ZRCV

| 観点 | RCV と呼ばれる構成 | ZRCV と呼ばれる構成 |
| --- | --- | --- |
| Recovery Service | 使用する | 使用する |
| リアルタイム・データ保護 | 無効 | 有効 |
| 保護対象 | 増分バックアップとアーカイブ REDO ログ | 左記に加え、REDO 変更を継続転送 |
| RPO の考え方 | 最後に正常転送されたアーカイブ REDO ログに依存 | 公式表現では直近のサブ秒に近い RPO |
| 料金 | 通常の自動バックアップ | リアルタイム・データ保護は追加料金 |

### RCV：リアルタイム・データ保護なし

- 障害直前までの復旧可否は、アーカイブ REDO ログのバックアップ間隔と最終成功時刻に依存する。
- 固定の RPO を名称から推測せず、OCI コンソールの保護状態、潜在的なデータ損失、最終バックアップ時刻、復元可能範囲を確認する。
- 要求 RPO がアーカイブ REDO ログの転送間隔より短い場合は、リアルタイム・データ保護を検討する。Data Guard は可用性や災害対策を補完するが、バックアップの代替ではない。

### ZRCV：リアルタイム・データ保護あり

- 保護対象 Database から Recovery Service へ REDO 変更を継続的に転送する。
- オンライン REDO ログ・ファイルそのものを定期バックアップする方式ではなく、REDO 変更をストリーミングする仕組みと捉える。
- 公式ドキュメントの表現は「直近のサブ秒に近い RPO」または「near-zero RPO」であり、「常に最後のコミットまで復旧できる」という意味ではない。
- ネットワーク断、サービス障害、REDO 転送遅延があると保護ギャップが生じ得る。保護状態とアラームを監視する。
- 利用可能な Database バージョン／RU は変わるため、構成時点のサポート条件を確認する。

## Incremental Forever と Virtual Level 0

1. OCI 自動化が最初の RMAN Level 0 バックアップと、その後の Level 1 増分バックアップを送信する。
2. Recovery Service は受信した Oracle Database ブロックを索引付けして管理する。
3. 復旧時には、複数の増分バックアップにまたがるブロックから、指定時点の完全な Database 像である Virtual Level 0 を構成する。

この方式では、仮想フルを作るために本番 Database から毎回フル・バックアップを読み直す必要がない。一方、「内部で何もマージしない」「Point-in-Time Recovery で REDO 適用が一切ない」とは解釈しない。指定時点まで進めるには、その時点までの REDO が必要になる。

> [!note] Delta Store という用語
>
> `Delta Store` はオンプレミス製品 Zero Data Loss Recovery Appliance（ZDLRA）の内部構造を説明する資料で使われる。Recovery Service 公式ドキュメントでは `Virtual Level 0` が中心用語なので、クラウドサービスの内部実装名として断定せず、ブロック単位の増分管理という概念を押さえる。

## 検証、分離、異常検知

Recovery Service はバックアップを Oracle 管理テナンシの基盤に置き、Database 側から直接アクセスできない論理的な分離を提供する。バックアップ通信には private endpoint を使い、暗号化されていないバックアップを受け付けない。

Recovery Service は、次の段階でバックアップの異常を検知する。

- ソース Database から送信する前
- Recovery Service に到着したとき
- バックアップをレプリケートするとき
- リカバリ・ウィンドウ内で定期的に

これらは復旧可能性を高めるが、リストア手順、アプリケーション整合性、RTO まで自動的に保証するものではない。定期的なリストア試験は別途必要。

## 保持と長期保管

Recovery Service の通常バックアップは保護ポリシーで管理する。各保護対象 Database には 1 つのポリシーを関連付ける。

| Oracle 定義ポリシー |            保持期間 |
| ------------------- | ------------------: |
| Bronze              |               14 日 |
| Silver              | 35 日（デフォルト） |
| Gold                |               65 日 |
| Platinum            |               95 日 |

カスタム・ポリシーも 14〜95 日で設定できる。より長い保持が必要な場合は Long-Term Retention（LTR）バックアップを使い、90 日から最長 10 年まで保持する。LTR は通常の自動バックアップから独立し、新しい本番フル・バックアップを取得せず、リカバリ・ウィンドウ内の既存バックアップを利用して作成される。

LTR は新しい Database の作成に使う方式で、in-place restore には使えない。DB システム終了時の削除オプションによって LTR も削除され得るため、Database の終了手順と長期保持要件を関連付ける。

## Retention Lock

- 保護ポリシーに Retention Lock を設定すると、ロック発効後は保持期間が終わるまでバックアップの変更・削除が禁止される。この制限はテナンシ管理者にも適用される。
- ロックの発効には最低 14 日の猶予期間があり、その間は無効化や保持期間の変更が可能。
- 発効後はロックを解除できず、保持期間は延長だけが可能になる。事前に費用、法務、削除要件を確認する。

バックアップ領域が DB サーバーの OS から見えないことは分離に有効だが、それだけで厳格なイミュータビリティを意味しない。誤削除や悪意ある操作への強い保護が必要なら Retention Lock を有効にする。

## 導入と運用の考慮点

- IAM policy、VCN、Recovery Service 用 private subnet、通信要件、TDE の構成を確認する。
- Recovery Service を有効にする前に、他の保存先へ送る手動の運用バックアップを停止する。運用バックアップを複数の保存先へ無計画に送ると、データ損失につながる構成になり得る。
- `Protected`、`Warning`、`Alert` などの保護状態、潜在的なデータ損失、バックアップ成功時刻、容量、異常検知を OCI Monitoring のアラームへ接続する。
- Database 終了時に、バックアップを保持期間まで残すか、72 時間後に削除するかを決める。
- 別 DB システムへの復元、時刻／SCN 指定の復元、TDE キーストアの利用、アプリケーション接続まで定期的に試験する。

## 公式ドキュメント

- [Recovery Service Terminology](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-concepts.html)
- [About Using Recovery Service to Backup and Recover Oracle Cloud Databases](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-automatic-backup-recovery.html)
- [Real-time Data Protection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/about-real-time.html)
- [Security and Availability](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-backup-encryption.html)
- [Immutability and Anomaly Detection](https://docs.oracle.com/en-us/iaas/recovery-service/doc/recovery-service-fault-tolerance.html)
- [About Protection Policies](https://docs.oracle.com/en-us/iaas/recovery-service/doc/overview-protection-policy.html)
- [Retention Lock](https://docs.oracle.com/en-us/iaas/recovery-service/doc/protection-policy-locking.html)
- [Configure Recovery Service](https://docs.oracle.com/en/cloud/paas/base-database/recovery-service/index.html)

## 補足資料

- [Autonomous Recovery Service（RCV / ZRCV）概要](https://speakerdeck.com/oracle4engineer/zrcv-overview)
- [Autonomous Recovery Service（RCV / ZRCV）と Object Storage](https://speakerdeck.com/oracle4engineer/rcvzrcv-objectstorage)
- [OCI Database Autonomous Recovery Service を試す](https://qiita.com/fujid/items/5795112bbf5cf40bfd85)
