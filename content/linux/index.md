---
title: Linux
date: 2026-07-21
modified: 2026-07-21
draft: false
tags:
  - linux
aliases: []
description: Linux のプロセス、ファイルシステム、分離、資源制御、権限に関するメモの入口。
---

## 概念の関係

| 領域             | 役割                                             | メモ                                           |
| ---------------- | ------------------------------------------------ | ---------------------------------------------- |
| プロセス         | 実行主体の生成と置換                             | [[linux/gen-process\|Linux のプロセス生成]]    |
| ファイルシステム | ファイルシステムやディレクトリツリーをパスへ接続 | [[linux/mount\|Mount]]                         |
| 資源の見え方     | プロセスから見える識別空間や資源を分離           | [[linux/namespaces/index\|Linux Namespace]]    |
| 資源の使用量     | CPU、メモリ、I/O、プロセス数をグループ単位で制御 | [[linux/cgroup\|cgroup]]                       |
| 特権             | root 権限を操作単位へ分割                        | [[linux/capability\|Linux Capability]]         |
| ファイル権限     | setuid、setgid、sticky bit による実行・共有条件  | [[linux/permission\|Linux 特殊パーミッション]] |
| 仮想化           | ゲストOSと仮想ハードウェアをホスト上で実行する   | [[linux/qemu-kvm\|QEMU/KVMの役割分担]]         |

## コンテナとの関係

- [[containers/index|コンテナ]]は Namespace、cgroup、Capability、Mount などの Linux 機能を組み合わせる
- 各機能は分離する対象が異なるため、コンテナの境界を1つの機能だけで説明しない
