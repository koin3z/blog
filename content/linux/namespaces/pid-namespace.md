---
title: PID namespace
date: 2026-06-28
modified: 2026-07-23
draft: false
tags:
  - linux/namespaces
aliases:
  - PID namespace
  - linux/namespace/pid-namespace
description: PID namespace の可視性、PID 1 の特別な動作、unshare と procfs の注意点を整理する。
---

## 概要

PID namespace はプロセス ID の番号空間を分離する。同じプロセスは、所属する PID namespace とその祖先 namespace からそれぞれ異なる PID で見えることがある。

```text
ホスト側の PID namespace       子 PID namespace

PID 43120 (bash)       <---->  PID 1 (bash)
PID 43135 (sleep)      <---->  PID 2 (sleep)
```

PID namespace は階層構造を持つ。祖先 namespace のプロセスは子孫 namespace のプロセスを見られるが、子孫 namespace のプロセスから祖先や兄弟 namespace のプロセスは見えない。

## Namespace の PID 1

新しい PID namespace で最初に作成されたプロセスは、その namespace の PID 1（init process）になる。このプロセスには特別な動作がある。

- namespace 内で親を失ったプロセスを引き取る
- 引き取った子プロセスを `wait(2)` しなければ、ゾンビが残り続ける
- 同じ PID namespace のプロセスからは、PID 1 がハンドラを登録したシグナルだけを送れる
- PID 1 が終了すると、カーネルは同じ PID namespace の残りのプロセスを `SIGKILL` で終了する
- PID 1 の終了後、その namespace に新しいプロセスを作ろうとすると `fork(2)` は `ENOMEM` で失敗する

通常のアプリケーションを PID 1 として動かす場合は、シグナル処理と子プロセスの回収を実装しているか確認する必要がある。

## `unshare --pid` だけで `Cannot fork` になる理由

```bash
sudo unshare --pid sh
# whoami
root
# whoami
sh: 2: Cannot fork
```

最初の `whoami` が PID 1 になって終了し、次の `fork(2)` が失敗するまでの因果を次の図で追える。

![[pid-namespace-unshare-lifecycle.png|unshare --pidで最初の子がPID 1となり次のforkが失敗する流れ|860]]

`unshare(2)` の `CLONE_NEWPID` は、呼び出し元自身を新しい PID namespace に移動しない。**それ以降に作る子プロセス**を新しい namespace に入れる。

この例では次の順序になる。

1. `sh` 自身は元の PID namespace に残る
2. 最初の `whoami` が新しい PID namespace の最初の子、つまり PID 1 になる
3. `whoami` が終了した時点で、その PID namespace の init process が終了する
4. 次の子を作る `fork(2)` が `ENOMEM` で失敗し、`sh` が `Cannot fork` と表示する

原因は `sh` がゾンビを回収しなかったことではなく、短命な `whoami` が namespace の PID 1 になって終了したことである。

## `--fork` と `--mount-proc`

```bash
sudo unshare --pid --fork --mount-proc bash
# echo $$
1
# ps -ef
```

`--fork` を付けると、`unshare` は子プロセスを作り、その子で指定したコマンドを実行する。この子が新しい PID namespace の最初のプロセスになるため、上の例では **`bash` 自身が PID 1** である。`unshare` が PID 1 になって `bash` を PID 2 にするわけではない。

`--mount-proc` は新しい Mount namespace も作り、新しい PID namespace に対応する procfs を `/proc` に mount する。既存の `/proc` は mount した側の PID namespace に対応しているため、PID namespace だけを作っても `ps` がホスト側の一覧を表示する場合がある。

> [!important] > `--fork` は init process を別途挿入する機能ではない。指定したコマンドを PID 1 にするだけなので、そのコマンドが子を作るなら回収責務は残る。

## コンテナの init process

コンテナのメインプロセスがシグナル処理や子プロセスの回収を適切に行わない場合、軽量な init process を PID 1 として置き、その子としてアプリケーションを動かす方法がある。Docker の `--init` はこの用途で `docker-init`（tini ベース）を使用する。

```bash
docker run --init IMAGE COMMAND
```

ただし、単一プロセスのコンテナに常に init process が必要という意味ではない。アプリケーション自身が PID 1 の挙動を理解し、必要なシグナル処理と子の回収を行えるなら追加しなくてもよい。

## 参照リンク

- [pid_namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)
- [unshare(1) — Linux manual page](https://man7.org/linux/man-pages/man1/unshare.1.html)
- [docker container run — Docker Docs](https://docs.docker.com/reference/cli/docker/container/run/)
