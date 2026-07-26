# 実装根拠

## 参照資料

- [SIOS Tech. Lab「生成AIに図解を描かせるなら HTML + Tailwind CSS が良い」](https://tech-lab.sios.jp/archives/51249)
- [Tailwind CSS Play CDN](https://tailwindcss.com/docs/installation/play-cdn)
- [Playwright `locator.screenshot`](https://playwright.dev/docs/api/class-locator#locator-screenshot)

## 採用した考え方

- HTMLを編集可能な原本として残し、最終成果物をPNGにする
- Tailwindユーティリティで配置と装飾を同じHTMLに記述する
- 作例とデザイン基準を分離し、再利用時に参照できるようにする
- Playwrightで対象要素だけを撮影する
- 固定キャンバス寸法をHTML属性とCSSの両方で宣言する
- CSS上の論理寸法は図の外接矩形と実際の表示幅から決め、PNGの高密度化は
  `--scale 2`で行う
- 図全体のタイトルやスライド比率を既定にせず、平面的なノード、線、直接ラベルを
  必要な範囲だけ配置する

## 追加した安全策

TailwindのPlay CDNは開発用途向けであり、ネットワーク状態によって結果が変わり得る。
そのため、HTMLは通常のブラウザーで開けるCDN表記を保ちつつ、レンダラーでは固定版の同梱ランタイムへ差し替える。

レンダラーはメインHTMLと同梱Tailwind以外の要求を遮断する。
入力HTMLの実行可能スクリプト、インラインイベント、ポップアップ、WebSocket、サービスワーカー、能動的な埋め込み要素も禁止する。
画像要素、`data:` URL、SVG SMIL、`marquee`、宣言的Shadow DOMを作る`template`も禁止し、静止したHTMLとインラインSVGだけを撮影する。
CSSアニメーションとトランジションは、停止用CSSを追加する前の計算済みスタイルで検出し、検査時と撮影時の状態が変わる入力を不適合とする。
検査を省略したChromeコマンド単体のフォールバックは設けない。

`omitBackground: true`だけでは、HTML側の全面背景を除去できない。
DOMの背景色・背景画像、`#diagram`の祖先ラッパー、面積の90%以上を覆う子要素、PNG四隅、PNG外周帯と全体の透明率を組み合わせて実透過を判定する。
祖先ラッパーによるクリッピングや描画効果も不適合とする。
SVGストロークは`getScreenCTM()`による画面上の拡大率と`stroke-miterlimit`を含めて外延を見積もり、キャンバス端で切れる可能性がある場合は不適合とする。
`contain: paint`、旧式の`clip`、`border-image`、ボックス反射など、要素矩形だけでは描画範囲を確定できないCSSも不適合とする。

PNGとレポートは一時ディレクトリで完成させてから配置する。
`--force`指定時は旧PNGと旧レポートを先に無効化し、途中失敗後に以前の`success: true`だけが残らないようにする。
