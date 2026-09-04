(function (global) {
  'use strict';

  const G       = 9.80665;   // 重力加速度 [m/s^2]
  const R_DRY   = 287.058;   // 乾燥空気の気体定数 [J/(kg*K)]
  const R_VAPOR = 461.495;   // 水蒸気の気体定数 [J/(kg*K)]
  const ALPHA   = 0.14;      // 風速のべき法則指数（開けた場所）

  // 形状ごとの面積係数。S_canopy = k * D^2 （D は外接円直径）
  const SHAPES = {
    circle:  { label: '円形',     k: Math.PI / 4 },
    octagon: { label: '正八角形', k: Math.SQRT2 / 2 },
  };

  const OCT_SIDE  = Math.sin(Math.PI / 8);  // 一辺 = 0.382683 * D
  const OCT_FLATS = Math.cos(Math.PI / 8);  // 対辺 = 0.923880 * D

  // 大会規定（宇宙甲子園 2026 近畿地方大会 缶サット部門）
  const RULES = {
    massMinG:    250,
    massMaxG:    300,
    speedMin:    5,
    speedMax:    10,
    cansatDiaMm: 68,
    cansatLenMm: 124,
  };
  // 缶サットの外形いっぱいの容積 [cm^3]
  RULES.cansatVolumeCm3 =
    Math.PI * Math.pow(RULES.cansatDiaMm / 2, 2) * RULES.cansatLenMm / 1000;

  /**
   * 湿り空気の密度 [kg/m^3]
   * @param {number} tempC       気温 [degC]
   * @param {number} pressureHpa 気圧 [hPa]
   * @param {number} humidity    相対湿度 [%]
   */
  function airDensity(tempC, pressureHpa, humidity) {
    if (!Number.isFinite(tempC) || !Number.isFinite(pressureHpa)) {
      throw new Error('気温と気圧は数値で指定してください。');
    }
    const tK = tempC + 273.15;
    if (tK <= 0) throw new Error('気温が絶対零度を下回っています。');
    const p  = pressureHpa * 100;   // Pa
    const rh = Number.isFinite(humidity) ? humidity : 0;
    // Tetens の式による飽和水蒸気圧 [Pa]
    const pSat = 610.78 * Math.exp(17.27 * tempC / (tempC + 237.3));
    const pV   = Math.max(0, Math.min(rh, 100)) / 100 * pSat;
    const pD   = p - pV;
    return pD / (R_DRY * tK) + pV / (R_VAPOR * tK);
  }

  /** 高度 heightM までの平均風速 [m/s]（地上 10m の風速からべき法則で） */
  function meanWind(wind10, heightM) {
    if (!Number.isFinite(wind10) || wind10 <= 0) return 0;
    if (!Number.isFinite(heightM) || heightM <= 0) return 0;
    return wind10 * Math.pow(heightM / 10, ALPHA) / (ALPHA + 1);
  }

  /** 発射点から方位 bearingDeg へ dist [m] 進んだ地点の緯度経度（平面近似） */
  function offsetLatLon(lat0, lon0, dist, bearingDeg) {
    const rad = bearingDeg * Math.PI / 180;
    return {
      lat: lat0 + (dist * Math.cos(rad)) / 111320,
      lon: lon0 + (dist * Math.sin(rad)) / (111320 * Math.cos(lat0 * Math.PI / 180)),
    };
  }

  /** 方位角を 16 方位の日本語に直す */
  function bearingToJa(deg) {
    if (!Number.isFinite(deg)) return '—';
    const names = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
                   '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
    const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
    return names[idx];
  }

  function num(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
  }

  /** 穴径 [m] を求める。ventMode が 'ratio' なら外径に対する比、'mm' なら実寸 */
  function ventDiameter(p, ventMode, D) {
    if (ventMode === 'ratio') {
      return clamp(num(p.ventRatio, 15) / 100, 0, 0.95) * D;
    }
    return Math.max(0, num(p.ventDiaMm, 0) / 1000);
  }

  /**
   * パラシュートを設計する。
   *
   * solveFor が 'diameter' なら 落下速度と穴径から外径を、
   *            'speed'    なら 外径と穴径から落下速度を、
   *            'vent'     なら 外径と落下速度から穴径を求める。
   */
  function calculate(params) {
    const p = params || {};
    const shapeKey = SHAPES[p.shape] ? p.shape : 'octagon';
    const shape    = SHAPES[shapeKey];
    const k        = shape.k;

    const massG = num(p.massG, 275);
    const cd    = num(p.cd, 0.75);
    const rho   = Number.isFinite(p.rho)
      ? p.rho
      : airDensity(num(p.tempC, 15), num(p.pressureHpa, 1013.25), num(p.humidity, 60));

    if (massG <= 0) throw new Error('重量は正の数で入力してください。');
    if (cd    <= 0) throw new Error('抗力係数 Cd は正の数で入力してください。');
    if (rho   <= 0) throw new Error('空気密度が正の数になりません。気温・気圧を確認してください。');

    const m = massG / 1000;   // kg
    const solveFor = ['diameter', 'speed', 'vent'].indexOf(p.solveFor) >= 0 ? p.solveFor : 'diameter';
    const ventMode = p.ventMode === 'mm' ? 'mm' : 'ratio';

    const warnings = [];
    let D;   // 外接円直径 [m]
    let d;   // 穴径 [m]
    let v;   // 降下速度 [m/s]

    if (solveFor === 'diameter') {
      v = num(p.targetV, 8);
      if (v <= 0) throw new Error('落下速度は正の数で入力してください。');
      const sNeeded = 2 * m * G / (rho * cd * v * v);   // 必要な有効面積
      if (ventMode === 'ratio') {
        const r    = clamp(num(p.ventRatio, 15) / 100, 0, 0.95);
        const coef = k - Math.PI * r * r / 4;           // S_eff = D^2 * coef
        if (coef <= 0) {
          throw new Error('穴が大きすぎて有効面積が残りません。穴径比を小さくしてください。');
        }
        D = Math.sqrt(sNeeded / coef);
        d = r * D;
      } else {
        d = Math.max(0, num(p.ventDiaMm, 0) / 1000);
        D = Math.sqrt((sNeeded + Math.PI * d * d / 4) / k);
        if (d >= D) throw new Error('穴径が外径以上になっています。穴を小さくしてください。');
      }
    } else if (solveFor === 'speed') {
      D = num(p.diameterMm, 400) / 1000;
      if (D <= 0) throw new Error('外径は正の数で入力してください。');
      d = ventDiameter(p, ventMode, D);
      const sEff = k * D * D - Math.PI * d * d / 4;
      if (sEff <= 0) throw new Error('穴が大きすぎて有効面積が残りません。');
      v = Math.sqrt(2 * m * G / (rho * cd * sEff));
    } else {
      D = num(p.diameterMm, 400) / 1000;
      v = num(p.targetV, 8);
      if (D <= 0) throw new Error('外径は正の数で入力してください。');
      if (v <= 0) throw new Error('落下速度は正の数で入力してください。');
      const sNeeded = 2 * m * G / (rho * cd * v * v);
      const sVent   = k * D * D - sNeeded;
      if (sVent < 0) {
        const vMax = Math.sqrt(2 * m * G / (rho * cd * k * D * D));
        throw new Error(
          '外径が小さすぎます。穴を開けなくても ' + vMax.toFixed(2) +
          ' m/s にしかならないので、外径を大きくしてください。');
      }
      d = Math.sqrt(4 * sVent / Math.PI);
    }

    const sCanopy = k * D * D;
    const sVent   = Math.PI * d * d / 4;
    const sEff    = sCanopy - sVent;

    // 布の切り出し寸法：円形は直径、正八角形は対辺（＝正方形の一辺）が基準
    const acrossFlats    = shapeKey === 'octagon' ? D * OCT_FLATS : D;
    const octSide        = shapeKey === 'octagon' ? D * OCT_SIDE  : null;
    const hemMm          = Math.max(0, num(p.hemMm, 15));
    const fabricSquareMm = acrossFlats * 1000 + hemMm * 2;

    // 吊り紐
    const lineCount = Math.max(1, Math.round(num(p.lineCount, 8)));
    const lineLenMm = (Number.isFinite(p.lineLenMm) && p.lineLenMm > 0)
      ? p.lineLenMm : D * 1000 * 1.2;
    const lineRatio = lineLenMm / (D * 1000);

    // 布の重量と畳んだ体積
    const fabricGsm       = Math.max(0, num(p.fabricGsm, 40));
    const fabricThickness = Math.max(0, num(p.fabricThicknessMm, 0.05));
    const packing         = clamp(num(p.packing, 0.5), 0.05, 1);
    const fabricMassG     = sEff * fabricGsm;
    const packedVolumeCm3 = sEff * (fabricThickness / 1000) / packing * 1e6;
    const packedRatio     = packedVolumeCm3 / RULES.cansatVolumeCm3;

    // 降下と風
    const heightM      = Math.max(0, num(p.heightM, 80));
    const descentTimeS = v > 0 ? heightM / v : 0;
    const wind10       = Math.max(0, num(p.wind10, 0));
    const meanWindMs   = meanWind(wind10, heightM);
    const driftM       = meanWindMs * descentTimeS;
    const windDir      = num(p.windDirDeg, NaN);
    const driftBearingDeg = Number.isFinite(windDir) ? (windDir + 180) % 360 : null;

    let landing = null;
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon) && driftBearingDeg !== null) {
      landing = offsetLatLon(p.lat, p.lon, driftM, driftBearingDeg);
    }

    // 規定チェック
    if (p.checkRules !== false) {
      if (massG < RULES.massMinG || massG > RULES.massMaxG) {
        warnings.push('缶サット総重量 ' + massG.toFixed(0) + ' g は規定（' +
          RULES.massMinG + '〜' + RULES.massMaxG + ' g）の外です。');
      }
      if (v < RULES.speedMin) {
        warnings.push('降下速度 ' + v.toFixed(2) + ' m/s は規定の下限 ' + RULES.speedMin +
          ' m/s を下回っています。遅すぎても規定外です。');
      } else if (v > RULES.speedMax) {
        warnings.push('降下速度 ' + v.toFixed(2) + ' m/s は規定の上限 ' + RULES.speedMax +
          ' m/s を超えています。');
      }
    }
    const ventPct = D > 0 ? d / D * 100 : 0;
    if (ventPct > 30) {
      warnings.push('中央の穴が外径の ' + ventPct.toFixed(0) +
        ' % もあります。ふつうは 10〜20 % です。ここまで大きいと傘の形にならず、' +
        'この計算（穴の面積を差し引く方法）も当てになりません。外径を小さくするか、' +
        '目標の落下速度を見直してください。');
    }
    if (lineRatio < 1.0) {
      warnings.push('吊り紐が外径の ' + lineRatio.toFixed(2) +
        ' 倍しかありません。1.0〜1.5 倍が目安で、短いと傘がうまく開きません。');
    } else if (lineRatio > 1.5) {
      warnings.push('吊り紐が外径の ' + lineRatio.toFixed(2) +
        ' 倍あります。1.0〜1.5 倍が目安で、長すぎると絡みやすくなります。');
    }
    if (packedRatio > 0.5) {
      warnings.push('畳んだパラシュートが缶の容積の ' + (packedRatio * 100).toFixed(0) +
        ' % を占めます。本体が入らなくなるかもしれません。薄い布を使うか外径を見直してください。');
    }

    return {
      shape: shapeKey,
      shapeLabel: shape.label,
      // 寸法（すべて mm）
      diameterMm:    D * 1000,
      acrossFlatsMm: acrossFlats * 1000,
      octSideMm:     octSide === null ? null : octSide * 1000,
      ventDiaMm:     d * 1000,
      ventRatioPct:  D > 0 ? d / D * 100 : 0,
      fabricSquareMm,
      hemMm,
      // 面積 [m^2]
      canopyAreaM2: sCanopy,
      ventAreaM2:   sVent,
      effAreaM2:    sEff,
      // 速度と条件
      descentSpeed: v,
      rho,
      cd,
      massG,
      // 吊り紐
      lineCount,
      lineLenMm,
      lineRatio,
      lineTotalMm:        lineLenMm * lineCount,
      lineRecommendMinMm: D * 1000 * 1.0,
      lineRecommendMaxMm: D * 1000 * 1.5,
      // 布と収納
      fabricMassG,
      packedVolumeCm3,
      packedRatio,
      cansatVolumeCm3: RULES.cansatVolumeCm3,
      // 降下と風
      heightM,
      descentTimeS,
      meanWindMs,
      driftM,
      driftBearingDeg,
      landing,
      warnings,
    };
  }

  const api = {
    G, ALPHA, SHAPES, RULES, OCT_SIDE, OCT_FLATS,
    airDensity, meanWind, offsetLatLon, bearingToJa, calculate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ParachuteCalc = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
