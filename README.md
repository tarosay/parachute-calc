# parachute-calc

缶サット用パラシュートを設計するための小さな Web アプリです。
落ちてくるものの重さと目標の落下速度から、傘の大きさ・中央の穴・必要な布のサイズを求めます。

**https://tarosay.github.io/parachute-calc/**

宇宙甲子園 近畿地方大会 缶サット部門に **初めて参加する高校** に向けて作りました。
姉妹サイト [rocket_cp_calculator](https://tarosay.github.io/rocket_cp_calculator/)
（モデルロケット空力中心 Cp 計算）と同じ作りです。

## できること

- **傘の大きさ・落下速度・穴の大きさのうち 2 つを決めると、残り 1 つが決まる。**
  スライダーを動かすとその場で追従するので、「穴を大きくすると傘がどれだけ大きくなるか」を
  手を動かしながら確かめられます。
- **円形と正八角形**に対応。正八角形は一枚の布から直線で切り出せるので作りやすく、
  対辺（切り出す正方形の一辺）・一辺・対角の 3 つの寸法を出します。
- **大会規定のチェック。** 缶サット総重量 250〜300 g、降下速度 5〜10 m/s、
  畳んだパラシュートが 68 mmφ × 124 mm の缶に入るかを判定します。
- **当日の気象を取り込む。** 緯度経度と日時から Open-Meteo で気温・気圧・湿度・風速・風向・
  天気を取得し、実際の空気密度で計算します。取り込んだ値は手で直せます。
- **どこに落ちそうかを地図に出す。** 地理院タイル（淡色地図／航空写真）の上に、
  発射台と予想着地点、風速のぶれを見込んだ範囲を描きます。

## 使い方

ブラウザで開くだけです。既定値は宇宙甲子園 近畿地方大会（望楼の芝）に合わせてあるので、
何も入力しなくても規定を満たす設計例が出ています。

計算ロジックだけを使うこともできます。

```js
const { calculate } = require('./docs/parachuteCalc.js');

const r = calculate({
  shape: 'octagon',   // 'circle' | 'octagon'
  massG: 275,         // 落ちてくるもの全部の重さ [g]
  targetV: 8,         // 目標の落下速度 [m/s]
  ventRatio: 15,      // 中央の穴（外径に対する %）
  tempC: 28, pressureHpa: 1010, humidity: 70,
  heightM: 80, wind10: 3, windDirDeg: 180,
});

console.log(r.acrossFlatsMm);  // 切り出す正方形の一辺 [mm]
console.log(r.descentSpeed);   // 実際の落下速度 [m/s]
console.log(r.driftM);         // 風で流される距離 [m]
```

ブラウザからは `window.ParachuteCalc`、Node.js からは CommonJS モジュールとして使えます。

## 仕様

設計の根拠、準拠した大会規定、使っている式は [docs/SPEC.md](docs/SPEC.md) にまとめてあります。

## テスト

```bash
npm test
```

Node.js 組み込みのテスト（`node --test`）で 17 件のテストを用意しています。

## 出典

- 地図: [地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)（国土地理院）
- 気象: [Open-Meteo](https://open-meteo.com/)
- 規定: 宇宙甲子園 2026 近畿地方大会 缶サット部門 開催要項
- 安全規則: [日本モデルロケット協会](https://jar.or.jp/)
