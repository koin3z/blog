---
title: Linux Capability
date: 2026-06-07
modified: 2026-07-21
draft: false
tags:
  - linux/security
aliases:
  - Linux Capabilities
  - memos/capability
description: Linux Capability の基本、setuid root との違い、ping のファイルケイパビリティ、プロセス上の確認方法を整理する。
---

## 1. なぜ Capability が必要か

### setuid root の問題点

setuid root は「必要な権限だけを与える」という**最小権限の原則**に違反している。

```
passwd が本当に必要な権限：
  → /etc/shadow への書き込みだけ

setuid root で実際に持つ権限：
  → ネットワーク設定の変更
  → 任意のファイルの削除
  → 新しいプロセスの起動
  → ... root の全権限 😱
```

### 最小権限の原則（Principle of Least Privilege）

> 「必要な権限だけを与えるべき」

---

## 2. Capability とは

Linux の root 権限を**細かく分割したもの**。

```
root という巨大な権限カード
         ↓
細かく分割
         ↓
必要な権限だけを付与できる
```

### 代表的な Capability

| Capability             | 意味                                     |
| ---------------------- | ---------------------------------------- |
| `CAP_CHOWN`            | ファイルのオーナーを変更できる           |
| `CAP_DAC_OVERRIDE`     | 通常のファイルパーミッションを無視できる |
| `CAP_NET_BIND_SERVICE` | 1024番以下のポートをバインドできる       |
| `CAP_NET_RAW`          | 生のネットワークパケットを扱える         |
| `CAP_SYS_REBOOT`       | システムを再起動できる                   |

---

## 3. 3つの集合

Capability には3つの「集合」がある。

| 集合            | 意味                                       |
| --------------- | ------------------------------------------ |
| **Permitted**   | 使っていいよと許可された権限の「引き出し」 |
| **Effective**   | 今この瞬間、実際にオンになっている権限     |
| **Inheritable** | 子プロセスに渡していい権限                 |

### Permitted と Effective の関係

プログラムが自分で必要な瞬間だけ権限をオン・オフできる。

```
setuid root:
  実行開始 ──────────────────────── 終了
  |← root 権限ずっとオン →|

capability:
  実行開始 ── 通常 ──[オン]── 特権処理 ──[オフ]── 通常 ── 終了
                      ↑                    ↑
                   自分で上げる          自分で下げる
                  （raise）              （drop）
```

### Inheritable の役割

Permitted に持っていても Inheritable に入れていない capability は子プロセスに渡らない。つまり**子プロセスへの継承を細かく制御できる**。

```
親プロセス:
  Permitted    = {CAP_NET_RAW, CAP_DAC_OVERRIDE}
  Effective    = {CAP_NET_RAW}
  Inheritable  = {CAP_NET_RAW}          ← これだけ子に渡る

子プロセス（exec後）:
  Permitted    = {CAP_NET_RAW}          ← DAC_OVERRIDE は渡らない
  Effective    = {}
  Inheritable  = {CAP_NET_RAW}
```

---

## 4. ping で見るファイルケイパビリティ

### ping に setuid がついていない理由

`ping` は ICMP（生のネットワークパケット）を扱うため、かつては setuid root だった。現代の Linux では setuid を使わず、**ファイルケイパビリティ**で `CAP_NET_RAW` だけを付与する方式に移行している。

```
昔（setuid root）:
  ping 実行中 = root の全権限 😱

今（capability）:
  ping 実行中 = CAP_NET_RAW だけ ✅
```

```bash
$ ls -l /usr/bin/ping
-rwxr-xr-x 1 root root 146992 Jul 24 2025 /usr/bin/ping

$ getcap /usr/bin/ping
/usr/bin/ping cap_net_raw=ep
```

`ping` が必要とするのは、ICMP パケット送信のための RAW ソケット作成権限（`CAP_NET_RAW`）だけ。Linux カーネル 2.2 以降、setuid の代わりに細粒度のケイパビリティ機構が使える。

### `cap_net_raw=ep` のフラグ意味

