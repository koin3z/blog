---
title: QEMU/KVMの役割分担
date: 2026-07-26
modified: 2026-07-26
draft: true
tags:
  - linux/virtualization
aliases:
  - KVM
  - QEMU
  - QEMU/KVM
description: LinuxでQEMU、KVM、libvirt、virt-managerが仮想マシンのCPU実行、デバイス、管理操作をどう分担するかを整理する。
---

## Overview

QEMU/KVMは、LinuxホストでゲストOSを動かす代表的なマシンレベル仮想化の組み合わせである。

ただし、QEMUとKVMは同じものではない。

- **KVM**はLinuxカーネルの機能であり、CPUの仮想化支援を利用してvCPUを実行する。
- **QEMU**はユーザー空間のプログラムであり、仮想マシンの構成、メモリ、仮想デバイス、外部との接続を用意する。
- **libvirt**と**virt-manager**は、QEMU/KVMを含む複数の仮想化基盤を設定・操作するための管理層である。

このページでは、Linux上で同じアーキテクチャのゲストをKVMで高速に動かす構成を中心に扱う。

異なるCPUアーキテクチャをソフトウェアで再現するQEMUのエミュレーション、CPUの仮想化方式の歴史、VMのメモリ変換とVM exitの詳細は、それぞれ[[linux/vmm_boot_flow_and_privilege_rings|VMMとゲストOSのしくみ]]、[[linux/x86_virtualization_approaches|x86におけるプロセッサ仮想化の方式]]を参照する。

## 全体構造

