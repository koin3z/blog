---
title: Linux namespace
date: 2026-06-07
modified: 2026-07-23
draft: false
tags:
  - linux/namespaces
aliases:
  - memos/namespace
  - linux/namespace
description: Linux namespace が分離する資源、8種類の namespace、操作 API、コンテナとの関係を整理する。
---

## Namespace とは

Linux namespace は、カーネルが管理するグローバルな資源を抽象化し、同じ namespace に属するプロセスからは専用のインスタンスであるかのように見せる仕組みである。ある namespace 内での変更は同じ namespace のプロセスには見えるが、原則として別の namespace には見えない。

ただし、namespace は仮想マシンのようにカーネルを分離しない。プロセスは同じホストカーネルへシステムコールを発行するため、namespace だけで完全なセキュリティ境界が成立するわけではない。

> [!important]
> namespace の主な役割は資源の「見え方」と識別空間の分離である。CPU・メモリ・I/O などの使用量を制限する cgroup や、システムコールを制限する seccomp とは役割が異なる。

## 8種類の Namespace

| Namespace | 分離・仮想化するもの                                  | 詳細                                          |
| --------- | ------------------------------------------- | ------------------------------------------- |
| Mount     | マウントポイントの一覧                                 | [Mount namespace](./mount-namespace.md)     |
| PID       | プロセス ID 空間                                  | [PID namespace](./pid-namespace.md)         |
| Network   | ネットワークデバイス、プロトコルスタック、ルーティング、ポートなど           | [Network namespace](./network-namespace.md) |
| User      | UID、GID、capability など                       | [User namespace](./user-namespace.md)       |
| UTS       | ホスト名と NIS ドメイン名                             | [UTS namespace](./uts-namespace.md)         |
| IPC       | System V IPC と POSIX メッセージキュー               | [IPC namespace](./ipc-namespace.md)         |
| Cgroup    | cgroup 階層のルートの見え方                           | [Cgroup namespace](./cgroup-namespace.md)   |
| Time      | `CLOCK_MONOTONIC` と `CLOCK_BOOTTIME` のオフセット | [Time namespace](./time-namespace.md)       |

8種類の namespace は、それぞれ異なる資源を分離する独立した種別であり、互いに包含関係を持たない。

各 namespace が分離する対象を、次の図で俯瞰できる。

![[linux-namespace-mindmap.png|8種類のLinux namespaceと分離対象|760]]

## Namespace を操作する方法

カーネル API では、主に次のシステムコールを使う。

- `clone(2)` / `clone3(2)`: 子プロセスを作成すると同時に新しい namespace を作る
- `unshare(2)`: 呼び出し元を既存の実行コンテキストから分離し、新しい namespace を作る
- `setns(2)`: ファイルディスクリプタが指す既存の namespace に参加する

ただし、`unshare(2)` の細かな動作は namespace の種類によって異なる。PID namespace と Time namespace では呼び出し元自身は移動せず、その後に作成する子プロセスが新しい namespace に入る。

コマンドラインでは `unshare(1)`、`nsenter(1)`、`lsns(8)` が対応する。各プロセスが属する namespace は `/proc/<pid>/ns/` で確認できる。

```bash
ls -l /proc/self/ns
lsns
```

namespace は通常、最後の所属プロセスと最後の参照がなくなると破棄される。`/proc/<pid>/ns/<type>` を bind mount するなどして参照を保持すれば、プロセス終了後も一部の namespace を存続させられる。

## User Namespace と権限

User namespace 以外の namespace の作成には、通常、その namespace を所有する user namespace における `CAP_SYS_ADMIN` が必要である。非特権プロセスは、まず新しい user namespace を作ってその中の capability を取得し、その user namespace が所有する mount や network などの namespace を作成できる。

ここで得た capability が有効なのは、その user namespace と配下の user namespace が管理する資源に対してである。初期 user namespace が管理するホスト全体の資源に対する権限を得るわけではない。

## コンテナとの関係

コンテナランタイムは複数の namespace を組み合わせ、プロセスツリー、マウント構成、ネットワークなどを分離する。実際の隔離には、namespace 以外にも次の仕組みを組み合わせる。

- cgroup によるリソース制御
- capability の削減
- seccomp によるシステムコール制限
- SELinux、AppArmor などの LSM
- 独立した root filesystem と適切なマウント設定

どの namespace を共有するかは設定次第である。たとえば host network モードでは network namespace をホストと共有しても、PID や mount など他の namespace まで自動的に共有されるわけではない。

## 参照リンク

- [namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [unshare(1) — Linux manual page](https://man7.org/linux/man-pages/man1/unshare.1.html)
- [user_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
