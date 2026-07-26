---
title: x86におけるプロセッサ仮想化の方式
date: 2026-07-26
modified: 2026-07-26
draft: true
tags:
  - linux/virtualization
aliases:
  - x86仮想化
  - バイナリトランスレーションと準仮想化
description: x86の特権命令とセンシティブ命令を出発点に、バイナリトランスレーション、準仮想化、VMX modeの役割と違いを整理する。
---

## Overview

x86のシステム仮想化では、ゲストOSを実機と同じように動かしながら、実CPU、実メモリ、実デバイスの制御権をVMM（Virtual Machine Monitor）に残す必要がある。

このノートでは、古いx86で問題になった命令の性質を起点に、**バイナリトランスレーション**、**準仮想化**、**VMX mode**を区別する。

対象はx86のCPU仮想化である。

メモリ仮想化の詳細、I/O仮想化、KVM/QEMUの責務分担は、[[linux/vmm_boot_flow_and_privilege_rings|VMM、Linuxの起動、x86特権リングの関係]]で扱う。

## 仮想化で満たす条件

1974年のPopekとGoldbergの整理では、VMMは等価性、資源管理、効率性を満たす必要がある。[^popek-goldberg]

- **等価性**：ゲスト上のプログラムが、対応する実機での実行と同等の結果を得る。
- **資源管理**：VMMがハードウェア資源を管理し、ゲストがVMMの管理外の資源を直接操作できない。
- **効率性**：多くの命令を実CPUで直接実行でき、VMMの介入を必要な場面へ限る。

この条件を実現する古典的な考え方が、**trap-and-emulate**である。

ゲストが通常の命令を実行するときはCPUがそのまま実行する。

ゲストが実機の重要な状態を操作しようとすると、CPUがVMMへ制御を渡す。

VMMは仮想CPUや仮想デバイスに対して操作が成功したような状態を作り、ゲストを再開する。

```text
ゲストOSの通常命令 → CPUが直接実行
ゲストOSの捕捉対象の操作 → trap → VMMが処理 → ゲストを再開
```

## 特権命令とセンシティブ命令

x86の**特権命令**は、CPUが現在の特権レベルで実行を許さない命令である。

低い権限で実行すると例外が発生するため、OSやVMMはその操作を捕捉できる。

制御レジスタの変更、割り込みや記述子表の設定、CPUの停止などが典型例である。[^intel-sdm]

ただし、「実機の重要な資源に関わる」ことと「特権命令である」ことは同義ではない。

命令が特権命令かどうかは、CPUアーキテクチャがその命令に定めた権限検査と例外の規則で決まる。

たとえば通常のレジスタ間コピーは非特権命令だが、制御レジスタを対象にする`MOV`は特権命令になる。

```text
MOV rax, rbx  : 通常のレジスタ間コピー
MOV cr3, rax  : ページテーブルの切替に関わる特権操作
```

**センシティブ命令**は、システムの設定を変える、またはシステムの状態によって動作が変わる命令を指す。

仮想化ではセンシティブ命令を捕捉できなければならない。

しかし、古いx86にはセンシティブでありながら、低い権限で必ずtrapしない命令があった。

たとえば`POPF`はフラグレジスタを復元する命令であり、権限が不足していると一部のフラグの更新が抑制されることがある。

ゲストOSが本来のring 0ではなく低い権限で動くと、ゲストが期待する動作と実際の動作がずれるが、VMMはtrapを受け取れない。

このずれが、古いx86で完全仮想化を難しくした理由である。[^gihyo]

> [!NOTE] 説明モデル
>
> 「特権命令」はCPUが立入禁止として止める操作である。
>
> 「センシティブ命令」は、VMMが観察・制御したい操作である。
>
> 古いx86では後者の一部が前者に含まれなかったため、trap-and-emulateだけでは足りなかった。

## 三つの用語が指すもの

![[x86-virtualization-approaches.png|940]]

バイナリトランスレーションと準仮想化は、ゲストOSの問題命令をどう扱うかという方式である。

VMX modeは、VMMとゲストの実行をCPUが分け、必要なときにVMMへ戻すためのハードウェア実行機構である。

| 比較軸         | バイナリトランスレーション      | 準仮想化                           | VMX mode（Intel VT-x）               |
| -------------- | ------------------------------- | ---------------------------------- | ------------------------------------ |
| 分類           | ソフトウェアによる完全仮想化    | ゲストとVMMの協調方式              | CPUの仮想化支援                      |
| ゲストOSの変更 | 原則不要                        | 必要                               | 原則不要                             |
| 問題操作の扱い | VMMが命令列を安全な形へ変換する | ゲストがhypercallでVMMへ依頼する   | CPUが設定に従ってVM exitを発生させる |
| 主な制約・利点 | 透過的だが、変換器が複雑になる  | 効率を得やすいが、対応ゲストが必要 | ゲストのring 0を保ちやすい           |

