---
title: Docker
date: 2025-11-21
modified: 2026-07-21
draft: false
tags:
  - containers/docker
aliases:
  - memos/containers/docker
  - containers/docker-cli
  - memos/containers/docker-cli
  - containers/docker-container
  - memos/containers/docker-container
  - containers/docker-image
  - memos/containers/docker-image
  - containers/docker-network
  - memos/containers/docker-network
  - containers/docker-volume
  - memos/containers/docker-volume
description: Docker Engine、Image、Registry、Container、CLI と Linux の基盤機能の関係を整理する。
---

## Docker とは

> コンテナ仮想化を用いて[アプリケーション](https://ja.wikipedia.org/wiki/%E3%82%A2%E3%83%97%E3%83%AA%E3%82%B1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%82%BD%E3%83%95%E3%83%88%E3%82%A6%E3%82%A7%E3%82%A2 "アプリケーションソフトウェア")を開発・配置・実行するためのオープンプラットフォーム
> https://ja.wikipedia.org/wiki/Docker

## Docker Engine

- 主に次の3つのコンポーネントから成るクライアント・サーバー型のアプリケーション

  - **デーモン**（サーバー）
  - **API**（インターフェース）
  - **CLI**（クライアント）

- デーモン
  - Dockerオブジェクトを作成・管理する
  - Dockerオブジェクトには以下のようなものがある
    - Image
    - Container
    - Network
    - Data Volume
  - ユーザーは直接デーモンとは対話せず，Dockerクライアントを通して行う
  - 内部構造はモジュール化されている
    - **dockerd**（デーモン）：ユーザーからの命令を受け付ける
      - イメージを検索し準備する
    - **containerd**（コンテナランタイム）：コンテナのライフサイクルを管理
      - コンテナを作成し，コンテナ環境を設定
      - 実行はruncに委任
    - **runc**：実際にコンテナを生成する低レベルなツール

![[Pasted image 20251121222610.png]]

- API
  - プログラムがデーモンと通信する際に使用する
  - REST API
- CLI
  - Docker REST API もしくは CLI コマンドによって，Dockerデーモンを制御または対話する

## アーキテクチャ

- Docker はクライアント・サーバー型のアーキテクチャとなっている
- Docker クライアントとデーモンはお互いにソケットまたはRESTful APIを経由して通信する
  - この2つは同じシステム上で動作することが可能
  - または，リモートのDockerデーモンに接続することもできる

![[Pasted image 20251121212207.png]]

- Dockerを構成する要素は次の3つがある

  - **Docker Image**
  - **Docker Registry**
  - **Docker Container**

- Docker Image
  - Docker Containerを作成する際に使用する，構築 (**build**) のためのテンプレート
  - ReadOnly
- Docker Registry
  - Docker Imageを保管し，他人とイメージを共有する，配布 (**distoribution**) のための場
  - パブリックまたはプライベートに保管が可能
  - 主要なパブリックレジストリとして，Docker hubがある
- Docker Container
  - アプリケーションの実行に必要なすべてを含む，実行 (**run**) するためのコンポーネント
  - 各コンテナは分離されたアプリケーションのプラットフォームとなる

### Docker Image

- Imageはレイヤのスタックで構成されている
- Docker では UnionFS（ユニオン・ファイルシステム）を使用
  - レイヤを単一のイメージに連結する
- UnionFS はブランチとしても知られ，透過的な重ね合わせ (overlaid) と，互いに密着した (coherent) ファイルシステムを形成する
  - 散らばったファイルを一つのディレクトリのもとに統合して実行することができる
- Dockerイメージに変更加えた際，新しいレイヤを構築する

  - つまり，イメージの完全な入れ替えではなく，単純にレイヤを追加するか更新するだけになる

- イメージはベース・イメージ (base image) から作成される
- このベース・イメージから命令 (instructions) と呼ばれる構築手順を記し，イメージを独自に作成することができる
  - この構築手順は `Dockerfile` というファイルで記述することができる
- ここに記載した各命令ごとにレイヤがイメージ上に作成され，次のような動作をする
  - コマンドの実行
  - ファイルやディレクトリの追加
  - 環境変数の作成
  - コンテナ起動時に実行するプロセスの指定

### Docker Registry

- Dockerイメージを保管
- Dockerクライアントから効果済みのイメージを検索，イメージを取得 (pull) することもできる
- Docker Hubではイメージの保管するストレージの可視性として，パブリックとプライベートの両方をサポートしている

### Docker Container

- コンテナには次のものが含まれる
  - OSのファイルシステム
  - ユーザーが追加したファイル
  - メタデータ
- コンテナはイメージから構築され，コンテナ起動時に中身や実行すべきプロセスをDockerに確認する
- DockerイメージはReadOnlyのため，コンテナを実行する際，読み書きできるレイヤをイメージ上に追加し，アプリケーションを実行する

  - この仕組みは「Copy on Write」と呼ばれる
  - 元のイメージを汚さないままに変更が可能となり，さらにディスク容量を節約できる

- Dockerコンテナを実行する際，処理としては以下の内容が行われる

```bash
docker container run -i -t ubuntu /bin/bash
```

1. ubuntuイメージの取得
   - ubuntuイメージの存在を確認し，なければDocker Hubからダウンロード
2. 新しいコンテナを作成
   - イメージを使いコンテナを作成
3. ファイルシステムを割り当て，読み書き可能なレイヤをマウント
   - コンテナを新しいファイルシステム上に作成，読み書き可能なレイヤをイメージに追加
4. ネットワークとブリッジインターフェースの割当
   - コンテナがローカルホストと通信できるようにするため，ネットワークインターフェースを作成
5. IPアドレスを追加
   - プールされている範囲内で利用可能なIPアドレスを探し，コンテナに追加
6. アプリケーションの出力を収集，表示
   - コンテナに接続し，アプリケーションを実行
   - 標準入力・標準出力・エラーを記録，表示する

## Docker CLI

### `docker container`

```text
→ docker container --help
Usage:  docker container COMMAND

Manage containers

Commands:
  attach      Attach local standard input, output, and error streams to a running container
  commit      Create a new image from a container's changes
  cp          Copy files/folders between a container and the local filesystem
  create      Create a new container
  diff        Inspect changes to files or directories on a container's filesystem
  exec        Execute a command in a running container
  export      Export a container's filesystem as a tar archive
  inspect     Display detailed information on one or more containers
  kill        Kill one or more running containers
  logs        Fetch the logs of a container
  ls          List containers
  pause       Pause all processes within one or more containers
  port        List port mappings or a specific mapping for the container
  prune       Remove all stopped containers
  rename      Rename a container
  restart     Restart one or more containers
  rm          Remove one or more containers
  run         Create and run a new container from an image
  start       Start one or more stopped containers
  stats       Display a live stream of container(s) resource usage statistics
  stop        Stop one or more running containers
  top         Display the running processes of a container
  unpause     Unpause all processes within one or more containers
  update      Update configuration of one or more containers
  wait        Block until one or more containers stop, then print their exit codes

Run 'docker container COMMAND --help' for more information on a command.
```

## 使用される技術

- Dockerはカーネルが持つ機能を利用している

### namespaces

- コンテナと呼ぶ作業空間の分離を行う
- コンテナごとにnamespaceを作成し，そこから外にはアクセスできないように見えることで，レイヤの分離を実現している

- Dockerが使用する，Linux上のnamespacesとしては次のものがある

- **pid**
  - プロセスの分離に使用
  - PID：Process ID
- **net**
  - ネットワークインターフェースの管理に使用
  - NET：Networking
- **ipc**
  - IPCリソースに対するアクセス管理に使用
  - IPC：InterProcessCommunication（内部プロセスの通信）
- **mnt**
  - マウント・ポイントの管理
  - MNT：Mount
- **uts**
  - カーネルとバージョン認識の隔離
  - UTS：Unix Timesharing System

### cgroup

- cgroup（コントロールグループ）と呼ばれる，自身が必要なリソースのみを分離する技術
- ホスト上に複数のユーザーがいたとしてもコンテナを使用することができる
- また，コンテナに対して利用可能なハードウェアリソースを共有し，必要に応じてリソース上限を設定することができる

### UnionFS

- ファイル・システム
- 作成したレイヤを操作するため，軽量かつ高速
- Dockerではコンテナごとにブロックを構築するためこのFSを採用している
- 以下のようなストレージドライバを使用することができる
  - aufs（初期のころよく使用されていた）
  - btrfs
  - vfs
  - DeviceMapper
  - overlay2（現在の推奨ドライバ）

## 関連メモ

- [[containers/docker/image-build|Docker イメージの作成と動作確認]]

## 参照リンク

- https://docs.docker.jp/v1.12/engine/understanding-docker.html
- https://www.techscore.com/blog/2014/07/30/introduction-to-unionfs/
- https://www.docker.com/ja-jp/blog/containerd-vs-docker/
- https://zenn.dev/k_yoshi/articles/7e1b80b874af4c
- https://y-ohgi.com/introduction-docker/
