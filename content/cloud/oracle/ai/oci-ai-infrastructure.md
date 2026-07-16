---
title: OCI AI Infrastructure
date: 2026-07-16
modified: 2026-07-16
draft: false
tags:
  - cloud/oci/ai
  - cloud/oci/compute
description: OCI の GPU Compute、Supercluster、RDMA network、OKE を使った AI 学習・推論基盤を整理する。
---

← [[cloud/oracle/ai/index|OCI・Oracle AI サービス全体像]]

OCI AI Infrastructure は、model の学習、fine-tuning、batch inference、online inference を動かす IaaS / container 基盤である。OCI Generative AI のような managed model API と異なり、利用者が model runtime、container、distributed training、capacity、patch、monitoring を設計する。

## 主な構成要素

### GPU Compute

OCI Compute は GPU shape を VM と bare metal で提供する。

- **VM**：小さく開始し、複数 workload を分離しやすい。inference、development、visualization などに向く。
- **Bare metal**：virtualization layer を介さず GPU、CPU、local storage、network を利用する。multi-GPU / multi-node training や高負荷 inference に向く。
- **Instance pool / autoscaling**：stateless な inference worker を増減する場合に使う。ただし GPU capacity と model loading time を考慮する。

GPU generation、GPU memory、node 内接続、local NVMe、network bandwidth は shape ごとに異なる。固定した SKU 一覧を設計資料へ転記せず、deployment region の current shape と service limit を確認する。

### OCI Supercluster と RDMA Cluster Network

OCI Supercluster は多数の GPU bare metal node を低 latency の RDMA network で接続する構成である。distributed training では GPU 数だけでなく、collective communication、network topology、checkpoint I/O、failure recovery が throughput を決める。

- cluster network 内の node placement と network topology を確認する。
- training framework の distributed configuration と NCCL / communication library を検証する。
- checkpoint を local NVMe だけに残さず、Object Storage など耐久 storage へ退避する。
- node 障害時に job 全体を再実行するのか、checkpoint から再開するのかを決める。

### OCI Kubernetes Engine

OKE は GPU VM / bare metal worker node を利用でき、NVIDIA / AMD の device plugin を add-on として構成できる。複数 model server、queue worker、gateway、evaluation service を共通 platform で運用する場合に向く。

Kubernetes control plane が managed でも、container image、model、Kubernetes RBAC、secret、node pool、upgrade、autoscaling、observability は利用者の責任に残る。単一 endpoint を早く提供するだけなら、OCI Generative AI の managed endpoint や OCI Data Science Model Deployment の方が運用負荷は小さい。

### Storage と data path

| Storage        | 主な用途                                             | 注意点                                                           |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Local NVMe     | training scratch、cache、checkpoint staging          | instance 終了や障害に備えて durable storage へ同期する           |
| Block Volume   | boot、model cache、単一 node の persistent data      | multi-node concurrent access には別方式が必要                    |
| File Storage   | shared dataset、artifact、checkpoint                 | metadata / small file workload と throughput を測る              |
| Object Storage | source dataset、model artifact、long-term checkpoint | training 前の staging、parallel read、request pattern を設計する |

## Managed service との境界

| 要件                                                             | 第一候補                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| 提供済み model を API で利用                                     | [[cloud/oracle/ai/oci-enterprise-ai\|OCI Generative AI]] |
| open-source / custom model の実験と model lifecycle              | [[cloud/oracle/ai/oci-data-science\|OCI Data Science]]   |
| 独自 runtime、distributed training、hardware topology の全面制御 | OCI AI Infrastructure                                    |
| 複数の containerized AI service を共通運用                       | OKE + GPU node                                           |

managed API を使う場合でも、その背後では AI infrastructure が使われる。しかし利用者が GPU node を直接管理しないため、責任境界と課金単位が異なる。

## 設計チェック

- target region の GPU capacity、service limit、quota、reservation を早期に確認する。
- training / inference の GPU memory、context length、batch size、quantization 条件を測定する。
- node 単価ではなく、job completion time、idle time、failed run、data transfer、storage を含む total cost で比較する。
- VCN、private subnet、bastion、egress、Object Storage service gateway、container registry path を設計する。
- model artifact と container image の provenance、vulnerability、license、署名を管理する。
- GPU / CPU / memory / network / disk の telemetry と application-level latency を同時に監視する。
- capacity loss、node failure、Availability Domain 障害に対する retry と recovery を試験する。

## 公式ドキュメント

- [OCI GPU Instances](https://www.oracle.com/cloud/compute/gpu/)
- [Running Applications on GPU-based Nodes in OKE](https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengrunninggpunodes.htm)
- [Kubernetes Engine](https://docs.oracle.com/iaas/Content/ContEng/home.htm)
