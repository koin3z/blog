---
title: mount
date: 2026-06-28
modified: 2026-06-28
draft: false
tags:
  - linux/filesystems
description: Linux のマウント、バインドマウント、mount namespace、確認コマンドを整理する。
---

## 概要

マウントは、ファイルシステムや既存のディレクトリツリーを、Linux のディレクトリツリー上の特定の場所に接続する操作。接続先のディレクトリを**マウントポイント**と呼ぶ。

Linux では、ディスクや疑似ファイルシステムをドライブ文字で区別せず、すべて `/` を起点とする1つのディレクトリツリーに配置する。

![[attachments/mount-before-after.svg|676]]

| 用語                 | 内容                                                 |
| -------------------- | ---------------------------------------------------- |
| ソース               | デバイス、ファイルシステム、または既存のディレクトリ |
| マウントポイント     | ソースを接続するディレクトリ                         |
| ファイルシステム種別 | `ext4`、`xfs`、`proc`、`tmpfs` など                  |
| マウントオプション   | `ro`、`rw`、`nosuid`、`noexec` など                  |
この記事全体で扱う概念の位置づけは次の通り。

  

![[attachments/mount-overview.svg|717]]

## マウント状態の確認

`findmnt` は、現在の mount namespace から見えるマウントの対応関係を表示する。

```text
TARGET   SOURCE     FSTYPE   OPTIONS
/        /dev/sda1  ext4     rw,relatime,...
/dev     udev       devtmpfs rw,nosuid,...
/proc    proc       proc     rw,nosuid,...
```

この出力は、次の対応関係を示す。

- `/dev/sda1` 上の `ext4` ファイルシステムが `/` にマウントされている
- `devtmpfs` が `/dev` にマウントされている
- `proc` 疑似ファイルシステムが `/proc` にマウントされている

主な確認コマンドは次のとおり。

```bash
# マウント全体をツリー表示
findmnt

# 指定したパスを含むマウントを確認
findmnt --target /proc

# カーネルが保持するマウント情報を確認
cat /proc/self/mountinfo
```

## バインドマウント

バインドマウントは、既存のディレクトリツリーを別のパスにも公開するマウント。同じファイルへ複数のパスからアクセスでき、ファイルのコピーは発生しない。

```text
bind mount なし                    bind mount あり

source/HELLO                       source/HELLO ──┐
target/  (空)                                       ├─ 同じ実体を参照
                                    target/HELLO ──┘

# source 側での変更 ⇄ target 側への変更が相互に反映される
```

```bash
mkdir source target
touch source/HELLO

sudo mount --bind source target
ls target
# HELLO

findmnt --target target
sudo umount target
```


この例では、`source/HELLO` と `target/HELLO` が同じファイルを参照する。`target` 側で行った変更は `source` 側にも反映される。仕組みとして見ると、両方のパスが同じ実体(inode)を指しているだけで、データそのものは1つしか存在しない。

![[attachments/bind-mount-inode.svg|717]]

### コンテナでの利用

Docker の bind mount は、ホスト上のディレクトリをコンテナ内のパスに公開する。

```bash
docker run \
  --mount type=bind,src=/home/user/data,dst=/app/data \
  IMAGE
```

短縮記法では次のように指定する。

```bash
docker run -v /home/user/data:/app/data IMAGE
```

どちらも、ホストの `/home/user/data` をコンテナ内の `/app/data` から参照可能にする。書き込み可能な bind mount ではコンテナからホスト側のファイルを変更できるため、不要な書き込みを防ぐ場合は `readonly` または `:ro` を指定する。

![[attachments/docker-bind-mount.svg|717]]

## mount namespace

mount namespace は、プロセスから見えるマウント構成を分離する Linux namespace。各プロセスは1つの mount namespace に属し、同じ namespace に属するプロセスは同じマウント構成を参照する。

```text
mount
  ファイルシステムやディレクトリを、ツリー上のパスに接続する

mount namespace
  プロセスから見えるマウント構成を分離する
```

`unshare --mount` は、現在の構成を初期状態として新しい mount namespace を作成する。

```bash
sudo unshare --mount /bin/bash
```

新しい namespace 内で追加または削除したマウントは、原則として元の namespace には反映されない。ただし、`shared` などのマウント伝播設定によっては namespace 間で変更が伝播する。`unshare` は通常、意図しない伝播を防ぐため新しい namespace の伝播設定を `private` に変更する。

![[attachments/mount-namespace-isolation.svg|717]]

マウント操作と mount namespace の作成には、対象の user namespace における `CAP_SYS_ADMIN` が必要になる。

### PID namespace と `/proc`

`/proc` はディスク上のデータではなく、カーネルがプロセスなどの情報を公開する疑似ファイルシステム。PID namespace だけを作成しても、既存の `/proc` を参照している限り、`ps` の表示は適切に分離されない。

PID namespace と mount namespace を作成し、その PID namespace に対応する `proc` をマウントする必要がある。

![[attachments/pid-namespace-proc.svg|717]]


```bash
sudo unshare --pid --mount --fork --mount-proc /bin/bash
ps -ef
```

`--mount-proc` は、新しい mount namespace の `/proc` に `proc` をマウントする。これにより、`ps` は新しい PID namespace から見えるプロセスを基準に表示する。

## `lsblk` と `findmnt` の違い

`lsblk` と `findmnt` は対象とする情報が異なる。

| コマンド  | 主な対象         | 確認できる内容                                                   |
| --------- | ---------------- | ---------------------------------------------------------------- |
| `lsblk`   | ブロックデバイス | ディスク、パーティション、LVM、デバイスマッパーなどの構成        |
| `findmnt` | マウント         | ソースとマウントポイントの対応、ファイルシステム種別、オプション |
| `mount`   | マウント         | マウント操作と、現在のマウント一覧の表示                         |

`lsblk` の出力例は次のとおり。

```text
NAME        MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda           8:0    0  100G  0 disk
├─sda1        8:1    0   50G  0 part /
├─sda15       8:15   0  100M  0 part /boot/efi
└─sda16       8:16   0  500M  0 part /boot
```

`lsblk` は `sda` とそのパーティションの構成を示し、`MOUNTPOINT` 列に現在のマウント先を補助情報として表示する。一方、`findmnt` は次のようにマウントの対応関係を中心に表示する。

```text
TARGET     SOURCE      FSTYPE
/          /dev/sda1   ext4
/boot/efi  /dev/sda15  vfat
/boot      /dev/sda16  ext4
/proc      proc        proc
```

両者が対象とする範囲を重ねて見ると、次のようになる。

![[attachments/lsblk-vs-findmnt.svg|717]]

`proc`、`devtmpfs`、`tmpfs`、`cgroup2` などはブロックデバイスではないため、通常は `lsblk` の対象にならない。バインドマウントも新しいブロックデバイスを作成しないため、`lsblk` ではなく `findmnt` で確認する。

## 要点

- マウントは、ファイルシステムやディレクトリツリーを特定のパスに接続する操作
- バインドマウントは、既存のディレクトリツリーを別のパスにも公開する
- mount namespace は、プロセスから見えるマウント構成を分離する
- PID namespace 内のプロセス表示を分離するには、対応する `/proc` のマウントが必要
- ブロックデバイスの構成は `lsblk`、マウントの対応関係は `findmnt` で確認する
