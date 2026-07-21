---
title: User Namespace With a Pod（CloudNative Days Winter 2024）
date: 2026-06-28
modified: 2026-07-21
draft: false
tags:
  - type/bookmark
  - containers/kubernetes
  - linux/namespaces
aliases: []
description: Kubernetes Pod で User Namespace を使い、コンテナとNodeのUID・GIDを分離する仕組みの講演メモ。
url: https://speakerdeck.com/pfn/cloudnative-days-2024-usernamespace-with-a-pod
---

## 録画

https://cloudnativedays.jp/cndw2024/talks/2393

## メモ

### はじめに

- User Namespace

  - コンテナ内で安全に root ユーザーを使える機能

- nginx を動かす際、セキュリティを考えて UID1000を指定する

```yaml
apiVersion: v1
kind: Pod
metadata:
	name: nginx
spec:
	containers:
	- name: nginx
	  image: nginx
	  securityContext:
		  runAsUser: 1000
```

すると大体パーミションエラーがでてくる

```
=> mkdir() "/ver/cache/nginx/client_temp"
failed (13: Permission denied)
```

- `runAdUser`を削除すると動くが、、

  - nginx は uid 0 で動作する。つまり、コンテナをなんらかの手段で抜け出した場合、UID 0 に到達できてしまう。

- これを防ぐ機能として User Namespace With a Pod がでた

```diff
apiVersion: v1
kind: Pod
metadata:
	name: nginx
spec:
+	hostUsers: false
	containers:
	- name: nginx
	  image: nginx
```

`hostUsers: false`を指定することで、Node 側では UID 0 で動作しなくなる。

### コンテナ基礎

- コンテナの隔離を支える技術
  - namespaces
  - capabilities
  - cgroups
  - pivot_root
- 今回は namespaces と capabilities が大きく絡んでくる

- capabilites
  - root 権限の細分化
    - CAP_CH
    - CAP_NET_ADMIN
    - CAP_SYS_ADMIN
    - CAP_BPF
      ...
- namespaces
  - 様々なリソースを隔離

## User Namespace とは

- Linux Namespaces の１種類
  - 非特権ユーザーから分離することができる
  - pid NS の場合は `sudo`が必要だが、User NS は必要ない
- 特に UID/GID をホストの User NS から分離する

  - ホストの User NS からマッピング可能

- init User NS
  - カーネルで使われているホストの User NS
- Container ごとに Init User NS を区切り、コンテナのUser NS として割り当てることができる

  - この際、UID を変更が可能

- このマッピングは `/proc/<uid>/uid_map`で行われる

```bash
$ cat /proc/<pid>/uid_map
        0    1000     1
        1    10000    65536
# ID-chid-ns ID-parent-ns length
```

- `newuidmap`：User NS の UID のマッピングを行ってくれるコマンド

  - 引数は４つ
    - pid：ターゲットのプロセスID
    - uid：子の User NS のスタートのUID（コンテナの中）
    - loweruid：親の User NS のスタートのUID
    - count：マッピングするUIDの長さ

- `subuid`

  - 各ユーザーが割り当てることができる UID の範囲は決まっている
  - 実際に存在する UID は割り当てができない
  - `/etc/subuid`に各ユーザーがどの UID を割り当てられるかが設定されている

- なぜ安全なのか
  - 真の root = init_user_ns の UID 0
  - カーネル側では適宜 "真" のrootかをチェックしている

### ファイルの所有者

- User NS のマッピングはあくまでプロセス
- ではファイルの所有者のマッピングはどうするのか

- パーミションにおいて、割り当てられたユーザーはそのユーザー（root）として識別されるが、割り当てられていないユーザーは `nobody`となってしまう - User NS と同様、マッピングして解決する必要がある
  → **id-mapped mount** がファイルシステムレイヤで、UID/GID の変換を担当する
