---
title: cgroup（Control Groups）
date: 2026-06-07
modified: 2026-07-21
draft: false
tags:
  - linux/cgroups
  - containers
aliases:
  - cgroups
  - memos/cgroup
description: Linux cgroup の基本、cgroup v1/v2 の構成差分、v2 のファイル構成、systemd・Docker・Kubernetes との関係を整理する。
---

## 1. cgroup とは何か

**cgroup（Control Groups）** は、プロセスをグループにまとめ、リソースの**制限・計測・優先制御**を行う Linux カーネルの機能。コンテナ技術（Docker, Kubernetes）の根幹を成す。

![[Pasted image 20260607211306.png]]

### 解決する問題

```
# cgroup なし：プロセスがリソースを奪い合う
プロセスA ──┐
プロセスB ──┼──→ CPU / メモリ / IO を無制限に使用
プロセスC ──┘

# cgroup あり：グループ単位でリソースを制御
[グループ1: webserver]  → CPU 最大40%、メモリ 2GB まで
  └─ nginx, php-fpm
[グループ2: database]   → CPU 最大50%、メモリ 4GB まで
  └─ postgres
```

### 主なコントローラ（サブシステム）

| コントローラ   | 制御対象                                             |
| -------------- | ---------------------------------------------------- |
| `cpu`          | CPU時間の割り当て・制限                              |
| `memory`       | メモリ使用量の制限                                   |
| `blkio` / `io` | ブロックI/Oの制御（v1は`blkio`、v2は`io`）           |
| `pids`         | プロセス数の制限                                     |
| `cpuset`       | 使用できるCPUコアの固定                              |
| `net_cls`      | ネットワークパケットへのクラスID付与（v1系の仕組み） |

---

## 2. cgroup v1

### 構造：コントローラごとに独立した階層

v1 では、基本的にコントローラごとに**別々のファイルシステム**としてマウントされる。

```bash
/sys/fs/cgroup/
├── memory/        # memory コントローラ
├── cpu,cpuacct/   # cpu コントローラ
├── blkio/         # blkio コントローラ
├── pids/          # pids コントローラ
├── devices/
├── freezer/
└── ...
```

- **複数階層（multi-hierarchy）**：サブシステムごとに**別々のマウントポイント**を持つ
- 各サブシステムは独立して動く
- プロセスが「memory グループ」と「cpu グループ」で別々のグループに属せるため、管理が複雑になる

![[Pasted image 20260607211316.png]]

### 基本操作

```bash
# グループ作成（ディレクトリ作成 = グループ作成）
mkdir /sys/fs/cgroup/memory/myapp

# メモリ上限を 256MB に設定
echo 268435456 > /sys/fs/cgroup/memory/myapp/memory.limit_in_bytes

# プロセスをグループに追加
echo <PID> > /sys/fs/cgroup/memory/myapp/tasks

# 現在の使用量確認
cat /sys/fs/cgroup/memory/myapp/memory.usage_in_bytes
```

### v1 の問題点

#### 「コンテナ」という統一エンティティとして扱いにくい

```
/memory/containerA/  → PID 100, 200 を管理
/cpu/containerA/     → PID 100, 300 を管理  ← 別階層のグループ
/pids/containerA/    → PID 200, 400 を管理
```

`memory/containerA` と `cpu/containerA` は**別々の階層上のグループ**であり、同じ `containerA` という名前でも自動的に1つの単位として扱われるわけではない。

これが引き起こす問題：

- **一貫性の保証ができない**：memoryは設定したがcpuの設定を忘れる、といったミスが起きる
- **アトミックな操作ができない**：「コンテナ削除」が複数ツリーへのバラバラな操作の寄せ集めになる
- **リソースリーク**：削除し忘れたツリーが残り続ける

#### Pod レベルのリソース管理が困難（Kubernetes の問題）

```
# Kubernetes: Pod に メモリ 1GB を割り当てたい
Pod
├── コンテナA：500MB
└── コンテナB：500MB

# v1 でも memory 階層上で Pod 全体の上限は表現できる
# ただし CPU / memory / pids などが別階層になりやすく、
# Pod を1つの統一エンティティとして扱いにくい
```

---

## 3. cgroup v2

### 設計思想：単一の統合ツリー

v2 の最大の変化は、**全コントローラが1つの階層ツリーを共有する**点。

