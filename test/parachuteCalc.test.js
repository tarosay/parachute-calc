const test = require('node:test');
const assert = require('node:assert');
const P = require('../docs/parachuteCalc.js');

const near = (a, b, tol) => Math.abs(a - b) <= tol;

test('空気密度：海面標準大気（15℃, 1013.25hPa, 乾燥）で 1.225 kg/m3 になる', () => {
  const rho = P.airDensity(15, 1013.25, 0);
  assert.ok(near(rho, 1.225, 0.001), `rho=${rho}`);
});

test('空気密度：湿度が上がると軽くなる', () => {
  assert.ok(P.airDensity(28, 1010, 90) < P.airDensity(28, 1010, 0));
});

test('円形：手計算と一致する（275g, 8m/s, 穴なし, rho=1.225, Cd=0.75）', () => {
  const r = P.calculate({
    shape: 'circle', massG: 275, targetV: 8, ventRatio: 0, rho: 1.225, cd: 0.75,
  });
  // S = 2mg/(rho*Cd*v^2) = 2*0.275*9.80665/(1.225*0.75*64)
  const S = 2 * 0.275 * 9.80665 / (1.225 * 0.75 * 64);
  const D = Math.sqrt(4 * S / Math.PI) * 1000;
  assert.ok(near(r.diameterMm, D, 0.01), `${r.diameterMm} vs ${D}`);
  assert.ok(near(r.effAreaM2, S, 1e-9));
});

test('正八角形：対辺・一辺が対角から正しく出る', () => {
  const r = P.calculate({ shape: 'octagon', massG: 275, targetV: 8, ventRatio: 0, rho: 1.225 });
  assert.ok(near(r.acrossFlatsMm, r.diameterMm * Math.cos(Math.PI / 8), 1e-6));
  assert.ok(near(r.octSideMm, r.diameterMm * Math.sin(Math.PI / 8), 1e-6));
  // 面積は 2(√2-1) * 対辺^2 とも一致する
  const w = r.acrossFlatsMm / 1000;
  assert.ok(near(r.canopyAreaM2, 2 * (Math.SQRT2 - 1) * w * w, 1e-9));
});

test('正八角形は同じ対角の円形より面積が小さい', () => {
  const base = { massG: 275, solveFor: 'speed', diameterMm: 500, ventRatio: 0, rho: 1.225 };
  const c = P.calculate(Object.assign({}, base, { shape: 'circle' }));
  const o = P.calculate(Object.assign({}, base, { shape: 'octagon' }));
  assert.ok(o.canopyAreaM2 < c.canopyAreaM2);
  assert.ok(o.descentSpeed > c.descentSpeed);   // 面積が小さいぶん速く落ちる
});

test('外径→速度→外径 で往復しても元に戻る', () => {
  const a = P.calculate({ shape: 'octagon', massG: 275, targetV: 7.3, ventRatio: 12, rho: 1.19 });
  const b = P.calculate({
    shape: 'octagon', massG: 275, solveFor: 'speed',
    diameterMm: a.diameterMm, ventRatio: 12, rho: 1.19,
  });
  assert.ok(near(b.descentSpeed, 7.3, 1e-9), `${b.descentSpeed}`);
});

test('穴径を求めるモード：求めた穴を入れ直すと同じ速度になる', () => {
  const a = P.calculate({
    shape: 'circle', massG: 280, solveFor: 'vent', diameterMm: 450, targetV: 9, rho: 1.2,
  });
  const b = P.calculate({
    shape: 'circle', massG: 280, solveFor: 'speed', diameterMm: 450,
    ventMode: 'mm', ventDiaMm: a.ventDiaMm, rho: 1.2,
  });
  assert.ok(near(b.descentSpeed, 9, 1e-9), `${b.descentSpeed}`);
});

test('穴を大きくすると必要な外径も大きくなる', () => {
  const base = { shape: 'octagon', massG: 275, targetV: 8, rho: 1.225 };
  const noVent = P.calculate(Object.assign({}, base, { ventRatio: 0 }));
  const vent20 = P.calculate(Object.assign({}, base, { ventRatio: 20 }));
  assert.ok(vent20.diameterMm > noVent.diameterMm);
});

