---
title: VMMとゲストOSのしくみ
date: 2026-07-26
modified: 2026-07-26
draft: false
tags:
  - linux
  - virtualization
  - x86
aliases: []
description: KVM/QEMUで、ホスト、VMM、ゲストOSがどう役割を分け、CPU、メモリ、I/Oをどう使うかを、まず全体像から説明する。
---

仮想マシンは、実物のコンピュータの中に、もう一台のコンピュータを作る仕組みである。

最初は、CPUのモードや特権リングを覚えなくてよい。

まずは「実物のコンピュータを管理する側」と「その中に作られた仮想コンピュータ」を分けて考える。

このページでは、LinuxのKVM/QEMUを例にする。

## 1. 最初に見る三者

仮想マシンには、次の三者がいる。

| 呼び方       | たとえば何か                  | 仕事                                                             |
| ------------ | ----------------------------- | ---------------------------------------------------------------- |
| **ホストOS** | 実物のサーバーで動くLinux     | 実物のCPU、メモリ、ディスク、ネットワークカード（NIC）を管理する |
| **VMM**      | **KVM**と**QEMU**の組み合わせ | **仮想CPU（vCPU）**、仮想メモリ、仮想ディスクを用意して動かす    |
| **ゲストOS** | VMの中で動くLinux             | VMの中のアプリ、ファイル、仮想デバイスを管理する                 |

説明用には、次のような入れ子として捉えるとよい。

```text
実物のCPU、メモリ、ディスク
  └─ ホストLinux
      └─ KVM + QEMU（VMM）
          └─ 仮想CPU、仮想メモリ、仮想ディスク
              └─ ゲストLinux
                  └─ ゲスト内のアプリケーション
```

ゲストOSは「見せかけのアプリ」ではない。

ゲストOSにもカーネル、PID 1、プロセス、ファイルシステムがある。

ただし、ゲストOSが使うCPU時間、実際のRAM、実ディスクは、ホスト側が提供している。

KVMとQEMUをまとめてVMMと呼ぶのは、この仮想コンピュータを作り、動かす役を担うからである。

この入れ子は説明を簡単にするためのモデルである。

実際には、KVM、QEMU、ホストLinuxがそれぞれ別の役割を分担する。

## 2. ゲストOSは、ホストOSが起動した後に起動する