```bash
/sys/fs/cgroup/               # マウントは1箇所だけ
├── cgroup.controllers        # 利用可能なコントローラ一覧
├── cgroup.subtree_control    # 子に委譲するコントローラ
├── memory.stat               # memory コントローラのファイル
├── cpu.stat                  # cpu コントローラのファイル
├── system.slice/             # systemd が管理するスライス
├── user.slice/
├── myapp/
│   ├── cgroup.procs          # このグループのPID
│   ├── memory.max            # メモリ上限
│   ├── cpu.max               # CPU制限
│   └── io.max                # IO制限
└── database/
    ├── cgroup.procs
    └── memory.max
```

- **単一階層（unified hierarchy）**：マウントポイントは `/sys/fs/cgroup` の**1つだけ**
- プロセスは1つの場所にしか属せない（v1の混乱を解消）
- コントローラのファイルが**同じディレクトリ内**に混在する

![[Pasted image 20260607211328.png]]

### 基本操作

```bash
# 親グループで子に委譲するコントローラを宣言
echo "+memory +cpu +io" > /sys/fs/cgroup/cgroup.subtree_control

# グループ作成
mkdir /sys/fs/cgroup/myapp

# メモリ上限設定（書式が整理された）
echo "256M" > /sys/fs/cgroup/myapp/memory.max

# CPU制限：quota/period の形式（50ms/100ms = 50%）
echo "50000 100000" > /sys/fs/cgroup/myapp/cpu.max

# プロセス追加
echo <PID> > /sys/fs/cgroup/myapp/cgroup.procs
```

### v2 で見えるファイル例

グループを作成すると、同じディレクトリに `cgroup.*`、`cpu.*`、`memory.*` などのファイルが並ぶ。

```bash
❯ ls
cgroup.controllers      cpuset.cpus.exclusive.effective  hugetlb.32MB.max           memory.peak
cgroup.events           cpuset.cpus.partition            hugetlb.32MB.numa_stat     memory.pressure
cgroup.freeze           cpuset.mems                      hugetlb.32MB.rsvd.current  memory.reclaim
cgroup.kill             cpuset.mems.effective            hugetlb.32MB.rsvd.max      memory.stat
cgroup.max.depth        dmem.current                     hugetlb.64KB.current       memory.swap.current
cgroup.max.descendants  dmem.low                         hugetlb.64KB.events        memory.swap.events
cgroup.pressure         dmem.max                         hugetlb.64KB.events.local  memory.swap.high
cgroup.procs            dmem.min                         hugetlb.64KB.max           memory.swap.max
cgroup.stat             hugetlb.1GB.current              hugetlb.64KB.numa_stat     memory.swap.peak
cgroup.subtree_control  hugetlb.1GB.events               hugetlb.64KB.rsvd.current  memory.zswap.current
cgroup.threads          hugetlb.1GB.events.local         hugetlb.64KB.rsvd.max      memory.zswap.max
cgroup.type             hugetlb.1GB.max                  io.max                     memory.zswap.writeback
cpu.idle                hugetlb.1GB.numa_stat            io.pressure                misc.current
cpu.max                 hugetlb.1GB.rsvd.current         io.prio.class              misc.events
cpu.max.burst           hugetlb.1GB.rsvd.max             io.stat                    misc.events.local
cpu.pressure            hugetlb.2MB.current              io.weight                  misc.max
cpu.stat                hugetlb.2MB.events               memory.current             misc.peak
cpu.stat.local          hugetlb.2MB.events.local         memory.events              pids.current
cpu.uclamp.max          hugetlb.2MB.max                  memory.events.local        pids.events
cpu.uclamp.min          hugetlb.2MB.numa_stat            memory.high                pids.events.local
cpu.weight              hugetlb.2MB.rsvd.current         memory.low                 pids.max
cpu.weight.nice         hugetlb.2MB.rsvd.max             memory.max                 pids.peak
cpuset.cpus             hugetlb.32MB.current             memory.min                 rdma.current
cpuset.cpus.effective   hugetlb.32MB.events              memory.numa_stat           rdma.max
cpuset.cpus.exclusive   hugetlb.32MB.events.local        memory.oom.group
```

### プレフィックスの意味

cgroup v2 では同じディレクトリにすべてのコントローラのファイルが混在する。プレフィックスでどのコントローラのファイルかを区別する。

