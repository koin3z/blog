---
title: Docker イメージの作成と動作確認
date: 2025-12-28
modified: 2026-07-21
draft: false
tags:
  - containers/docker
aliases:
  - containers/creating-container-image
  - notes/creating-container-image
  - memos/containers/creating-container-image
  - containers/image-jupyterlab
  - notes/image-jupyterlab
  - memos/containers/image-jupyterlab
description: JupyterLab を題材に、手動検証から Dockerfile 化、ビルド、動作確認までの流れを整理する。
---

## 目的

- コンテナ内でアプリケーションを手動検証し、成功した操作を`Dockerfile`へ変換する
- JupyterLab を例に、イメージのビルドと起動まで確認する

## 前提となる構成

- **ベース OS**：Ubuntu、Alpine、Debian など
- **ランタイム**：Python 3.11、Node.js 20、Go など
- **ライブラリ**：`gcc`、`git`、`libpq-dev`など
- **環境変数**：ポート番号、API キー

## 手動検証

ベースイメージを`-it`で起動し、コンソール上でコマンドを順に試す。

```bash
docker run --rm -it ubuntu:22.04 /bin/bash
```

次の条件を確認する。

- `apt-get update`の要否
- 対話入力を避ける`-y`オプションの要否
- インストール後の設定ファイルの場所

### JupyterLab の検証

```console
→ docker run --rm -it python:3.11-slim /bin/bash

root@061ac190dbab:/# pip install --upgrade pip
root@061ac190dbab:/# pip install jupyterlab
root@061ac190dbab:/# jupyter lab --ip=0.0.0.0 --allow-root
...
    To access the server, open this file in a browser:
        file:///root/.local/share/jupyter/runtime/jpserver-64-open.html
    Or copy and paste one of these URLs:
        http://localhost:8888/lab?token=xxxxxxxxxxxxxxxxxx
        http://127.0.0.1:8888/lab?token=xxxxxxxxxxxxxxxxxx

docker run --rm -it \
  --publish 8888:8888 \
  --volume $(pwd):/work \
  --workdir /work \
  python:3.11-slim /bin/bash
```

## Dockerfile への変換

手動で成功した操作を`Dockerfile`の命令へ書き換える。

| **手動操作**                 | **Dockerfileの命令**                           |
| ---------------------------- | ---------------------------------------------- |
| `apt-get install ...`        | `RUN apt-get update && apt-get install -y ...` |
| ファイルをドラッグ＆ドロップ | `COPY . /app`                                  |
| `cd /app`                    | `WORKDIR /app`                                 |
| `export PORT=8080`           | `ENV PORT=8080`                                |

## ビルドと確認

`docker build`を実行し、エラーがあれば`Dockerfile`を修正して再度ビルドする。

```bash
docker build -t my-custom-env .
```

## 最適化

動作確認後に運用条件を整える。

- **イメージの軽量化**：不要なキャッシュの削除（`rm -rf /var/lib/apt/lists/*`）と[マルチステージビルド](https://docs.docker.jp/develop/develop-images/multistage-build.html)を検討する
- **セキュリティ**：`root`以外で実行するために`USER`を指定する
- **再現性**：バージョンを`latest`ではなく`3.11.5`のように固定する

## 関連メモ

- [[containers/docker|Docker]]

## 参照リンク

- [Building best practices](https://docs.docker.com/build/building/best-practices/)