Doc: [QEMU System Emulation](https://www.qemu.org/docs/master/system/introduction.html)、[KVM API](https://docs.kernel.org/virt/kvm/api.html)、[指定資料：QEMU/KVMとVirt-manager](https://gihyo.jp/article/2026/07/zoku-gansiki-0066)

![[qemu-kvm-responsibility-map.png|QEMU/KVM、libvirt、virt-managerの責任境界とCPU・I/O経路|880]]

QEMUは、ゲストOSが利用するCPU、メモリ、デバイスを含む仮想マシンのモデルを提供する。

KVMをアクセラレータとして使うと、ゲストの通常のCPU命令の多くは、QEMUが命令ごとに解釈するのではなく、ホストCPUで実行できる。

その一方で、ディスクやネットワークなどの仮想デバイスの処理、起動方法、画面・コンソール、管理APIはQEMUの担当である。

> [!NOTE] 説明モデル
>
> KVMを「CPUを走らせるカーネル側の入口」、QEMUを「仮想コンピュータの部品と外部接続を組み立てるプロセス」と捉えると、両者を混同しにくい。
>
> 実際の処理はメモリ管理、割り込み、virtio、vhostなどにもまたがるため、このモデルは責任境界を理解するための単純化である。

## なぜQEMUとKVMを組み合わせるのか

QEMUは、システムエミュレーションでCPU、メモリ、デバイスを持つ仮想マシンをモデル化できる。

また、TCG（Tiny Code Generator）を用いると、多数のCPUアーキテクチャをソフトウェアでエミュレートできる。

しかし、ホストとゲストが同じアーキテクチャで、CPUが仮想化支援を備える場合は、CPU命令までソフトウェアで再現する必要はない。

KVMはLinux上で使えるアクセラレータであり、QEMUは`-accel kvm`などでKVMを選べる。

QEMUの公式文書では、アクセラレータを指定しない既定値はTCGであるため、ハードウェア仮想化を利用するにはアクセラレータの選択が必要だと説明している。

この組み合わせにより、QEMUは仮想マシンとデバイスの柔軟なモデルを保ちつつ、KVMはCPU実行の性能を担える。

## KVMが担当するCPU実行

Doc: [The Definitive KVM API Documentation](https://docs.kernel.org/virt/kvm/api.html)

KVMは`/dev/kvm`を公開し、ユーザー空間のVMMはファイルディスクリプタとioctlを通じてKVMを操作する。

基本的な流れは次のとおりである。

1. QEMUなどのVMMが`/dev/kvm`を開く。
2. `KVM_CREATE_VM`でVMを作成する。
3. VMにvCPUを作成し、ゲストメモリと状態を設定する。
4. vCPUに対する`KVM_RUN`で、ゲストの実行をKVMへ委ねる。
5. KVMがホスト側の処理を必要とする状態になると、ユーザー空間へ戻る。

KVM APIの`KVM_RUN`はvCPUを実行する操作であり、共有メモリにある`kvm_run`構造体を通じて、ユーザー空間と実行結果をやり取りする。

したがって、KVMはVM全体を単独で構成する製品ではなく、ユーザー空間のVMMがCPU実行を委ねるLinuxカーネルのインターフェースである。

## QEMUが担当する仮想コンピュータ

Doc: [QEMU System Emulation: Introduction](https://www.qemu.org/docs/master/system/introduction.html)

QEMUのシステムエミュレーションは、ゲストOSを実行するための仮想CPU、メモリ、エミュレートされたデバイスのモデルを提供する。

QEMUの設定は、概念的に次の部品へ分けられる。

| 部品                | 役割                                                               |
| ------------------- | ------------------------------------------------------------------ |
| マシンとメモリ      | 仮想ハードウェアの種類とゲストへ見せるメモリ量を決める。           |
| CPUとアクセラレータ | vCPUの構成と、KVMまたはTCGなどのCPU実行方式を決める。              |
| 仮想デバイス        | 仮想ディスク、NIC、コンソール、USBなどをゲストへ見せる。           |
| backend             | ディスクイメージ、ネットワーク、ソケットなど、ゲスト外側の接続先。 |
| firmwareと起動      | BIOS/UEFI、ブート順、カーネル直接起動などを決める。                |

QEMUの仮想デバイスには、実機のデバイスを模倣するものだけでなく、仮想化環境向けに設計されたvirtioデバイスもある。

virtioは、ゲスト側のドライバとホスト側のbackendが協調することで、デバイスを完全に模倣する場合の負荷を抑える。

## libvirtとvirt-managerが担当する管理

Doc: [QEMUの管理インターフェース](https://www.qemu.org/docs/master/system/introduction.html)、[libvirt QEMU/KVM/HVF driver](https://www.libvirt.org/drvqemu.html)、[指定資料：QEMU/KVMとVirt-manager](https://gihyo.jp/article/2026/07/zoku-gansiki-0066)

QEMUには、状態の確認や仮想マシン操作を行うQMP（QEMU Machine Protocol）がある。

libvirtはQEMUだけでなく、LXCやVirtualBoxなどの異なる仮想化基盤を統一的に扱うための管理基盤である。

virt-managerは、そのlibvirtを利用するGUIであり、ISOイメージ、CPU数、メモリ量、ディスク、ネットワーク、BIOS/UEFIなどを対話的に設定できる。

この三者の関係は、次のように整理できる。

| 主体         | 主な関心事                                       | QEMU/KVMとの関係                                    |
| ------------ | ------------------------------------------------ | --------------------------------------------------- |
| QEMU         | 1台のVMの構成と実行、仮想デバイス                | KVMをアクセラレータとして利用できる。               |
| KVM          | vCPU実行をLinuxカーネルから支援する              | QEMUなどのユーザー空間VMMにAPIを提供する。          |
| libvirt      | VM定義、ライフサイクル、ネットワーク、ストレージ | QEMU/KVMを含むバックエンドの差を管理APIへ吸収する。 |
| virt-manager | GUIでのVM作成・設定・コンソール表示              | 通常はlibvirtを介してQEMU/KVMを操作する。           |

この層は必須ではない。

QEMUはコマンドラインから直接起動できるが、再利用するVM定義やネットワーク、複数VMの運用を扱う場合は、libvirtとvirt-managerが設定を一貫して保つ助けになる。

## 具体例：ゲストが仮想ディスクを読むとき

ゲストのアプリケーションがファイルを読むと、まずゲストOSが自分のページキャッシュを確認する。

キャッシュにないデータを読む必要があると、ゲストOSのドライバが仮想ディスクへI/O要求を出す。

virtio-blkなどの構成では、ゲストのvirtioドライバが要求をvirtqueueへ置き、QEMUまたはvhostのbackendが対応するホスト側のファイルやブロックデバイスへ接続する。

完了後、仮想デバイスはゲストへ完了を通知する。

この経路では、KVMの主な役割はゲストのvCPU実行であり、仮想ディスクのモデルとホスト側の接続はQEMU側の役割として現れる。

## 類似概念との違い

| 比較軸         | QEMU + KVM                                | QEMU + TCG                                       | コンテナ                                           |
| -------------- | ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| CPU実行        | KVMを通じてハードウェア仮想化を利用する   | QEMUが動的変換でCPUをエミュレートする            | ホストCPUで通常のプロセスとして実行する            |
| ゲストカーネル | 独立したゲストカーネルを動かす            | 独立したゲストカーネルを動かせる                 | 作らず、ホストカーネルを共有する                   |
| 主な用途       | Linuxホスト上の高速な同一アーキテクチャVM | 異なるアーキテクチャのOSやソフトウェアの動作確認 | 同一カーネル上のプロセス分離とアプリケーション配布 |
| 仮想デバイス   | QEMUが提供する                            | QEMUが提供する                                   | 原則として不要                                     |
| 性能の主な制約 | VM exit、I/O経路、ホスト資源の競合        | 命令変換の負荷                                   | カーネル共有による隔離・互換性の制約               |

「QEMUは遅い」「KVMはQEMUを置き換える」という説明は不正確である。

QEMUはTCGを使うCPUエミュレーションも、KVMを使うシステム仮想化も扱える。

KVMはQEMUが必要とする仮想デバイスや管理機能を提供しないため、一般的なQEMU/KVM構成では両者が補完し合う。

## 制約と失敗パターン

- **KVMを使える前提を満たさない**：KVMはLinux用のアクセラレータであり、ホストCPUと仮想化支援の利用可否に依存する。利用できない場合、QEMUはTCGへ切り替わるか、起動設定が失敗する。
- **ホストとゲストのアーキテクチャを混同する**：異なるアーキテクチャのゲストでは、KVMによるCPU実行を期待できない。QEMUの対象アーキテクチャ、マシン種別、アクセラレータの組み合わせを確認する。
- **CPU性能だけでI/O性能を判断する**：KVMでvCPUを高速に実行できても、ディスク・ネットワーク・画面の経路は別に設計する必要がある。virtio、vhost、パススルーはこの経路の選択肢である。
- **管理層の設定とQEMUの直接起動を混在させる**：libvirt管理下のVMを直接QEMUで別途起動・変更すると、定義と実際の状態がずれることがある。管理経路を決めて使い分ける。

## 関連する深掘り

- [[linux/vmm_boot_flow_and_privilege_rings|VMMとゲストOSのしくみ]]：VM exit、二段階のメモリ変換、virtio/vhostを追う。
- [[linux/x86_virtualization_approaches|x86におけるプロセッサ仮想化の方式]]：VT-x/AMD-V以前を含むCPU仮想化の方式を比較する。
- OVMFとUEFI：QEMU上でUEFI起動するためのファームウェア構成。
- VFIOとIOMMU：PCIデバイスをゲストへパススルーするときのDMA隔離。
- ライブマイグレーション：メモリのdirty pageを追跡しながらVMを移動する仕組み。

## References

- [指定資料：第66回 QEMU/KVMとVirt-manager](https://gihyo.jp/article/2026/07/zoku-gansiki-0066) — 2026-07-07。QEMU/KVM、libvirt、virt-manager、OVMF、SPICEを組み合わせる実例として参照。
- [QEMU System Emulation: Introduction](https://www.qemu.org/docs/master/system/introduction.html) — QEMU 11.0.91 documentation（2026-07-26確認）。
- [Linux KVM API](https://docs.kernel.org/virt/kvm/api.html) — KVMのVM・vCPU・`KVM_RUN`インターフェース。
- [libvirt: QEMU/KVM/HVF driver](https://www.libvirt.org/drvqemu.html) — QEMU/KVMをlibvirtで管理する構成。