test('外径が小さすぎて目標速度に届かないときはエラーになる', () => {
  assert.throws(() => P.calculate({
    shape: 'circle', massG: 300, solveFor: 'vent', diameterMm: 150, targetV: 5, rho: 1.225,
  }), /外径が小さすぎます/);
});

test('高度平均の風速：80m で地上10m の約 1.17 倍', () => {
  const v = P.meanWind(3, 80);
  assert.ok(near(v / 3, Math.pow(8, 0.14) / 1.14, 1e-12));
  assert.ok(near(v, 3.5207, 0.001), `${v}`);
});

test('風向 180°（南風）なら北へ流れる', () => {
  const r = P.calculate({
    shape: 'circle', massG: 275, targetV: 8, ventRatio: 0, rho: 1.225,
    heightM: 80, wind10: 3, windDirDeg: 180, lat: 33.437673, lon: 135.763131,
  });
  assert.strictEqual(r.driftBearingDeg, 0);
  assert.strictEqual(P.bearingToJa(r.driftBearingDeg), '北');
  assert.ok(r.landing.lat > 33.437673);                     // 北へ動く
  assert.ok(near(r.landing.lon, 135.763131, 1e-9));         // 東西には動かない
});

test('規定チェック：重量と降下速度が範囲外だと警告が出る', () => {
  const light = P.calculate({
    shape: 'circle', massG: 200, targetV: 8, ventRatio: 0, rho: 1.225,
  });
  assert.ok(light.warnings.some((w) => w.includes('総重量')));

  const slow = P.calculate({
    shape: 'circle', massG: 275, targetV: 4, ventRatio: 0, rho: 1.225,
  });
  assert.ok(slow.warnings.some((w) => w.includes('下限')));

  const fast = P.calculate({
    shape: 'circle', massG: 275, targetV: 12, ventRatio: 0, rho: 1.225,
  });
  assert.ok(fast.warnings.some((w) => w.includes('上限')));
});

test('規定チェック：規定どおりなら警告が出ない', () => {
  const r = P.calculate({
    shape: 'octagon', massG: 275, targetV: 8, ventRatio: 15, rho: 1.225,
    heightM: 80, wind10: 3, windDirDeg: 180,
  });
  assert.deepStrictEqual(r.warnings, []);
});

test('穴が大きすぎると使えない旨の警告が出る', () => {
  const r = P.calculate({
    shape: 'circle', massG: 275, solveFor: 'vent', diameterMm: 700, targetV: 8, rho: 1.225,
  });
  assert.ok(r.ventRatioPct > 30);
  assert.ok(r.warnings.some((w) => w.includes('ふつうは 10〜20')));
});

test('缶サットの容積は約 450 cm3', () => {
  assert.ok(near(P.RULES.cansatVolumeCm3, 450.2, 0.5), `${P.RULES.cansatVolumeCm3}`);
});

test('紐の長さは既定で外径の 1.2 倍、範囲外なら警告', () => {
  const r = P.calculate({ shape: 'circle', massG: 275, targetV: 8, ventRatio: 0, rho: 1.225 });
  assert.ok(near(r.lineRatio, 1.2, 1e-12));
  assert.ok(!r.warnings.some((w) => w.includes('吊り紐')));

  const short = P.calculate({
    shape: 'circle', massG: 275, targetV: 8, ventRatio: 0, rho: 1.225, lineLenMm: 100,
  });
  assert.ok(short.warnings.some((w) => w.includes('吊り紐')));
});

test('16方位の変換', () => {
  assert.strictEqual(P.bearingToJa(0), '北');
  assert.strictEqual(P.bearingToJa(90), '東');
  assert.strictEqual(P.bearingToJa(180), '南');
  assert.strictEqual(P.bearingToJa(270), '西');
  assert.strictEqual(P.bearingToJa(45), '北東');
  assert.strictEqual(P.bearingToJa(359), '北');
});
