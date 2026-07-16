---
title: OCI Data Science
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
  - data/science
description: OCI Data Science の notebook、job、pipeline、model catalog、deployment、MLOps を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

OCI Data Science は、data scientist と ML engineer が model を開発、学習、評価、登録、deploy する managed platform である。OCI Generative AI が managed foundation model / agent API を提供するのに対し、OCI Data Science は Python と open-source ecosystem を使った custom ML lifecycle を中心にする。

> [!note] 提供機能の変化
>
> AI Quick Actions、Operators、対応 model / shape は更新頻度が高い。採用時は target region、service limits、current documentation、console に表示される resource を確認する。

## Resource model

| Resource          | 役割                                                           |
| ----------------- | -------------------------------------------------------------- |
| Project           | notebook、model、job などを workload / team 単位に整理         |
| Notebook Session  | interactive な model development、data exploration、evaluation |
| Conda Environment | package と runtime dependency の再現性を管理                   |
| Model Catalog     | model artifact、metadata、version を保存・共有                 |
| Model Deployment  | model を managed HTTP endpoint として提供                      |
| Job               | repeatable な batch training、evaluation、data processing      |
| Pipeline          | data preparation から deployment までの step を orchestration  |
| Feature Store     | reusable feature と feature lineage を管理                     |

## Development と training

Notebook Session には Accelerated Data Science（ADS）SDK と一般的な Python package を利用できる。AutoML、model evaluation、explainability を使えるが、data leakage、target definition、sampling、business metric の妥当性まで自動化されるわけではない。

large-scale training では GPU shape、distributed framework、Object Storage、Data Flow、custom container を組み合わせる。hardware と cluster topology を全面的に制御したい場合は [[cloud/oracle/ai/oci-ai-infrastructure|OCI AI Infrastructure]] を直接利用する。

## Model Deployment

Model Deployment は Model Catalog の artifact を HTTP endpoint として提供する managed resource である。

- compute shape、replica 数、load balancer bandwidth を選択する。
- public / private endpoint と VCN connectivity を設計する。
- request / response schema、timeout、batching、concurrency を application contract として固定する。
- model server、custom dependency、logging、metric を artifact に含める。
- endpoint を停止しても model artifact や storage cost が残るかを確認する。

AI Quick Actions は foundation / open model の探索、fine-tuning、evaluation、deployment を簡略化する UI / workflow を提供する。作成される deployment は OCI Data Science Model Deployment であり、production 運用では underlying resource、container、shape、network を理解する。

## Jobs と Pipelines

training を notebook 内の手作業で完結させず、Job と Pipeline へ移す。

1. source data と snapshot / version を固定する。
2. validation、feature generation、training、evaluation を独立 step にする。
3. metric threshold を満たした model だけを catalog へ登録する。
4. approval 後に staging / production endpoint を更新する。
5. data drift、prediction drift、latency、error を監視して retraining を起動する。

Pipeline の成功は model 品質を保証しない。data quality、fairness、security、business KPI を別の gate として実装する。

## AI Operators

ADS Operators は low-code で再利用できる packaged solution である。current documentation には AI Forecast、Anomaly Detection、Time-based Anomaly Detection、Recommender、PII などがある。

standalone の [OCI Anomaly Detection service は提供終了している](https://docs.oracle.com/en-us/iaas/Content/anomaly/using/home.htm)。新規の時系列 anomaly detection は Data Science の Operator、custom model、または対象 application に組み込まれた specialized service を評価する。

## OCI Generative AI との選択

| 要件                                          | OCI Data Science                    | OCI Generative AI                    |
| --------------------------------------------- | ----------------------------------- | ------------------------------------ |
| custom ML / statistical model                 | 主対象                              | 主対象ではない                       |
| open-source model の code-level customization | 強い                                | 対応 model import と managed hosting |
| managed foundation model API                  | custom deployment が必要            | on-demand で利用可能                 |
| agent tool / memory / Responses API           | application 側で構築                | managed capability を提供            |
| training pipeline / experiment                | 主対象                              | model service の範囲に限定           |
| runtime responsibility                        | container / artifact を利用者が管理 | platform が多くを管理                |

## Security と cost

- notebook、job、deployment ごとに dynamic group / resource principal と IAM policy を分離する。
- secret を notebook file や model artifact に含めず、OCI Vault から実行時に取得する。
- private endpoint と service gateway を使い、不要な Internet egress を閉じる。
- model artifact の pickle / arbitrary code 実行 risk と container image vulnerability を検査する。
- notebook、job、deployment の idle compute、Block Volume、Object Storage、load balancer を含めて cost を管理する。

## 公式ドキュメント

- [OCI Data Science Overview](https://docs.oracle.com/en-us/iaas/Content/data-science/using/overview.htm)
- [Model Deployment](https://docs.oracle.com/en-us/iaas/Content/data-science/using/model_dep_create.htm)
- [AI Quick Actions — Model Deployment](https://docs.oracle.com/en-us/iaas/Content/data-science/using/ai-quick-actions-model-deploy.htm)
- [Pipelines](https://docs.oracle.com/en-us/iaas/Content/data-science/using/pipelines-about.htm)
- [AI Operators](https://docs.oracle.com/en-us/iaas/Content/data-science/using/operators.htm)
