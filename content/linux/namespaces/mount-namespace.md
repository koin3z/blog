---
title: Mount namespace
date: 2026-06-28
modified: 2026-07-23
draft: false
tags:
  - linux/namespaces
aliases:
  - MNT namespace
  - linux/namespace/mount-namespace
description: Mount namespace がマウント構成を分離する仕組み、伝播設定、procfs との関係を整理する。
---

## 概要

Mount namespace は、プロセスから見えるマウントポイントの一覧を分離する。新しい Mount namespace は作成元のマウント一覧のコピーから始まり、その後の `mount(2)` / `umount(2)` による変更は、マウント伝播の設定を除いて別の namespace には影響しない。

分離されるのはマウント構成であり、ファイルシステム上のデータそのものが自動的に複製されるわけではない。同じファイルシステムを複数の namespace から mount すれば、同じデータへアクセスできる。

## Bind Mount の確認

Bind mount は、既存のディレクトリやファイルを別のパスにも表示する。同じ実体への別の到達経路を作る操作であり、シンボリックリンクとは異なる。

```bash
sudo mkdir -p /tmp/ns-source /tmp/ns-target
sudo touch /tmp/ns-source/HELLO
sudo unshare --mount bash

mount --bind /tmp/ns-source /tmp/ns-target
findmnt /tmp/ns-target
ls /tmp/ns-target
# HELLO
```

util-linux の `unshare(1)` は、通常、新しい Mount namespace のマウントを再帰的に `private` にする。そのため、この例の bind mount は元の namespace からは見えず、シェルを終了して namespace への最後の参照がなくなると暗黙に unmount される。作成した `/tmp/ns-source` や `/tmp/ns-target` のディレクトリ自体は残る。

## マウント伝播

mount / unmount イベントが namespace 境界を越える方向は、各 mount の伝播種別ごとに次の図で比較できる。

![[mount-namespace-propagation.png|shared、private、slave、unbindableのマウント伝播方向|780]]

Mount namespace を作れば、あらゆる変更が無条件に隔離されるわけではない。各 mount には伝播種別がある。

| 伝播種別     | 動作                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `shared`     | 同じ peer group の mount 間で mount / unmount イベントを相互に伝播する |
| `private`    | イベントを送受信しない                                                 |
| `slave`      | master 側から受信するが、逆方向には伝播しない                          |
| `unbindable` | `private` と同様で、さらに bind mount の対象にできない                 |

```bash
findmnt -o TARGET,PROPAGATION /
```

`unshare --mount --propagation unchanged` を指定すると既存の伝播設定を維持するため、`shared` な親 mount の下で行った変更が別の namespace へ伝播する可能性がある。

## `findmnt` と `/proc`

`findmnt` は通常、`/proc/self/mountinfo` などを使い、**実行したプロセスが属する Mount namespace** のマウント構成を表示する。ホストの全マウントを無条件に表示するわけではない。`/proc/<pid>/mountinfo` を明示的に読める場合は、その `<pid>` が属する Mount namespace の構成を確認できる。

一方、PID namespace 内で `ps` に正しいプロセス一覧を表示させるには、その PID namespace に対応する procfs が必要である。`unshare --pid --fork --mount-proc` は、新しい Mount namespace も作り、`/proc` を適切に mount する。この話は Mount namespace の情報漏えいではなく、procfs が mount 時の PID namespace に対応付くために必要となる。

## `chroot` との違い

`chroot(2)` はプロセスのルートディレクトリを変更するが、マウント一覧は分離しない。また、特権プロセスを閉じ込めるためのセキュリティ機構として設計されたものではない。コンテナでは Mount namespace に加え、`pivot_root(2)` や `chroot(2)`、root filesystem、User namespace などを組み合わせてファイルシステムのビューを構成する。

## 権限

Mount namespace の作成や多くの mount 操作には、その Mount namespace を所有する User namespace における `CAP_SYS_ADMIN` が必要である。非特権ユーザーでも、環境が User namespace の作成を許可していれば、次のように新しい User namespace 内の root へマッピングして一部の mount 操作を試せる。

```bash
unshare --user --map-root-user --mount bash
```

User namespace 内から mount できる filesystem の種類や、既存 mount に対して変更できる属性には制限がある。

## 参照リンク

- [mount_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/mount_namespaces.7.html)
- [unshare(1) — Linux manual page](https://man7.org/linux/man-pages/man1/unshare.1.html)
- [user_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