Doc: [Linux-insides: Booting](https://0xax.gitbooks.io/linux-insides/content/Booting/)、[Linux x86 boot protocol](https://www.kernel.org/doc/html/latest/arch/x86/boot.html)、[UEFI Boot Manager](https://uefi.org/specs/UEFI/2.11/03_Boot_Manager.html)、[initramfs/rootfs](https://www.kernel.org/doc/html/latest/filesystems/ramfs-rootfs-initramfs.html)

物理サーバーでは、最初にファームウェア、Linuxカーネル、PID 1の順でホストOSが起動する。

その後、ホスト上でQEMUを起動すると、QEMUとKVMが仮想コンピュータを用意する。

仮想コンピュータができてから、ゲストOSが自分のファームウェア、カーネル、PID 1を起動する。

![[host-and-guest-boot-flow.png|860]]

ホストのPID 1とゲストのPID 1は別のプロセスである。

ホストから見ると、ゲストOSはQEMUプロセスとvCPUスレッドの中で動いている。

ゲストから見ると、自分専用のCPU、メモリ、ディスクを持つ一台のコンピュータに見える。

UEFI構成では、ファームウェアがUEFIアプリケーションを起動し、Linux EFI stubを入口にすることもある。

QEMUのdirect kernel bootでは、ゲストの通常のファームウェア起動を一部省略できる。

どちらの場合も、ゲストカーネルとゲストPID 1がホストのものとは別に存在する点は変わらない。

## 3. 具体例: ゲストのアプリがファイルを読む

ゲスト内のアプリケーションがファイルを読む場面を追うと、VMMの立ち位置が分かりやすい。

まず、アプリケーションはゲストLinuxに「このファイルを読んでほしい」と頼む。

ゲストLinuxがすでにデータをメモリに持っていれば、そのままアプリケーションへ返せる。

この場合、ホストLinuxやQEMUは関わらない。

データがメモリにないときだけ、ゲストLinuxは仮想ディスクへ読み込みを頼む。

```text
ゲストアプリ
  ↓ ファイルを読むよう依頼する
ゲストLinux
  ↓ 仮想ディスクへ要求する
QEMUなどのホスト側の処理
  ↓ ホストのファイルや実ディスクを使う
ホストLinux
  ↓ 結果を戻す
ゲストLinux
  ↓
ゲストアプリ
```

この流れで、QEMUなどのホスト側の処理は「仮想ディスクの向こう側」を担当する。

ゲストの`read()`という依頼そのものを、QEMUがホストの`read()`へ一語ずつ翻訳しているわけではない。

ゲストLinuxが仮想ディスクへ出したI/O要求を、ホスト側のファイルやディスクへつなぐ役である。

> [!note] 最初はここだけ区別する
>
> ゲストアプリからゲストカーネルへ頼む動きは、ゲストの中で完結することが多い。
>
> 仮想ディスクや仮想NICを使う必要が出たとき、VMMとホスト側が関わる。

## 4. KVMとQEMUは、別の仕事をする

Doc: [KVM API](https://docs.kernel.org/virt/kvm/api.html)、[QEMU system emulation](https://www.qemu.org/docs/master/system/introduction.html)、[QEMU user-mode emulation](https://www.qemu.org/docs/master/user/main.html)

VMMは一つの大きなプログラムではない。

KVMとQEMUが役割を分けている。

| 主体        | いる場所                    | 主な仕事                                                           |
| ----------- | --------------------------- | ------------------------------------------------------------------ |
| ホストLinux | 実物のサーバーのOS          | 実CPU、実メモリ、実ディスク、実NICを管理し、QEMUのスレッドを動かす |
| KVM         | ホストLinuxのカーネル       | ゲストの命令をCPUで実行しやすくし、必要なときにホスト側へ戻す      |
| QEMU        | ホストLinux上の通常プロセス | 仮想マシンを作り、仮想ディスクや仮想NICを用意する                  |
| ゲストLinux | 仮想マシンの中のOS          | ゲスト内のアプリ、メモリ、ファイル、仮想デバイスを管理する         |

KVMがあるため、ゲストの多くの命令は実CPUでそのまま実行できる。

QEMUが毎回すべての命令を処理するわけではない。

QEMUが特に必要になるのは、仮想デバイスを用意したり、仮想デバイスから出た要求をホスト側へ渡したりするときである。

## 5. ringは「一つのOSの中」での役割分担

アプリケーションが勝手にディスクを直接操作すると、他のアプリやOS全体を壊せてしまう。

そのため、Linuxはアプリケーションとカーネルに異なる権限を与える。

| 役割             | よく使うring | できること                                     |
| ---------------- | ------------ | ---------------------------------------------- |
| アプリケーション | ring 3       | カーネルへ頼んで、ファイルやネットワークを使う |
| Linuxカーネル    | ring 0       | CPU、メモリ、デバイスを直接管理する            |

アプリがファイルを読むときは、ring 3のアプリからring 0のカーネルへ処理を頼む。

この依頼を**system call**と呼ぶ。

ゲストアプリがsystem callすると、最初に処理するのはゲストLinuxである。

ホストLinuxへ直接届くわけではない。

## 6. VMX modeは「どのコンピュータを動かしているか」を表す

ringだけでは、ホストとゲストの関係を説明しきれない。

ringは、一つのOSの中でアプリとカーネルを分ける仕組みだからである。

Intel VT-xには、ホスト側の実行状態とゲスト側の実行状態を分ける仕組みがある。

これを**VMX root operation**と**VMX non-root operation**という。

名前は難しいが、次のように読むだけでよい。

| 見るもの | 答え                                   |
| -------- | -------------------------------------- |
| ring     | このOSの中で、アプリかカーネルか       |
| VMX mode | 今動いているのは、ホスト側かゲスト側か |

図は、まず右列だけを読むとよい。

右下のゲストアプリが右上のゲストLinuxへ頼む動きがsystem callである。

左列は、そのゲストを動かすホスト側のKVMとQEMUがどこにいるかを示している。

![[vmx-modes-and-privilege-rings.png|900]]

ゲストLinuxは、ゲストの中ではring 0で動く。

それでも、ホストのメモリや他のVMを自由に触れるわけではない。

ゲストLinuxはVMX non-root、ホストLinuxとKVMはVMX rootという別の実行状態にいるからである。

### system callとVM exit

**system call**は、アプリが自分のOSのカーネルに頼む動きである。

**VM exit**は、ゲストの実行をいったん止めて、KVMを含むホスト側へ制御を戻す動きである。

| 起きたこと                                           | まず処理する場所  |
| ---------------------------------------------------- | ----------------- |
| ゲストアプリがファイルを読む                         | ゲストLinux       |
| ゲストLinuxが通常のメモリ管理をする                  | ゲストLinux       |
| 仮想ディスクや仮想NICの処理が必要になる              | KVM、必要ならQEMU |
| ゲスト用として用意されていないメモリへ触れようとする | KVM               |

VM exitは、ゲストで何かが起こるたびに発生するわけではない。

CPUやKVMが「ホスト側で確認や処理が必要だ」と決めた場面で起きる。

「ring -1」は、VMMがゲストの外側にいることを表す比喩として使われることがある。

VMX rootやVMX non-rootは、ring 0からring 3とは別の分類である。

## 7. 実物のCPU、メモリ、ディスクへは、三つの道でつながる

Doc: [IntelのEPT説明](https://www.intel.com/content/www/us/en/developer/articles/technical/increase-performance-of-vm-workloads-with-thp.html)、[virtio 1.3仕様](https://docs.oasis-open.org/virtio/virtio/v1.3/virtio-v1.3.html)、[QEMU virtio devices](https://www.qemu.org/docs/master/system/devices/virtio/index.html)

CPU、メモリ、I/Oは、同じ道を通るわけではない。

最初は次の三点を押さえればよい。

| 使いたいもの  | 何が起きるか                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------- |
| CPU           | ゲストOSはアプリを仮想CPUに割り当て、ホストOSはその仮想CPUを実CPUで動かす                     |
| メモリ        | ゲストOSが見る「物理メモリ」は仮想マシン用の物理メモリであり、実物のRAMとは別に対応づけられる |
| ディスクやNIC | ゲストOSは仮想デバイスへ頼み、QEMUやvhostなどの受け口（backend）がホスト側の実物へつなぐ      |

次の図は、左からCPU、メモリ、I/Oの順に読む。

三列すべてを一度に覚える必要はない。

![[guest-resource-access-paths.png|980]]

### CPU

ゲストOSは、ゲスト内のアプリをどの仮想CPUで動かすか決める。

ホストOSは、QEMUのvCPUスレッドをどの実CPUでいつ動かすか決める。

そのため、ゲストOSの予定どおりにアプリがすぐ実行されるとは限らない。

ホスト側でvCPUスレッドにCPU時間が与えられて初めて、ゲストのアプリも実CPUを使える。

### メモリ

ゲストアプリが使うアドレスは、まずゲストOSが管理するメモリへ対応づけられる。

次に、CPUとVMMが、そのゲスト用メモリを実物のRAMへ対応づける。

この二段階があるため、ゲストLinuxがring 0でも、ホストのRAMを好きなように読んだり書いたりはできない。

詳しい資料では、次の三つの名前が使われる。

```text
GVA: ゲストアプリが使う仮想アドレス
GPA: ゲストOSが「物理メモリ」として扱うアドレス
HPA: 実物のサーバーの物理メモリのアドレス
```

### I/O

**virtio**は、よく使われる仮想デバイスの仕組みである。

virtioでは、ゲストLinuxのドライバが仮想デバイスへの依頼を共有メモリに置く。

QEMUまたはvhostの**backend**（依頼を受け取る側）が、ホスト側のファイル、実ディスク、NICを使う。

処理が終わると、backendはゲストLinuxへ完了を知らせる。

この往復が、仮想ディスクや仮想NICが実物の資源を使えるようにする。

## 8. ゲストのring 0が、ホストのring 0ではない理由

ゲストLinuxはゲスト内のアプリを管理するためにring 0で動く。

しかし、ゲストLinuxの「物理メモリ」は、実物のRAMではなくゲスト用に切り出されたメモリである。

CPUのVMX機能とメモリの対応づけが、ゲストからホストや他のVMへ直接触れないようにする。

DMA（デバイスがメモリへ直接読み書きする仕組み）を使う場合は、**IOMMU**もこの境界を守る役を持つ。

VMの隔離はringだけで作られるのではない。

VMX、メモリ変換、KVM/QEMU、必要に応じてIOMMUが組み合わさって作られる。

## 9. あとから読む話

この節は、ここまでの流れを理解してから読めばよい。

### 古典的なx86仮想化

Doc: [Popek–Goldbergの仮想化要件](https://doi.org/10.1145/361011.361073)、[Intel Virtualization Technologyの解説](https://www.cs.utexas.edu/~witchel/380L/papers/uhlig05ieeecomputer-intel_virtualization_technology.pdf)

VT-xやAMD-Vが一般的になる前は、ゲストカーネルを安全に動かしながら、VMMが必要な操作を捕捉することが難しかった。

そのため、命令を書き換えるバイナリ変換や、ゲストOSを変更してhypercallを使う準仮想化が使われた。

古い32-bitの準仮想化では、ゲストカーネルをring 1へ置く実装もあった。

これは歴史的な実装であり、現在のVMX non-rootを「ring 1」と考える理由にはならない。

「ring compression」は、この古いソフトウェア中心の仮想化で出た、より限定的な問題を指す言葉である。

### Type 1、Type 2、コンテナ

Doc: [LinuxのHyper-Vアーキテクチャ概要](https://cdn.kernel.org/doc/html/latest/virt/hyperv/overview.html)、[[linux/namespaces/index|Linux Namespace]]、[[linux/cgroup|cgroup]]

Type 1とType 2は、VMMがどこに置かれるかを大まかに分ける呼び方である。

KVM/QEMUでは、KVMがホストカーネルにあり、QEMUがホストのユーザー空間にある。

そのため、Type 1かType 2かだけよりも、CPU、メモリ、I/Oの担当がどこかを見るほうが実態をつかみやすい。

コンテナは、ゲストカーネルを作らず、ホストカーネルを共有する。

VMはゲストカーネルごと分け、コンテナは一つのホストカーネルの中でプロセスの見え方と資源を分ける。

## 理解の手がかり

仮想マシンで何かが起きたときは、次の順で考える。

1. 今動いているのは、ホストかゲストか。
2. ゲストの中だけで処理できるか、それとも仮想デバイスを使う必要があるか。
3. 実物のCPU、RAM、ディスク、NICのどれを使いたいのか。
4. その実物へつなぐ役は、ホストLinux、KVM、QEMU、vhostのどれか。

ファイルを読む例なら、ゲストアプリからゲストLinuxへ頼み、必要なときだけ仮想ディスクを通じてホスト側へ進む。

この順で追うと、VMMは「ゲストのすべてを毎回処理するもの」ではなく、仮想コンピュータを成立させ、必要なときに実物の資源へつなぐ仕組みとして見えてくる。

## References

- [Linux-insides: Booting](https://0xax.gitbooks.io/linux-insides/content/Booting/) — 指定資料。Linux 4.17を対象とする解説として参照。
- [Linux x86 boot protocol](https://www.kernel.org/doc/html/latest/arch/x86/boot.html)
- [UEFI 2.11: Boot Manager](https://uefi.org/specs/UEFI/2.11/03_Boot_Manager.html)
- [Linux initramfs, ramfs and rootfs](https://www.kernel.org/doc/html/latest/filesystems/ramfs-rootfs-initramfs.html)
- [KVM API](https://docs.kernel.org/virt/kvm/api.html)
- [QEMU system emulation](https://www.qemu.org/docs/master/system/introduction.html)
- [QEMU user-mode emulation](https://www.qemu.org/docs/master/user/main.html)
- [QEMU virtio devices](https://www.qemu.org/docs/master/system/devices/virtio/index.html)
- [Virtio 1.3 specification](https://docs.oasis-open.org/virtio/virtio/v1.3/virtio-v1.3.html)
- [Intel Software Developer’s Manual](https://www.intel.com/content/www/us/en/content-details/843820/intel-64-and-ia-32-architectures-software-developer-s-manual-combined-volumes-1-2a-2b-2c-2d-3a-3b-3c-3d-and-4.html)
- [Intel: EPT and two-dimensional paging](https://www.intel.com/content/www/us/en/developer/articles/technical/increase-performance-of-vm-workloads-with-thp.html)
- [Linux Hyper-V overview](https://cdn.kernel.org/doc/html/latest/virt/hyperv/overview.html)
- [Popek and Goldberg, Formal Requirements for Virtualizable Third Generation Architectures](https://doi.org/10.1145/361011.361073)
- [Uhlig et al., Intel Virtualization Technology](https://www.cs.utexas.edu/~witchel/380L/papers/uhlig05ieeecomputer-intel_virtualization_technology.pdf)
