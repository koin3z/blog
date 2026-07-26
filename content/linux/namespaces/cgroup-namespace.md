---
title: Cgroup namespace
date: 2026-06-28
modified: 2026-07-23
draft: false
tags:
  - linux/namespaces
aliases:
  - cgroup namespace
  - linux/namespace/cgroup-namespace
description: Cgroup namespace が cgroup 階層の見え方を仮想化する仕組みと、cgroup 本体との違いを整理する。
---

## 概要

Cgroup namespace は、プロセスから見える cgroup パスを仮想化する。リソースの制限や計測を行う cgroup 本体とは別の機能である。

| 機能             | 役割                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| cgroup           | プロセスを階層化し、CPU・メモリ・I/O・プロセス数などを制御・計測する               |
| Cgroup namespace | `/proc/<pid>/cgroup` と `/proc/<pid>/mountinfo` に現れる cgroup ルートを相対化する |

Cgroup namespace を作成した時点で、作成プロセスが所属している cgroup ディレクトリが、新しい namespace の cgroup ルートになる。この動作は cgroup v1 と v2 の両方に適用される。

## パスの見え方

たとえば、プロセスがホスト上では次の cgroup に所属しているとする。

```text
/user.slice/user-1000.slice/session-3.scope
```

この位置で Cgroup namespace を作成すると、namespace 内のプロセス自身には所属先が `/` と表示される。

```text
# namespace 作成前（cgroup v2 の例）
0::/user.slice/user-1000.slice/session-3.scope

# namespace 内
0::/
```

同じ cgroup 制御の実体に対して、ホスト側の完全なパスと namespace 内の相対パスがどのように対応するかを次の図で確認できる。

![[cgroup-namespace-path-view.png|Cgroup namespaceによるパスの相対化と変わらない制御実体|780]]

表示は namespace のルートからの相対パスである。読み取り対象のプロセスがそのルートより外側にいる場合、`/proc/<pid>/cgroup` には `../` を含むパスが表示されることがある。

```bash
cat /proc/self/cgroup
sudo unshare --cgroup bash
cat /proc/self/cgroup
```

実際の出力は、systemd の構成、cgroup のバージョン、実行時の所属 cgroup によって異なる。作成前から cgroup ルートにいる場合は変化が見えない。

## `/sys/fs/cgroup` との関係

Cgroup namespace を作っただけでは、すでに mount されている `/sys/fs/cgroup` の見え方が必ずしも新しいルートに切り替わるわけではない。既存の cgroup filesystem の mount は、mount を行った側の Cgroup namespace に対応しているためである。

コンテナから祖先 cgroup を見えなくするには、通常は Mount namespace も分離し、新しい Cgroup namespace の中から cgroup filesystem を適切に mount する。これにより、情報漏えいの抑制だけでなく、書き込み可能な祖先 cgroup へのアクセス防止にもつながる。

> [!note]
> Cgroup namespace を破棄しても cgroup 本体やそのリソース制限は削除されない。変わるのは cgroup 階層のビューであり、制御の実体ではない。

## 参照リンク

- [cgroup_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/cgroup_namespaces.7.html)
- [cgroups(7) — Linux manual page](https://man7.org/linux/man-pages/man7/cgroups.7.html)
- [Control Group v2 — Linux kernel documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html)