| プレフィックス | 種別                 | 役割                                                |
| -------------- | -------------------- | --------------------------------------------------- |
| `cgroup.`      | コア（特殊）         | cgroup 階層の**構造管理**自体。リソース制御ではない |
| `cpu.`         | CPUコントローラ      | CPU 使用率・帯域の制限・重み付け                    |
| `memory.`      | メモリコントローラ   | メモリ使用量の制限・計測                            |
| `io.`          | I/Oコントローラ      | ブロックデバイスの読み書き制限                      |
| `pids.`        | PIDs コントローラ    | プロセス数の上限                                    |
| `cpuset.`      | cpuset コントローラ  | 使用するCPUコア・NUMAノードの指定                   |
| `hugetlb.`     | hugetlb コントローラ | Huge Page の制限                                    |

`cgroup.` は特殊。リソース制限ではなく、cgroup の骨格（メンバー・構造・状態）を管理する。

```
cgroup.procs            ← 所属PID一覧
cgroup.controllers      ← 利用可能なコントローラ
cgroup.subtree_control  ← 子に委譲するコントローラ
cgroup.type             ← グループ種別（domain / threaded）
cgroup.freeze           ← グループを凍結
cgroup.events           ← イベント通知
```

**すべて cgroup のファイルである**が、`cgroup.` プレフィックスのみがグループ構造管理で、他はリソースコントローラのファイル。

### subtree_control の役割

`subtree_control` に書かれたコントローラだけが子グループに伝播する。デフォルトは「何も使えない」状態。

```bash
# 親が memory と cpu だけを委譲する場合
echo "+memory +cpu" > /sys/fs/cgroup/myapp/cgroup.subtree_control

# → 子グループは memory と cpu だけを使える
# → io や pids は子グループでは使えない（明示しない限り）
```

これにより「このグループの子孫は memory と cpu だけを使える」という**委譲の連鎖**が明確になる。

### No Internal Process Constraint（重要な設計ルール）

```
子にリソースを配分する中間ノードは、自分自身にプロセスを持たない。

/sys/fs/cgroup/          ← root は例外
└── myapp/               ← 子に controller を有効化するなら PID を置かない
    ├── web/             ← PIDを置ける（リーフ）
    └── worker/          ← PIDを置ける（リーフ）
```

リソースの階層的な割り当てが明確になる。

### PSI（Pressure Stall Information）— v2 で扱いやすい機能

```bash
# メモリプレッシャーの確認
cat /sys/fs/cgroup/myapp/memory.pressure
# some avg10=0.00 avg60=0.23 avg300=0.12 total=152340
# full avg10=0.00 avg60=0.11 avg300=0.05 total=60123

# some = 一部のタスクが待たされた時間の割合
# full = 全タスクが待たされた時間の割合
```

---

## 4. v1 vs v2 比較

| 観点                   | cgroup v1                                      | cgroup v2                          |
| ---------------------- | ---------------------------------------------- | ---------------------------------- |
| **階層**               | コントローラごとに独立                         | 単一の統合ツリー                   |
| **マウント数**         | コントローラ数分                               | 1つ                                |
| **プロセス管理**       | `tasks`（スレッド単位も可）                    | `cgroup.procs`（プロセス単位）     |
| **スレッド制御**       | 混在                                           | `cgroup.threads` で明示的に分離    |
| **権限委譲**           | 困難                                           | `subtree_control` で明確           |
| **コントローラ有効化** | マウント時に決定                               | `subtree_control` で動的に制御     |
| **リソース設定書式**   | コントローラごとにバラバラ                     | 統一・整理                         |
| **PSI**                | 統一的な per-cgroup PSI はない                 | `memory.pressure` 等で利用可能     |
| **統一エンティティ**   | 扱いにくい（コントローラごとに階層が分かれる） | 扱いやすい（単一ツリーのグループ） |

### 本質的な違い

> v1：「コントローラごとのバラバラな管理」→ 1つの統一グループとして扱いにくい  
> v2：「カーネルが知っている単一のツリー」→ グループが統一エンティティとして存在する

### ファイルの対応表

v2 では `memory.xxx`、`cpu.xxx` というプレフィックスつきファイルが同じディレクトリに並ぶ。

| v1のパス                                              | v2での相当するパス                  |
| ----------------------------------------------------- | ----------------------------------- |
| `/sys/fs/cgroup/memory/<group>/memory.limit_in_bytes` | `/sys/fs/cgroup/<group>/memory.max` |
| `/sys/fs/cgroup/cpu/<group>/cpu.cfs_quota_us`         | `/sys/fs/cgroup/<group>/cpu.max`    |
| `/sys/fs/cgroup/blkio/<group>/...`                    | `/sys/fs/cgroup/<group>/io.max`     |

