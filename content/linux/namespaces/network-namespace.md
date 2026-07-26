---
title: Network namespace
date: 2026-06-28
modified: 2026-07-23
draft: false
tags:
  - linux/namespaces
aliases:
  - NET namespace
  - linux/namespace/network-namespace
description: Network namespace が分離するネットワーク資源と、veth・bridge で namespace 間を接続する仕組みを整理する。
---

## 概要

Network namespace は、ネットワークに関係する次の資源を分離する。

- ネットワークデバイス
- IPv4 / IPv6 プロトコルスタック
- IP ルーティングテーブル
- firewall ルール
- ポート番号とソケット
- `/proc/net`、`/sys/class/net`、`/proc/sys/net` のビュー
- Linux の抽象 UNIX ドメインソケット namespace

物理ネットワークデバイスは、同時には1つの Network namespace にだけ所属できる。

## 新しい Namespace の初期状態

新しく作った Network namespace には通常、loopback デバイス `lo` だけが存在し、初期状態では down になっている。

```bash
sudo unshare --net bash
ip link show
ip link set lo up
ping -c 1 127.0.0.1
```

`lo` を up にしても、その namespace の外へ通信できるようにはならない。外部と通信するには、物理デバイスを移動するか、veth、bridge、ルーティングなどを構成する必要がある。

## veth ペア

veth は常にペアで作られる仮想 Ethernet デバイスである。一方の端に入ったパケットが、もう一方の端から出る。片方を別の Network namespace に移動することで、2つの namespace を接続できる。

Host 側と demo 側の端点が1つの veth ペアを構成することと、外部到達には別の設定が必要であることを次の図で確認できる。

![[network-namespace-veth-path.png|HostとdemoのNetwork namespaceを接続するvethペアと外部到達に必要な追加設定|780]]

```bash
sudo ip netns add demo
sudo ip link add veth-host type veth peer name veth-demo
sudo ip link set veth-demo netns demo

sudo ip addr add 192.0.2.1/24 dev veth-host
sudo ip link set veth-host up

sudo ip netns exec demo ip addr add 192.0.2.2/24 dev veth-demo
sudo ip netns exec demo ip link set veth-demo up
sudo ip netns exec demo ip link set lo up
sudo ip netns exec demo ping -c 1 192.0.2.1

# 後片付け。片方の veth を削除するとペアも削除される
sudo ip link del veth-host
sudo ip netns del demo
```

この例は host namespace との直接通信だけを構成している。インターネットへ到達させるには、さらに IP forwarding、ルーティング、NAT、または bridge への接続などが必要になる。

## Docker との関係

Linux 上の Docker Engine でデフォルトの `bridge` ネットワークを使う場合、Docker はコンテナ側の Network namespace に veth の片端を置き、もう片端をホスト側の bridge に接続する。デフォルト bridge は通常 `docker0` である。

ただし、これはすべての Docker 構成に共通するわけではない。ユーザー定義 bridge、host、overlay、macvlan、rootless mode、Docker Desktop では構成が異なる。

`--network=host` を使うコンテナは、独立した Network namespace を使わずホストのネットワークを共有する。ネットワーク面の分離はなくなるが、PID や Mount namespace など他の分離まで自動的になくなるわけではない。

## ライフサイクル

Network namespace への最後の参照がなくなると、その中の veth などの仮想デバイスは破棄される。物理デバイスが残っていた場合は初期 Network namespace に戻される。

## 参照リンク

- [network_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/network_namespaces.7.html)
- [veth(4) — Linux manual page](https://man7.org/linux/man-pages/man4/veth.4.html)
- [Bridge network driver — Docker Docs](https://docs.docker.com/engine/network/drivers/bridge/)
