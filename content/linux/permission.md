---
title: Linux 特殊パーミッション
date: 2026-06-07
modified: 2026-07-21
draft: false
tags:
  - linux/security
aliases:
  - memos/permission
description: setuid、setgid、sticky bit の基本と確認方法を整理する。
---

## 全体像

通常のパーミッション (`rwx`) に加えて、**第4のレイヤー**として特殊パーミッションが存在する。

```
通常:    755  → rwxr-xr-x
特殊あり: 4755 → rwsr-xr-x
          ^^^
          特殊ビット（setuid=4, setgid=2, sticky=1）
```

---

## setuid（Set User ID）

### 一言で言うと

> 実行したユーザーではなく、**ファイルのオーナーの権限**でプロセスが動く仕組み

### なぜ必要か：`passwd` コマンドの例

```
一般ユーザー alice が passwd を実行
         ↓
/etc/shadow を書き換える必要がある
         ↓
/etc/shadow は root しか書き込めない
         ↓
passwd のオーナーは root + setuid が付いている
         ↓
実行中のプロセスが root として動作する ✅
```

### 確認方法

```bash
$ ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root ... /usr/bin/passwd
    ^
    s = setuid（x の位置が s に変わる）
```

### 設定方法

```bash
chmod u+s /path/to/binary
chmod 4755 /path/to/binary   # 数値指定
```

### ⚠️ セキュリティの注意点

- setuid root バイナリは**攻撃の最重要ターゲット**
- バグや脆弱性があると、攻撃者に root 権限を奪われるリスクがある
- システム内の setuid/setgid バイナリ一覧：

```bash
find / -perm -4000 -o -perm -2000
```

---

## setgid（Set Group ID）

### 一言で言うと

> 実行したユーザーのGIDではなく、**ファイルに設定されたグループの権限**でプロセスが動く仕組み。  
> ディレクトリに設定した場合は、**配下のファイルのグループが自動継承**される。

### ① ファイルへの setgid（setuid の GID 版）

```
実行中のプロセスのGID
  通常:   実行したユーザーのプライマリGID
  setgid: バイナリに設定されたグループのGID
```

### ② ディレクトリへの setgid（実用上こちらが重要）

```
/shared/ に setgid（グループ = team）が付いている
         ↓
alice（primary group: alice）が /shared/report.txt を作成
         ↓
通常なら グループ = alice になるはずが…
         ↓
グループ = team に自動でなる ✅
         ↓
bob も team グループ権限でファイルを読み書きできる 🎉
```

**チーム共有ディレクトリの標準パターン。**  
一度設定すれば全員が意識しなくてもグループが自動継承される。

### 設定方法

```bash
chmod g+s /path/to/dir
chmod 2755 /path/to/dir   # 数値指定
```

---

## sticky bit

### 一言で言うと

> ディレクトリに設定すると、**自分以外のファイルを削除できなくなる**仕組み

### なぜ必要か：`/tmp` の例

```
/tmp は全員が読み書き・削除できる（rwxrwxrwx）
         ↓
問題：悪意あるユーザーが他人のファイルを削除・改ざんできる
         ↓
sticky bit で解決！
```

```
alice が /tmp/alice.txt を作成
bob が /tmp/alice.txt を削除しようとする → ❌ 拒否
bob が /tmp/bob.txt を削除しようとする   → ✅ 許可
```

### 確認方法

```bash
$ ls -ld /tmp
drwxrwxrwt ...
         ^
         t = sticky bit（x の位置が t に変わる）
```

### 設定方法

```bash
chmod +t /path/to/dir
chmod 1777 /path/to/dir   # 数値指定
```

---

## 大文字・小文字の違い

特殊ビットが付く位置に **実行ビット（x）があるかどうか**を示す。

| 状態                | 表示                | 意味         |
| ------------------- | ------------------- | ------------ |
| x あり + 特殊ビット | `s` / `t`（小文字） | 実行権限あり |
| x なし + 特殊ビット | `S` / `T`（大文字） | 実行権限なし |

```
drwxrws--T
       ^  ^
       s  T
setgid + gに実行権限あり
          sticky bit + othersに実行権限なし（ほぼ意味をなさない）
```

---

## まとめ表

| ビット | 数値 | ファイルへの効果    | ディレクトリへの効果        |
| ------ | ---- | ------------------- | --------------------------- |
| setuid | 4    | オーナーのUIDで実行 | ほぼ無効                    |
| setgid | 2    | グループのGIDで実行 | 配下ファイルがGIDを自動継承 |
| sticky | 1    | 現代では無効        | 自分のファイルしか削除不可  |
