---
title: User namespace
date: 2026-06-28
modified: 2026-07-23
draft: false
tags:
  - linux/namespaces
aliases:
  - USER namespace
  - linux/namespace/user-namespace
description: User namespace の UID・GID マッピング、capability の有効範囲、他の namespace との関係を整理する。
---

## 概要

User namespace は UID、GID、capability など、権限に関係する識別子と属性を分離する。同じプロセスを namespace の内側では UID 0、外側では一般ユーザーの UID として扱える。

```text
User namespace 内          親 User namespace

UID 0 (root)       <---->  UID 1000 (一般ユーザー)
```

内側の UID 0 は、その User namespace が管理する資源に対して capability を持てる。しかし、初期 User namespace が管理するホスト全体の資源に対する root 権限を得るわけではない。

## UID / GID マッピング

マッピングは `/proc/<pid>/uid_map` と `/proc/<pid>/gid_map` に記録される。1行は次の3フィールドで構成される。

```text
<namespace 内の開始 ID> <親 namespace の開始 ID> <範囲の長さ>
```

たとえば次の行は、内側の UID 0 を親側の UID 1000 に1件だけ対応付ける。

```text
0 1000 1
```

マッピングファイルへの書き込みは1回だけで、書き込める ID 範囲や必要な capability に制約がある。非特権ユーザーが複数の subordinate ID を割り当てる場合は、`/etc/subuid`、`/etc/subgid` と `newuidmap(1)`、`newgidmap(1)` を使う。

> [!warning] > `sudo echo '...' > /proc/<pid>/uid_map` では、通常はリダイレクトを行うシェルに `sudo` が適用されない。手作業での競合しやすい書き込みより、`unshare` のマッピングオプションや `newuidmap` / `newgidmap` を使う方が安全である。

## `unshare` で確認する

マッピングを作らずに新しい User namespace へ入ると、ID は未マッピングになる。ユーザー空間からは overflow UID / GID（多くの環境では 65534）として見えることがある。

```bash
unshare --user bash
id
```

現在の実効 UID / GID を内側の root に対応付けるには、`--map-root-user` を使う。

```bash
unshare --user --map-root-user bash
id
cat /proc/self/uid_map
cat /proc/self/gid_map
```

外側が UID / GID 1000 なら、典型的には次のように表示される。

```text
         0       1000          1
```

非特権 User namespace の作成をカーネルがサポートしていても、ディストリビューションの sysctl や LSM、コンテナ環境のポリシーによって禁止・制限されている場合がある。

## Capability の有効範囲

プロセスは新しい User namespace を作ると、その namespace 内で一式の capability を得る。ただし `execve(2)` の際に capability が再計算されるため、内側で UID 0 にマッピングしない場合などは capability を失うことがある。

capability は、それを持つ User namespace が所有する資源に対して有効である。たとえば新しい User namespace を先に作り、その User namespace が所有する Mount namespace や Network namespace を作れば、内側の `CAP_SYS_ADMIN` や `CAP_NET_ADMIN` で一部の mount やネットワーク設定を行える。

内側と外側の UID 対応と、capability が及ぶ資源の境界を次の図で確認できる。

![[user-namespace-identity-authority.png|User namespaceのUID対応とcapabilityが及ぶ所有資源の範囲|780]]

```bash
unshare --user --map-root-user --mount --net bash
```

一方、カーネルモジュールのロードなど、初期 User namespace の権限を要求する操作は実行できない。User namespace 内の root とホストの root は同じ権限ではない。

## ファイルアクセスと Bind Mount

ファイルアクセス時には、プロセスの UID / GID が初期 User namespace の ID に変換されて権限チェックされる。内側で root に見えても、外側にマッピングされた UID / GID が対象ファイルへアクセスできなければ操作できない。

ただし、常に「内側の root = 外側の UID 1000」とは限らない。Docker の rootless mode ではそのような対応が使われる一方、Docker の `userns-remap` では内側の UID 0 を `/etc/subuid` の高い UID へ対応付ける。Bind Mount の所有者表示や書き込み可否は、実際のマッピング方式に依存する。

低位ポートへの bind 可否も、単純に外側の UID だけでは決まらない。`CAP_NET_BIND_SERVICE` がどの User namespace で有効か、対象の Network namespace をどの User namespace が所有するか、`net.ipv4.ip_unprivileged_port_start` の値などで決まる。

## セキュリティ上の位置付け

User namespace は、コンテナ内 root の権限をホスト側で非特権 ID に変換し、侵害時の影響を抑える。ただし、それだけで安全になるわけではない。User namespace 内のプロセスも同じカーネルへシステムコールを発行するため、capability の削減、seccomp、LSM、適切な mount 設定などと組み合わせる。

## 参照リンク

- [user_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
- [capabilities(7) — Linux manual page](https://man7.org/linux/man-pages/man7/capabilities.7.html)
- [unshare(1) — Linux manual page](https://man7.org/linux/man-pages/man1/unshare.1.html)
- [UID/GID mapping — Docker Docs](https://docs.docker.com/engine/security/rootless/uid-gid-mapping/)
