---
title: VMM、Linuxの起動、x86特権リングの関係
date: 2026-07-26
modified: 2026-07-26
draft: false
tags:
  - linux
  - virtualization
  - x86
aliases: []
description: 物理LinuxとKVM/QEMU上のゲストLinuxを比較し、VMM、VMX root/non-root、ring 0/3、CPU・メモリ・I/Oの経路を整理する。
---

仮想マシンを理解するときは、まず「ゲストOSも独立したOSである」と捉えるとよい。

ゲストカーネルは自分のプロセス、仮想メモリ、仮想デバイスを管理するが、その土台となるCPU時間、実メモリ、実デバイスはホスト側のVMMスタックが制御する。

このページでは、x86-64のKVM/QEMUを主な例に、次の四つを一続きの仕組みとして読む。

- 物理ホストとゲストOSで、起動がどのように二重になるか
- VMMがホスト、ゲスト、CPUの間でどこに位置するか
- VMX root/non-rootとring 0/3が、なぜ別の軸なのか
- CPU、メモリ、I/Oで、実際にどの主体が何を処理するか

## 1. 最初に分けるべき四つの境界

「仮想化」という言葉だけでは、複数の異なる境界が混ざりやすい。

| 境界       | 問い                | 代表的な語               | 何を決めるか                     |
| -------- | ----------------- | ------------------- | -------------------------- |
| マシンの境界   | これはホストか、ゲストか      | host / guest        | どのOSの状態、デバイス、プロセス木を見ているか   |
| 仮想化実行の境界 | CPUはホスト状態か、ゲスト状態か | VMX root / non-root | VM entryとVM exitの対象になる実行状態 |
| OS内の特権境界 | そのOSの中でカーネルか、アプリか | CPL、ring 0 / ring 3 | 特権命令、ページ保護、system callの入口  |
| アドレスの境界  | このアドレスは誰から見たものか   | GVA / GPA / HPA     | ゲストが見えるメモリと、実際の物理メモリの対応    |

特に重要なのは、**VMX root/non-rootとring 0/3は同じものではない**ことだ。

ゲストカーネルは、VMX non-rootでありながらCPL 0で動作できる。

つまり、「ゲスト内ではカーネルとして強い権限を持つ」が、「ホストのマシン全体を支配する権限までは持たない」という状態をCPUが作れる。

## 2. 物理Linuxの起動と、ゲストLinuxの起動