---

## 5. systemd・Docker・Kubernetes との関係

### systemd との連携

systemd 採用環境では、systemd が cgroup 階層を管理することが多い。近年の主要ディストリビューションでは cgroup v2 が標準になりつつある。

```bash
# サービスの cgroup 確認
systemctl status nginx
# CGroup: /system.slice/nginx.service
#         ├─1234 nginx: master process
#         └─1235 nginx: worker process

# リソース制限を systemd で設定
systemctl set-property nginx.service MemoryMax=512M CPUQuota=20%

# 手軽に試す：メモリ100MB制限でコマンド実行
systemd-run --scope -p MemoryMax=100M --user bash
```

### コンテナランタイム（Docker）での利用

```bash
# Docker 起動時のリソース制限
docker run --memory=512m --cpus=0.5 nginx

# これは内部的に以下のような cgroup を作る
/sys/fs/cgroup/
└── system.slice/
    └── docker-<container_id>.scope/
        ├── memory.max     ← --memory=512m に対応
        ├── cpu.max        ← --cpus=0.5 に対応
        └── cgroup.procs   ← コンテナ内プロセス
```

### Kubernetes との関係

```
# Pod / コンテナ階層を単一ツリーで表現できる
/sys/fs/cgroup/pod-xxx/        ← memory.max = 1GB（Pod全体の上限）
    ├── containerA/            ← memory.max = 500MB
    └── containerB/            ← memory.max = 500MB

# v2 のポイント：Pod上限とコンテナ上限を同じ階層で一貫して扱える
# v1 でも階層制限は可能だが、コントローラごとの統一管理が難しかった
```

Kubernetes が v2 を推進した主な理由：

1. **Pod 階層をカーネルレベルで表現できる**：Pod → コンテナという構造が cgroup ツリーで自然に対応する
2. **複数リソースの階層管理が一貫する**：Pod 全体の上限と各コンテナの上限を同じツリーで扱える
3. **管理の一貫性**：コントローラごとにバラバラな設定が不要になる
4. **PSI によるプレッシャー検知**：リソース枯迫の早期検知が可能になる

---

## 6. 確認方法と普及状況

### カーネルバージョン

| カーネル      | 出来事                                       |
| ------------- | -------------------------------------------- |
| 2.6.24 (2008) | cgroup v1 導入                               |
| 4.5 (2016)    | cgroup v2 導入                               |
| 5.0+          | v2 が本格的に安定                            |
| 現在          | v1/v2 のハイブリッドマウントも可能だが非推奨 |

### 現在のシステムが v1 か v2 かを確認する

```bash
stat -fc %T /sys/fs/cgroup/
# cgroup2fs → v2
# tmpfs     → v1（または混在）
```

### この環境の構成（確認結果）

```
マウント: cgroup2 on /sys/fs/cgroup type cgroup2
カーネル: 6.17.0-1014-oracle
```

**`/proc/cgroups` の `hierarchy=0`** に注目。v1ではここに `1`, `2`, `3`... と番号が振られるが、**v2では全サブシステムが `0`** = 「v1の個別階層には存在せず、v2統合階層で管理中」を意味する。

**利用可能なコントローラ:**

```
cpuset cpu io memory hugetlb pids rdma misc dmem
```

**子スライスに委譲中のコントローラ:**

```
cpuset cpu io memory pids
```

| 項目       | この環境                                        |
| ---------- | ----------------------------------------------- |
| バージョン | **cgroup v2（pure unified）**                   |
| マウント数 | 1つ（`/sys/fs/cgroup` のみ）                    |
| v1マウント | なし（`/sys/fs/cgroup/memory` 等は存在しない）  |
| 管理者     | systemd（`system.slice` / `user.slice` で管理） |
| カーネル   | 6.17系（v2がデフォルトになった世代）            |

Ubuntu 21.10以降・RHEL9以降・Debian 12以降などの比較的新しいOSはデフォルトで pure cgroup v2 になっている。技術書が古いと v1 前提の説明になっているため、ディレクトリ構成が全く異なって見える。

## 参考リンク

https://gihyo.jp/admin/serial/01/linux_containers/0037