| フラグ | 名称                  | 意味                                             |
| ------ | --------------------- | ------------------------------------------------ |
| `e`    | Effective（有効）     | プロセス実行時に即座にケイパビリティが有効になる |
| `p`    | Permitted（許可済み） | プロセスがそのケイパビリティを持てる状態         |
| `i`    | Inheritable           | `execve` 後も子プロセスに引き継がれる            |

`ep` 両方が付いているので、`ping` 起動時に `cap_net_raw` がすぐ使える状態になる。

### setuid vs ケイパビリティ

| 方式                | 付与される権限      | リスク                 |
| ------------------- | ------------------- | ---------------------- |
| setuid root（旧来） | root 権限すべて     | 脆弱性があると完全侵害 |
| cap_net_raw（現代） | RAWソケット作成のみ | 最小権限の原則         |

### `cp` するとケイパビリティが消える

```bash
$ cp /usr/bin/ping ./myping
$ getcap ./myping
# 何も出力されない → ケイパビリティなし
```

`cp` はセキュリティ上の理由でケイパビリティを引き継がない。

引数なしで `./myping` を実行すると引数チェックで終了するため気づきにくいが、`./myping localhost` のように実行すると RAW ソケット作成に失敗する。

### ケイパビリティを付与・削除する方法

```bash
# 付与（root 権限が必要）
sudo setcap cap_net_raw=ep ./myping

# 確認
getcap ./myping
# ./myping cap_net_raw=ep

# 削除
sudo setcap -r ./myping
```

---

## 5. setuid と ps の表示（RUID vs EUID）

`myping` に setuid + root 所有者を設定しても `ps` には起動ユーザーが表示される。

```bash
$ ps uf -C myping
USER PID ...
koin3z 470913 ... ← RUID（起動者）が表示される
```

### UID の種類

| UID 種別 | 英語名        | setuid 実行時の値    | 意味                             |
| -------- | ------------- | -------------------- | -------------------------------- |
| **RUID** | Real UID      | koin3z（変わらない） | プロセスを起動したユーザー       |
| **EUID** | Effective UID | root（変わる）       | カーネルの権限チェックで使われる |
| **SUID** | Saved UID     | root                 | 一時的に権限を落としても戻れる値 |

`ps` はデフォルトで **RUID** を表示するため `koin3z` に見えるが、実際の権限チェックは EUID=root で行われる。

### RUID と EUID を両方確認する

```bash
ps -o pid,ruid,euid,user,euser -C myping
# PID RUID EUID USER EUSER
# 12345 1000 0 koin3z root
```

### strace による確認

EUID=root で動作していれば RAW ソケット操作が EPERM なしで成功する。

```
sendto(3, ..., {sa_family=AF_INET, ...}) = 64 ← エラーなし = 権限あり
```

---

## 6. 確認コマンドと出力の読み方

### プロセス・ファイルの確認

```bash
# プロセスの capability を確認
cat /proc/self/status | grep Cap

# 現在のシェルの capability を確認
cat /proc/$$/status | grep Cap

# ファイルに設定された capability を確認
getcap /usr/bin/ping

# capsh で16進表記をデコード
capsh --decode=<hex>

# 利用可能なケイパビリティ一覧
man capabilities
```

### getpcaps の出力の読み方

```bash
getpcaps <PID>
```

| 出力例           | 意味                                                        |
| ---------------- | ----------------------------------------------------------- |
| `=`              | ケーパビリティなし（一般ユーザープロセス）                  |
| `cap_net_raw=ep` | RAW ソケットのみ有効                                        |
| `=ep`            | **全ケーパビリティが Effective + Permitted（= root 相当）** |

`=ep` の読み方：

- `=` の左側が空 → 特定の capability ではなく**全部**を指す
- `e` = Effective（即時有効）、`p` = Permitted（許可済み）

`sudo bash` などで root シェルを起動したプロセスは `=ep` になる。

---

## 7. まとめ

```
setuid root → 巨大な権限カードをまるごと渡す　（最小権限の原則に違反）
capability  → 必要な権限だけを細かく渡す　　　（最小権限の原則に準拠）

Permitted   → 使っていい権限の引き出し
Effective   → 今この瞬間オンになっている権限
Inheritable → 子プロセスに渡せる権限

ping        → CAP_NET_RAW だけで RAW ソケットを扱う
```