Doc: [Linux-insides: Booting](https://0xax.gitbooks.io/linux-insides/content/Booting/)、[Linux x86 boot protocol](https://www.kernel.org/doc/html/latest/arch/x86/boot.html)、[UEFI Boot Manager](https://uefi.org/specs/UEFI/2.11/03_Boot_Manager.html)、[initramfs/rootfs](https://www.kernel.org/doc/html/latest/filesystems/ramfs-rootfs-initramfs.html)

指定資料のLinux-insidesはLinux 4.17を対象に、ブートローダーからカーネルへ制御が渡り、初期化・展開・CPUモード遷移が進む様子を丁寧に追っている。

ここでは、その流れを現在のUEFIとKVM/QEMUの文脈に置き直す。

### 2.1 物理マシンでは、ハードウェアの見え方を段階的に増やす

典型的な物理Linuxの起動は、概念的には次の流れである。

| 段階 | 主な実行主体                            | すること                                                         | 次へ渡すもの                  |
| ---- | --------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| 1    | CPUとファームウェア                     | リセット直後のCPUからUEFIまたはLegacy BIOSを実行する             | 起動可能なデバイスと実行環境  |
| 2    | UEFI Boot ManagerまたはBIOS側の起動処理 | OSローダー、あるいはLinux EFI stubを選んで読み込む               | カーネルを起動するための入口  |
| 3    | boot loader / EFI stub                  | Linuxカーネル、initramfs、カーネルコマンドラインなどを準備する   | boot protocolに沿った起動情報 |
| 4    | Linuxカーネル                           | CPU、メモリ、割り込み、ドライバ、初期root filesystemを初期化する | PID 1を起動できる状態         |
| 5    | PID 1と初期ユーザー空間                 | `/init` または `/sbin/init` を実行し、必要なサービスを起動する   | 通常のユーザー空間            |

UEFIでは、ファームウェアが必ず「従来型のブートローダー」だけを起動するわけではない。

UEFI Boot Managerは設定されたUEFIアプリケーションを選び、Linux EFI stubを使う構成ではLinuxカーネルイメージがその入口になれる。

また、root filesystemの探索や切り替えは、initramfs内の`/init`が担うことが多い。

ネットワーク設定や通常のデーモンの起動は、カーネル初期化そのものではなく、PID 1とその後のユーザー空間サービスの仕事である。

### 2.2 ゲストは、起動済みホストの上で「もう一台」として起動する

KVM/QEMUのゲストを起動する前に、物理ホストのLinuxはすでにPID 1まで起動済みである。

QEMUはホストのユーザー空間プロセスとして動き、KVM APIを通じてVM、vCPU、ゲストメモリ領域を作る。

そのうえでQEMUが仮想デバイスとゲスト用ファームウェアを用意し、vCPUを`KVM_RUN`で実行に入れる。

ゲストから見ると、仮想vCPUはリセット状態から起動し、仮想ファームウェア、ゲスト用ローダー、ゲストカーネル、ゲストPID 1へと進む。

![[host-and-guest-boot-flow.png|860]]

ホストPID 1とゲストPID 1は、名前が同じでも完全に別のプロセスである。

ホストから見えるのはQEMUプロセスとそのvCPUスレッドであり、ゲストから見えるのはゲスト独自のプロセス木である。

QEMUのdirect kernel bootのように、ゲストファームウェアや通常のディスク起動の一部を省略する構成もある。

それでも、起動した後のゲストカーネルとゲストPID 1は、ホストのものとは別に存在する。

## 3. VMMは一枚の「上位OS」ではなく、役割を分けたスタック

Doc: [KVM API](https://docs.kernel.org/virt/kvm/api.html)、[QEMU system emulation](https://www.qemu.org/docs/master/system/introduction.html)、[Red HatのKVM/QEMU構成説明](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/configuring_and_managing_virtualization/introducing-virtualization-in-rhel_configuring-and-managing-virtualization)

**VMM（Virtual Machine Monitor）**は、仮想マシンを動かす仕組み全体を指す総称である。

KVM/QEMUでは、単独の一枚のソフトウェアではなく、次の層が協力してVMMスタックを構成する。

| 主体         | 主な実行場所                           | 主な責任                                                                | ゲストからの見え方                |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| ホストLinux  | VMX root / CPL 0を含むホストOS         | QEMUスレッドのスケジューリング、実メモリ、実ファイル、実NIC、実ドライバ | 通常は直接見えない                |
| KVM          | ホストLinuxカーネル                    | vCPU実行、VM entry/exit、ゲストメモリの登録、仮想割り込みの一部         | 仮想CPUの土台                     |
| QEMU         | ホストのユーザー空間                   | VMの作成、機種モデル、ファームウェア、仮想デバイス、I/O backend         | 仮想マシンと仮想デバイス          |
| vhost / VFIO | 必要に応じたホストカーネル・デバイス側 | I/O経路の高速化、またはデバイスの直接割り当て                           | 高速な仮想I/Oまたはパススルー機器 |
| ゲストLinux  | VMX non-root / CPL 0                   | ゲスト内のプロセス、仮想メモリ、仮想デバイスを管理する                  | ゲスト自身のカーネル              |
| ゲストアプリ | VMX non-root / CPL 3                   | ゲスト内の通常のアプリケーション処理                                    | ユーザー空間                      |

この表から分かるように、QEMUは「ゲストOSのすべての命令を逐語的に翻訳するプログラム」ではない。

KVMを利用できる場合、大半のゲスト命令はCPU上でVMX non-rootとして直接実行される。

QEMUが主に関わるのは、仮想マシンを組み立てること、仮想デバイスを見せること、必要なI/Oをホスト側のbackendへつなぐことである。

> [!note] QEMUの「system mode」と「user mode」は別物
>
> QEMUのsystem emulationでは、ゲストOS全体と仮想ハードウェアを扱う。
>
> 一方、QEMU user modeには、あるプログラムのCPU命令とsystem callを別のホスト環境向けに変換する機能がある。
>
> 「ゲストのsystem callをホストのsystem callへ変換する」という説明は、通常のKVM/QEMUフルシステム仮想化ではなく、後者の文脈である。

## 4. VMX modeとカーネルリングは、縦と横の別軸

Doc: [Intel Software Developer’s Manual](https://www.intel.com/content/www/us/en/content-details/843820/intel-64-and-ia-32-architectures-software-developer-s-manual-combined-volumes-1-2a-2b-2c-2d-3a-3b-3c-3d-and-4.html)、[IntelのVMX root/non-root説明](https://www.intel.com/content/www/us/en/developer/articles/technical/software-security-guidance/best-practices/related-intel-security-features-technologies.html)

x86にはCPL（Current Privilege Level）としてring 0からring 3までの特権レベルがある。

一般的なLinuxでは、カーネルがring 0、アプリケーションがring 3を使い、ring 1とring 2は通常使わない。

ringは「一つのOSの内部で、誰が特権命令や保護されたメモリに触れられるか」を表す。

これとは別に、Intel VT-xのVMXにはroot operationとnon-root operationがある。

VMX modeは「ホストの実行状態か、ゲストの実行状態か」を表す。

![[vmx-modes-and-privilege-rings.png|900]]

この二軸で見ると、典型的なKVM/QEMU環境は次のように読める。

| 実行しているもの        | VMX mode | CPL | 意味                                                  |
| ----------------------- | -------- | --- | ----------------------------------------------------- |
| KVMを含むホストカーネル | root     | 0   | VMを実行・制御するホスト側の特権コード                |
| QEMU                    | root     | 3   | ホスト上の通常プロセスとして動くVMMのユーザー空間部分 |
| ゲストカーネル          | non-root | 0   | ゲスト内では完全なカーネルとして動く                  |
| ゲストアプリケーション  | non-root | 3   | ゲスト内の通常アプリケーション                        |

「ring -1」という呼び方を見かけることがある。

これはVMMがゲストより外側にいることを強調するための便利な比喩であり、VMX rootを文字どおりring 1やring -1というCPUのCPL番号に置き換えるものではない。

### 4.1 system callとVM exitは、似て見えて別の遷移

ゲストアプリケーションが`read()`や`send()`を呼ぶと、通常はゲスト内でCPL 3からCPL 0へsystem callする。

ゲストカーネルがその要求を処理してCPL 3へ戻すだけなら、ホストやQEMUへ制御は移らない。

一方で**VM exit**は、CPUがゲスト実行状態からホスト側のVMX rootへ戻る遷移である。

| 出来事                           | 通常の遷移先                       | ホスト境界をまたぐか | 例                                                    |
| -------------------------------- | ---------------------------------- | -------------------- | ----------------------------------------------------- |
| ゲストのsystem call              | ゲストアプリ → ゲストカーネル      | いいえ               | `read()`、`open()`、`mmap()`                          |
| ゲスト内の通常のページフォールト | ゲストカーネル                     | いいえ               | ゲスト自身のページテーブルを更新する                  |
| VM exit                          | ゲスト実行状態 → KVMを含むホスト側 | 必要なときだけ       | VMX制御で捕捉した命令、EPT violation、デバイスI/Oなど |
| 仮想割り込み                     | ホスト側の処理 → ゲストカーネル    | 必要に応じて         | virtio backendから完了を通知する                      |

どの命令やイベントでVM exitするかは、VMXの制御構造とKVMの設定による。

したがって、「ゲストで例外やsystem callが起きたら常にVMMへ飛ぶ」という理解は正しくない。

KVMはVM exitをまずカーネル内で処理できることがあり、ユーザー空間のQEMUまで戻すのは、デバイスモデルなどQEMUの処理が必要な場合である。

## 5. CPU、メモリ、I/Oは別々の経路でホスト資源につながる

Doc: [KVM API](https://docs.kernel.org/virt/kvm/api.html)、[QEMU virtio devices](https://www.qemu.org/docs/master/system/devices/virtio/index.html)、[virtio 1.3仕様](https://docs.oasis-open.org/virtio/virtio/v1.3/virtio-v1.3.html)、[Intel EPTの説明](https://www.intel.com/content/www/us/en/developer/articles/technical/increase-performance-of-vm-workloads-with-thp.html)

VMMを「ゲストとハードウェアの間に置かれた一つの箱」と考えると、処理の実態を見失いやすい。

CPU実行、メモリ変換、デバイスI/Oはそれぞれ別の経路を通る。

![[guest-resource-access-paths.png|980]]

### 5.1 CPU: ゲストのスケジューラとホストのスケジューラが重なる

ゲストLinuxのスケジューラは、ゲスト内の実行可能なプロセスをどのvCPUで動かすか決める。

一方、ホストLinuxのスケジューラは、QEMUのvCPUスレッドをどの物理CPUでいつ動かすか決める。

```text
ゲスト scheduler: ゲストプロセス → vCPU
ホスト scheduler: QEMUのvCPUスレッド → 物理CPU
```

このため、ゲストからは実行可能に見えるプロセスでも、対応するvCPUスレッドがホストで実行されていない時間があり得る。

ゲストOSが観測するsteal timeを理解する出発点も、この二重のスケジューリングである。

vCPUスレッドが`KVM_RUN`を呼ぶと、KVMはVM entryを行い、CPUはゲストの多くの命令をVMX non-rootで直接実行する。

捕捉が必要な出来事でVM exitが発生した場合だけ、KVMがホスト側へ戻り、必要ならQEMUにも処理を渡してからVM entryでゲストを再開する。

### 5.2 メモリ: ゲストの物理アドレスは、ホストの物理アドレスではない

ゲストアプリケーションが使う仮想アドレスは、次の二段階で実メモリに対応づく。

```text
GVA (Guest Virtual Address)
  → ゲストのページテーブル
GPA (Guest Physical Address)
  → EPT / NPT
HPA (Host Physical Address)
```

ゲストカーネルは、主にGVAからGPAへの対応を管理する。

GPAからHPAへの対応は、IntelではEPT、AMDではNPTと呼ばれる二段階ページ変換と、KVMが登録したメモリ領域によって制御される。

実装上は、QEMUが確保したホスト側メモリをKVMのmemory slotとしてゲストのGPAへ対応づけ、最終的な物理ページの管理はホストLinuxが担う。

このため、ゲストカーネルがCPL 0であっても、別のVMやホストのHPAを勝手にGPAへ対応づけることはできない。

EPT violationは、この後半の対応が存在しない、またはアクセス権が足りないときに起き、VM exitの契機になり得る。

### 5.3 I/O: 仮想デバイスの要求を、host側のbackendへ受け渡す

virtioを使うと、ゲストカーネルのvirtioドライバは共有メモリ上のvirtqueueにdescriptorを置き、backendへ要求を通知する。

backendはQEMUのユーザー空間処理である場合もあれば、vhostのようにホストカーネル側へ寄せられる場合もある。

backendがホスト上のファイル、ブロックデバイス、NICなどを使って処理を終えると、used ringを更新し、仮想割り込みでゲストへ完了を伝える。

古典的なMMIOやPIOのデバイスアクセスでは、KVMからQEMUへ処理が戻ることがある。

一方で、in-kernel irqchip、ioeventfd、irqfd、vhostなどを使うと、QEMUが個々の通知を毎回処理しない高速経路を作れる。

VFIOによるデバイスパススルーでは、IOMMUでDMA可能な範囲を制限したうえで、実デバイスをゲストへ近い形で割り当てる。

## 6. 具体例: ゲストアプリが仮想ディスクを`read()`するまで

ゲストアプリケーションが仮想ディスク上のファイルを読む場面を追うと、system callとI/Oの違いが見えやすい。

1. ゲストアプリが`read()`を呼び、CPL 3からゲストカーネルのCPL 0へ入る。
2. ゲストカーネルのページキャッシュに必要なデータがあれば、処理はゲスト内で完結してアプリへ戻る。
3. キャッシュにデータがなければ、ゲストのVFS、ブロック層、virtio-blkドライバがI/O要求を作る。
4. virtioドライバはvirtqueueのdescriptorを更新し、QEMUまたはvhostのbackendへ通知する。
5. backendはホストLinuxを通じて、ホスト上のディスクイメージファイル、ブロックデバイス、またはネットワークストレージへアクセスする。
6. 完了後、backendはused ringを更新し、ゲストへ仮想割り込みを注入する。
7. ゲストカーネルは要求を完了し、最初の`read()`を呼んだゲストアプリへ結果を返す。

ここでホスト側へ渡るのは、ゲストの`read()`というsystem callそのものではなく、必要になった仮想ブロックデバイスのI/O要求である。

この区別が分かると、「QEMUがゲストのsystem callをホストのsystem callに逐語変換する」という誤解を避けられる。

## 7. 古典的なx86仮想化の難しさと、ring圧縮の正確な位置づけ

Doc: [Popek–Goldbergの仮想化要件](https://doi.org/10.1145/361011.361073)、[Intel Virtualization Technologyの解説](https://www.cs.utexas.edu/~witchel/380L/papers/uhlig05ieeecomputer-intel_virtualization_technology.pdf)

ハードウェア仮想化支援が一般化する以前、x86のフル仮想化は難しかった。

直感としては、「ゲストカーネルもring 0を必要とするが、VMMにもゲストより外側から制御する場所が必要」という問題である。

ただし、歴史的な用語はこの直感より少し細かい。

| 用語               | 正確な意味                                                                                                         | 何が困るか                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| ring deprivileging | ゲストカーネルを本来のCPL 0より低い特権へ移すこと                                                                  | 実際のCPLが変わるため、OSが期待した動作とずれる       |
| ring aliasing      | ゲストが想定するCPLと実際のCPLが違うことで、命令や状態の見え方が変わること                                         | ゲストが自分の特権状態を正しく観測できない            |
| ring compression   | 64-bit x86のセグメンテーションとページ保護の性質により、古いソフトウェア仮想化で異なる権限を十分に分けられないこと | ゲストkernelとアプリを同じCPLへ押し込める必要が生じる |

したがって、**ring compressionは「ring 0の席が一つしかない」という一般名ではない**。

これは主に、VT-x/AMD-V以前のソフトウェア中心のx86仮想化で現れた、より限定的な歴史的問題である。

代表的な解決策は次の三つである。

| 手法             | 考え方                                                       | 例                           |
| ---------------- | ------------------------------------------------------------ | ---------------------------- |
| バイナリ変換     | 問題のあるゲスト命令を実行前に書き換える                     | 初期の商用x86フル仮想化      |
| 準仮想化         | ゲストOSを変更し、特権操作をhypercallへ置き換える            | 初期のXen PV                 |
| ハードウェア支援 | VMX/SVMと二段階ページ変換で、ゲストCPL 0を保ったまま制御する | 現代のKVM、Hyper-V、ESXiなど |

古い32-bitの準仮想化では、ゲストカーネルをring 1へ置く方式が使われたことがある。

しかし、これは歴史的な実装選択であり、現代のVMX non-rootを「実質ring 1」と説明する根拠にはならない。

## 8. Type 1 / Type 2とコンテナは、補助線として使う

Doc: [LinuxのHyper-Vアーキテクチャ概要](https://cdn.kernel.org/doc/html/latest/virt/hyperv/overview.html)、[[linux/namespaces/index|Linux Namespace]]、[[linux/cgroup|cgroup]]

Type 1 / Type 2という分類はVMMの配置を大まかに説明するには便利だが、KVM/QEMUの責務分担そのものを説明するには粗い。

| 観点       | Type 1の典型                           | Type 2の典型                         | KVM/QEMUで見るべき点                                                                   |
| ---------- | -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| 配置       | ハードウェアに近いハイパーバイザが中心 | 既存OS上のアプリケーションとして動く | KVMはホストカーネル、QEMUはホストユーザー空間に分かれる                                |
| 管理用OS   | ないとは限らない                       | ホストOSが明確に存在する             | XenのDom0やHyper-Vの親パーティションのように、Type 1にも管理OS・管理ドメインがあり得る |
| 読み解く鍵 | ハイパーバイザの境界                   | ホストOSとVMアプリの境界             | CPU、メモリ、I/Oの責任がどこにあるか                                                   |

コンテナとの違いも、「VMはハードウェア、コンテナはソフトウェア」という二分法では捉えない。

| 観点             | 仮想マシン                               | コンテナ                                             |
| ---------------- | ---------------------------------------- | ---------------------------------------------------- |
| カーネル         | 各VMが独自のゲストカーネルを持つ         | ホストカーネルを共有する                             |
| アドレス変換     | GVA → GPA → HPAという二段階が中心        | ホストカーネルの通常の仮想メモリ管理を共有する       |
| 分離の主な仕組み | VMX/SVM、EPT/NPT、VMM、必要に応じてIOMMU | namespace、cgroup、capability、LSM、通常のページ保護 |
| system call      | まずゲストカーネルへ入る                 | 直接ホストカーネルへ入る                             |

どちらもCPUの特権リングとMMUの保護機構を土台にしている。

違うのは、VMではゲストカーネル自体を独立したマシンとして見せるのに対し、コンテナでは一つのホストカーネルの中でプロセスの見え方と資源を分ける点である。

関連: [[containers/index|コンテナ]]、[[linux/namespaces/index|Linux Namespace]]、[[linux/cgroup|cgroup]]

## 9. 隔離をringだけで説明しない

ゲストカーネルがring 0で動いていても、それはあくまでゲスト内でのring 0である。

GPAからHPAへの変換、VMXの実行制御、仮想デバイスの実装、DMAに対するIOMMUなどが組み合わさって、ゲストがホストや他のゲストへ直接触れない境界を作る。

ゲストカーネルの脆弱性は通常そのゲスト内の権限昇格につながる。

一方で、ホストカーネル、KVM、QEMU、デバイスbackend、IOMMU設定、CPUの仮想化機能に問題があれば、VM境界に影響する可能性がある。

ring 0は「安全である」という印ではなく、CPUから見て強い操作が許可された実行権限である。

## 10. まとめ: 迷ったときの追跡順

仮想化中の出来事を理解したいときは、次の順に追う。

1. これはホストの処理か、ゲストの処理かを決める。
2. その処理はゲスト内のCPL 3 ↔ CPL 0の遷移か、VM exitを伴う処理かを分ける。
3. CPU、メモリ、I/Oのどの経路かを選ぶ。
4. I/Oなら、仮想デバイスのfrontend、backend、最終的なホスト資源まで追う。
5. メモリなら、GVA、GPA、HPAのどこを指しているか確認する。

この順で読むと、VMMは「ゲストの上に常に載っている一個の箱」ではなく、CPU実行、メモリ変換、デバイスI/Oをそれぞれ支えるホスト側の仕組みとして見えてくる。

## さらに調べる

- nested virtualization: ゲストの中でさらにVMを動かすと、VMXの階層をどのように仮想化するか
- KVM MMU: shadow page tableとEPT/NPTの役割分担、memory slot、huge page
- virtioとvhost: virtqueue、notification、割り込みの高速化
- VFIOとIOMMU: デバイスパススルーでDMAの隔離をどう保つか
- UEFI Secure Bootとmeasured boot: 起動連鎖の信頼をどこまで検証するか

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
