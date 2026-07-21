---
title: Kubernetes Service と Ingress
date: 2025-11-24
modified: 2026-07-21
draft: false
tags:
  - containers/kubernetes
aliases:
  - containers/kubernetes/service
  - containers/kubernetes/ingress
  - memos/k8s-service
  - memos/kubernetes/k8s-service
  - memos/k8s-ingress
  - memos/kubernetes/k8s-ingress
description: Kubernetes Service と Ingress の役割、公開範囲、選択条件を整理する。
---

## 概要

| リソース | 役割                                                            | 主な経路選択        | 実装上の前提                               |
| -------- | --------------------------------------------------------------- | ------------------- | ------------------------------------------ |
| Service  | 変化するPod群を論理的なネットワークエンドポイントとして公開する | ServiceのIPとポート | Service typeとクラスターのネットワーク実装 |
| Ingress  | クラスター外からのHTTPまたはHTTPS通信をServiceへ振り分ける      | ホスト名とURLパス   | Ingress controller                         |

## Service

Doc: [Service](https://kubernetes.io/docs/concepts/services-networking/service/)

- Serviceは、1つ以上のPodで動くネットワークアプリケーションを公開するための抽象化
  - 通常はselectorに一致するPodがEndpointSliceへ反映される
  - Podが作成または削除されても、クライアントはServiceのエンドポイントを利用できる
- `type`は公開範囲と経路を決める

| `type`         | 公開方法                                           |
| -------------- | -------------------------------------------------- |
| `ClusterIP`    | クラスター内部のIPで公開するデフォルト方式         |
| `NodePort`     | 各NodeのIP上の静的ポートで公開する                 |
| `LoadBalancer` | 外部ロードバランサーとの統合によって公開する       |
| `ExternalName` | DNSの`CNAME`レコードとして外部ホスト名へ対応づける |

## Ingress

Doc: [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)

- Ingressは、クラスター外からのHTTPまたはHTTPS経路をServiceへ対応づける
  - 単一の外部エンドポイントから、ホスト名やURLパスに基づいて複数のServiceへ振り分けられる
  - 任意のポートやプロトコルを公開するための仕組みではない
- Ingress resourceを作成するだけでは経路は実装されない
  - Ingress controllerがロードバランサーやプロキシの設定へ反映する
- Ingress APIは安定版だが、新しい機能の追加は停止している
  - Kubernetesプロジェクトは新しい機能にGatewayを推奨している

## 選択

- 変化するPod群へ安定した接続先を提供する場合はServiceを使う
- クラスター外へL4の接続先を公開する場合は、環境に応じて`NodePort`または`LoadBalancer` Serviceを使う
- 既存のIngress controllerでHTTPまたはHTTPSをホスト名やURLパスにより振り分ける場合はIngressを使う
- 新しいHTTPルーティング機能が必要な場合は、利用環境の対応状況を確認してGatewayを検討する