## バイナリトランスレーション

**バイナリトランスレーション**は、ゲストOSを改造せずに動かすため、VMMがゲストの命令列を解析し、問題になる命令を別の安全な命令列へ変換する方式である。

変換後の命令列は、ゲストが見えるCPU状態を保つようにVMMを呼び出す。

そのため、ゲストOSは仮想化されていることを意識せずに動作できる。

一方で、どの命令を変換し、変換後の状態をどう保つかをVMMが担うため、実装は複雑になる。

## 準仮想化

**準仮想化**は、ゲストOSを仮想環境向けに変更する方式である。

ゲストは問題になる特権操作をそのまま実行せず、**hypercall**でVMMへ処理を依頼する。

hypercallは、アプリケーションがOSへ依頼するsystem callに似ているが、ゲストカーネルがVMMへ依頼する呼び出しである。

Xenの仕様では、hypercallはXenに対するsystem callとして定義されている。[^xen-hypercall]

```text
ゲストOSのカーネル → hypercall → VMM → 結果をゲストへ返す
```

VMMは命令を推測して置き換えなくてもよくなるため、古いx86でも効率的に実装しやすかった。

ただし、OSカーネルを変更できない場合には適用できない。

## VMX modeとVM exit

Doc: [Intel VMX operationの説明](https://www.intel.com/content/www/us/en/developer/articles/technical/improving-performance-vm-workloads-opt-poll-time.html)

Intel VT-xは、**VMX root operation**と**VMX non-root operation**を導入する。

VMMはroot operationで動き、ゲストはnon-root operationで動く。

これはring 0からring 3までのCPLとは別の軸である。

ゲストカーネルはnon-root operationにいながら、ゲスト内ではring 0として実行できる。

VMMは、どの命令やイベントで**VM exit**を起こすかを設定できる。

VM exitが起きるとCPUはゲストの実行状態を保存し、VMMへ制御を渡す。

VMMが処理を終えると、**VM entry**によってゲストを再開する。

```text
VMM（VMX root）
  ↓ VM entry
ゲストOS（VMX non-root / guest ring 0）
  ↓ 捕捉対象の命令・イベント
VMM（VM exitでrootへ戻る）
```

この仕組みにより、VMMはゲストOSを本来のring 0として動かしつつ、必要な操作だけを捕捉できる。

Intelは、VMX non-root operationで特定の命令やイベントが通常とは異なる動作をし、VMMへVM exitできることを説明している。[^intel-vmx]

## 現代の仮想化での組み合わせ

現代のVMMは、三つの概念のうち一つだけを選ぶとは限らない。

たとえばKVMやVMwareなどでは、CPU仮想化にVT-xやAMD-Vを用い、I/Oの効率化にはvirtioのような仮想化対応ドライバを使うことがある。

この構成では、OSカーネル全体を準仮想化しなくても、性能の影響が大きいI/O経路だけでゲストとVMMが協調できる。

なお、VMXはIntelの名称である。

AMDの対応するCPU仮想化支援はAMD-Vであり、実行機構はSVMと呼ばれる。[^amd-apm]

## 関連する深掘り

- EPTとNPTによる二段階ページ変換
- virtioによる準仮想化I/O
- ネステッド仮想化
- KVM、QEMU、vhost、VFIOの責務分担

## References

[^popek-goldberg]: [Popek and Goldberg, Formal Requirements for Virtualizable Third Generation Architectures](https://doi.org/10.1145/361011.361073)

[^intel-sdm]: [Intel 64 and IA-32 Architectures Software Developer's Manual](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)

[^gihyo]: [技術評論社：x86プロセッサにおけるプロセッサ仮想化](https://gihyo.jp/dev/serial/01/vm_work/0004)

[^xen-hypercall]: [Xen Hypercall ABI](https://xenbits.xenproject.org/docs/latest/guest-guide/x86/hypercall-abi.html)

[^intel-vmx]: [Intel：VM workloads performance](https://www.intel.com/content/www/us/en/developer/articles/technical/improving-performance-vm-workloads-opt-poll-time.html)

[^amd-apm]: [AMD64 Architecture Programmer's Manual, Volume 2: System Programming](https://www.amd.com/content/dam/amd/en/documents/processor-tech-docs/programmer-references/24593.pdf)
