(function () {
  'use strict';

  const P = window.ParachuteCalc;
  const $ = (id) => document.getElementById(id);

  const form       = $('pForm');
  const resultDiv  = $('result');
  const ruleDiv    = $('ruleCheck');
  const foreDiv    = $('forecast');
  const detailDiv  = $('details');
  const diagramDiv = $('diagram');

  // 数値入力とスライダーの組
  const PAIRS = [
    ['massG', 'massRange'],
    ['targetV', 'vRange'],
    ['diameterMm', 'dRange'],
    ['ventRatio', 'ventRange'],
  ];

  // WMO 天気コード
  const WEATHER = {
    0: '快晴', 1: '晴れ', 2: '一部くもり', 3: 'くもり',
    45: '霧', 48: '霧（樹氷）',
    51: '霧雨（弱）', 53: '霧雨', 55: '霧雨（強）',
    56: '着氷性の霧雨', 57: '着氷性の霧雨（強）',
    61: '雨（弱）', 63: '雨', 65: '雨（強）',
    66: '着氷性の雨', 67: '着氷性の雨（強）',
    71: '雪（弱）', 73: '雪', 75: '雪（強）', 77: '霧雪',
    80: 'にわか雨（弱）', 81: 'にわか雨', 82: 'にわか雨（激しい）',
    85: 'にわか雪', 86: 'にわか雪（強）',
    95: '雷雨', 96: '雷雨（ひょう）', 99: '雷雨（激しいひょう）',
  };

  const numOf = (id) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : NaN;
  };

  function solveFor() {
    const el = form.querySelector('input[name="solveFor"]:checked');
    return el ? el.value : 'diameter';
  }

  /* ---------------- 入力の見せ方 ---------------- */

  function applyVisibility() {
    const mode = solveFor();
    form.querySelectorAll('[data-when]').forEach((el) => {
      el.style.display = el.dataset.when.split(' ').includes(mode) ? '' : 'none';
    });
    const byRatio = $('ventMode').value === 'ratio';
    $('ventRatio').style.display  = byRatio ? '' : 'none';
    $('ventRange').style.display  = byRatio ? '' : 'none';
    $('ventDiaMm').style.display  = byRatio ? 'none' : '';
  }

  function syncLabels() {
    $('massUnit').textContent = fmt(numOf('massG'), 0) + ' g';
    $('vUnit').textContent    = fmt(numOf('targetV'), 1) + ' m/s';
    $('dUnit').textContent    = fmt(numOf('diameterMm'), 0) + ' mm';
    $('hUnit').textContent    = fmt(numOf('heightM'), 0) + ' m';
    $('ventUnit').textContent = $('ventMode').value === 'ratio'
      ? fmt(numOf('ventRatio'), 0) + ' %'
      : fmt(numOf('ventDiaMm'), 0) + ' mm';
    const wd = numOf('windDirDeg');
    $('windDirName').textContent = Number.isFinite(wd)
      ? P.bearingToJa(wd) + ' から吹く' : '';
  }

  function fmt(v, digits) {
    return Number.isFinite(v) ? v.toFixed(digits) : '—';
  }

  /* ---------------- 計算 ---------------- */

  function collect() {
    const lineLen = numOf('lineLenMm');
    return {
      shape:    $('shape').value,
      solveFor: solveFor(),
      massG:    numOf('massG'),
      targetV:  numOf('targetV'),
      diameterMm: numOf('diameterMm'),
      ventMode: $('ventMode').value,
      ventRatio: numOf('ventRatio'),
      ventDiaMm: numOf('ventDiaMm'),
      cd:       numOf('cd'),
      tempC:      numOf('tempC'),
      pressureHpa: numOf('pressureHpa'),
      humidity:   numOf('humidity'),
      heightM:    numOf('heightM'),
      wind10:     numOf('wind10'),
      windDirDeg: numOf('windDirDeg'),
      lat: numOf('lat'),
      lon: numOf('lon'),
      fabricGsm: numOf('fabricGsm'),
      fabricThicknessMm: numOf('fabricThicknessMm'),
      hemMm: numOf('hemMm'),
      lineCount: numOf('lineCount'),
      lineLenMm: Number.isFinite(lineLen) && lineLen > 0 ? lineLen : undefined,
    };
  }

  let lastResult = null;

  function render() {
    applyVisibility();
    syncLabels();

    let r;
    try {
      r = P.calculate(collect());
    } catch (err) {
      lastResult = null;
      resultDiv.innerHTML = '<strong>結果</strong><span class="err">' + err.message + '</span>';
      ruleDiv.innerHTML = '';
      foreDiv.innerHTML = '';
      detailDiv.innerHTML = '';
      hideEmptyCards();
      drawDiagram(null);
      return;
    }
    lastResult = r;

    const isOct = r.shape === 'octagon';
    const sizeRows = isOct
      ? '<tr><th>中心から頂点まで R<br><span style="color:#999;font-size:0.75rem;">' +
          'コンパスの半径。これで円を描き 45° ごとに 8 点</span></th><td>' +
          r.circumradiusMm.toFixed(0) + ' mm</td></tr>' +
        '<tr><th>対辺（切り出す正方形の一辺）</th><td>' + r.acrossFlatsMm.toFixed(0) + ' mm</td></tr>' +
        '<tr><th>一辺</th><td>' + r.octSideMm.toFixed(0) + ' mm</td></tr>' +
        '<tr><th>対角</th><td>' + r.diameterMm.toFixed(0) + ' mm</td></tr>'
      : '<tr><th>直径</th><td>' + r.diameterMm.toFixed(0) + ' mm</td></tr>' +
        '<tr><th>半径 R<br><span style="color:#999;font-size:0.75rem;">' +
          'コンパスの半径</span></th><td>' + r.circumradiusMm.toFixed(0) + ' mm</td></tr>';

    resultDiv.innerHTML =
      '<strong>結果</strong>' +
      '<div style="margin:6px 0 10px;">' +
        '<span class="big">' + (isOct ? r.acrossFlatsMm.toFixed(0) : r.diameterMm.toFixed(0)) + ' mm</span> ' +
        '<span style="color:#666;font-size:0.85rem;">' +
          (isOct ? 'の正方形から正八角形を切り出す' : 'の円を切り出す') + '</span><br>' +
        '<span class="big">' + r.descentSpeed.toFixed(2) + ' m/s</span> ' +
        '<span style="color:#666;font-size:0.85rem;">で降りてきます</span>' +
      '</div>' +
      '<table class="out">' +
        sizeRows +
        '<tr><th>中央の穴</th><td>' + r.ventDiaMm.toFixed(0) + ' mm（外径の ' +
          r.ventRatioPct.toFixed(0) + ' %）</td></tr>' +
        '<tr><th>必要な布</th><td>' + r.fabricSquareMm.toFixed(0) + ' mm 角（縫い代 ' +
          r.hemMm.toFixed(0) + ' mm 込み）</td></tr>' +
        '<tr><th>布の重さ</th><td>' + r.fabricMassG.toFixed(1) + ' g</td></tr>' +
        '<tr><th>紐の長さ</th><td>' + r.lineLenMm.toFixed(0) + ' mm &times; ' +
          r.lineCount + ' 本 = ' + (r.lineTotalMm / 1000).toFixed(2) + ' m</td></tr>' +
        '<tr><th>紐の目安</th><td>' + r.lineRecommendMinMm.toFixed(0) + '〜' +
          r.lineRecommendMaxMm.toFixed(0) + ' mm</td></tr>' +
      '</table>' +
      '<p style="margin:10px 0 0;padding-top:8px;border-top:1px dashed #eee;' +
        'font-size:0.8rem;color:#c65c00;line-height:1.6;">' +
        '⚠ ここに出るのは<strong>設計の目安</strong>です。実際の抗力係数は傘の膨らみ方や' +
        '穴・紐の付け方で変わります。<strong>作ったあとは実際に落として、' +
        '降下速度を測って確かめてください。</strong></p>';

    // 規定チェック
    const checks = [];
    checks.push(rule('缶サットの重さ', r.massG >= P.RULES.massMinG && r.massG <= P.RULES.massMaxG,
      r.massG.toFixed(0) + ' g', P.RULES.massMinG + '〜' + P.RULES.massMaxG + ' g'));
    checks.push(rule('降下速度', r.descentSpeed >= P.RULES.speedMin && r.descentSpeed <= P.RULES.speedMax,
      r.descentSpeed.toFixed(2) + ' m/s', P.RULES.speedMin + '〜' + P.RULES.speedMax + ' m/s'));
    checks.push(rule('畳んだときの体積', r.packedRatio <= 0.5,
      r.packedVolumeCm3.toFixed(0) + ' cm³（缶の ' + (r.packedRatio * 100).toFixed(0) + ' %）',
      '缶の容積 ' + r.cansatVolumeCm3.toFixed(0) + ' cm³'));

    ruleDiv.innerHTML =
      '<strong>大会規定のチェック</strong>' +
      '<table class="out">' + checks.join('') + '</table>' +
      (r.warnings.length
        ? '<div class="warn">' + r.warnings.map((w) => '<p>⚠ ' + w + '</p>').join('') + '</div>'
        : '<div class="ok">✓ 気になる点はありません。</div>');

    // 当日の予想
    const bearing = r.driftBearingDeg;
    foreDiv.innerHTML =
      '<strong>当日の予想</strong>' +
      '<table class="out">' +
        '<tr><th>空気密度</th><td>' + r.rho.toFixed(4) + ' kg/m³</td></tr>' +
        '<tr><th>降下時間</th><td>' + r.descentTimeS.toFixed(1) + ' 秒（' +
          r.heightM.toFixed(0) + ' m から）</td></tr>' +
        '<tr><th>高さ方向に平均した風速</th><td>' + r.meanWindMs.toFixed(2) + ' m/s</td></tr>' +
        '<tr><th>降下中に流される距離</th><td>' + r.driftM.toFixed(0) + ' m</td></tr>' +
        '<tr><th>流される向き</th><td>' +
          (bearing === null ? '—' : P.bearingToJa(bearing) + '（' + bearing.toFixed(0) + '°）へ') +
        '</td></tr>' +
      '</table>';

    // 中間計算
    detailDiv.innerHTML =
      '<strong>この入力での途中の値</strong>' +
      '<table class="out">' +
        '<tr><th>傘の面積 S<sub>canopy</sub></th><td>' + r.canopyAreaM2.toFixed(4) + ' m²</td></tr>' +
        '<tr><th>穴の面積 S<sub>vent</sub></th><td>' + r.ventAreaM2.toFixed(4) + ' m²</td></tr>' +
        '<tr><th>効く面積 S<sub>eff</sub></th><td>' + r.effAreaM2.toFixed(4) + ' m²</td></tr>' +
        '<tr><th>抗力係数 C<sub>d</sub></th><td>' + r.cd.toFixed(2) + '</td></tr>' +
        '<tr><th>紐の長さ ÷ 外径</th><td>' + r.lineRatio.toFixed(2) + ' 倍</td></tr>' +
      '</table>';

    hideEmptyCards();
    drawDiagram(r);
    updateMap(r);
  }

  /** 中身が空になったカードは枠ごと隠す */
  function hideEmptyCards() {
    [resultDiv, ruleDiv, foreDiv, detailDiv].forEach((el) => {
      el.style.display = el.innerHTML.trim() === '' ? 'none' : '';
    });
  }

  function rule(name, ok, value, want) {
    return '<tr><th>' + (ok ? '<span class="ok">✓</span> ' : '<span style="color:#c65c00">⚠</span> ') +
      name + '</th><td>' + value +
      '<br><span style="color:#999;font-size:0.75rem;">規定 ' + want + '</span></td></tr>';
  }

  /* ---------------- 図 ---------------- */

  function drawDiagram(r) {
    if (!r) { diagramDiv.innerHTML = ''; return; }

    const R = 95;                    // 上面図の外接円半径 [px]
    const cx = 125, cy = 140;
    const isOct = r.shape === 'octagon';
    const ventR = R * (r.ventDiaMm / r.diameterMm);

    // 外形
    let outline;
    if (isOct) {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (22.5 + i * 45) * Math.PI / 180;
        pts.push((cx + R * Math.cos(a)).toFixed(1) + ',' + (cy + R * Math.sin(a)).toFixed(1));
      }
      outline = '<polygon points="' + pts.join(' ') + '" fill="#eaf4fd" stroke="#0078d7" stroke-width="2"/>';
    } else {
      outline = '<circle cx="' + cx + '" cy="' + cy + '" r="' + R +
                '" fill="#eaf4fd" stroke="#0078d7" stroke-width="2"/>';
    }

    // 作図用の半径 R を描く向き（正八角形の頂点のひとつ。右上）
    const rAng  = -22.5 * Math.PI / 180;
    const rTipX = cx + R * Math.cos(rAng);
    const rTipY = cy + R * Math.sin(rAng);
    const rLabX = cx + R * 0.70 * Math.cos(rAng);
    const rLabY = cy + R * 0.70 * Math.sin(rAng) - 6;

    // 幅の寸法（円形は直径、正八角形は対辺）
    const halfW = isOct ? R * Math.cos(Math.PI / 8) : R;
    const dimY  = cy + R + 26;
    const widthLabel = isOct
      ? '対辺 ' + r.acrossFlatsMm.toFixed(0) + ' mm'
      : '直径 ' + r.diameterMm.toFixed(0) + ' mm';

    const sideX = 360;
    const rimY  = 130;
    const apexY = 58;
    const payY  = 258;
    const gap   = Math.max(6, Math.min(30, 80 * (r.ventDiaMm / r.diameterMm)));

    // 吊り紐（左右対称に 4 本描く）
    const rim = [-80, -46, 46, 80];
    const lines = rim.map((dx) => {
      const y = rimY - (1 - Math.abs(dx) / 80) * 34;
      return '<line x1="' + (sideX + dx) + '" y1="' + y.toFixed(1) +
             '" x2="' + sideX + '" y2="' + payY + '" stroke="#888" stroke-width="1"/>';
    }).join('');

    const svg =
'<svg viewBox="0 0 520 340" xmlns="http://www.w3.org/2000/svg" role="img">' +
  '<style>' +
    '.lbl{font:11px system-ui,sans-serif;fill:#333}' +
    '.sub{font:10px system-ui,sans-serif;fill:#888}' +
    '.ttl{font:12px system-ui,sans-serif;fill:#0078d7;font-weight:600}' +
    '.dim{stroke:#bbb;stroke-width:1}' +
  '</style>' +

  '<text class="ttl" x="125" y="22" text-anchor="middle">上から見たところ</text>' +
  outline +
  // 作図用の半径 R（中心から頂点まで）
  '<line x1="' + cx + '" y1="' + cy + '" x2="' + rTipX.toFixed(1) + '" y2="' + rTipY.toFixed(1) +
    '" stroke="#0078d7" stroke-width="1" stroke-dasharray="3 2"/>' +
  '<circle cx="' + cx + '" cy="' + cy + '" r="2.2" fill="#0078d7"/>' +
  '<text class="lbl" x="' + rLabX.toFixed(1) + '" y="' + rLabY.toFixed(1) +
    '" text-anchor="middle">R ' + r.circumradiusMm.toFixed(0) + ' mm</text>' +
  '<circle cx="' + cx + '" cy="' + cy + '" r="' + ventR.toFixed(1) +
    '" fill="#fff" stroke="#0078d7" stroke-width="1.5" stroke-dasharray="4 3"/>' +
  // 幅の寸法線
  '<line class="dim" x1="' + (cx - halfW) + '" y1="' + dimY + '" x2="' + (cx + halfW) + '" y2="' + dimY + '"/>' +
  '<line class="dim" x1="' + (cx - halfW) + '" y1="' + (dimY - 5) + '" x2="' + (cx - halfW) + '" y2="' + (dimY + 5) + '"/>' +
  '<line class="dim" x1="' + (cx + halfW) + '" y1="' + (dimY - 5) + '" x2="' + (cx + halfW) + '" y2="' + (dimY + 5) + '"/>' +
  '<text class="lbl" x="' + cx + '" y="' + (dimY + 18) + '" text-anchor="middle">' + widthLabel + '</text>' +
  (isOct
    ? '<text class="sub" x="' + cx + '" y="' + (dimY + 32) + '" text-anchor="middle">一辺 ' +
      r.octSideMm.toFixed(0) + ' mm ／ 対角 ' + r.diameterMm.toFixed(0) + ' mm</text>'
    : '') +
  // 穴の寸法
  '<line class="dim" x1="' + (cx - ventR) + '" y1="' + cy + '" x2="' + (cx + ventR) + '" y2="' + cy + '"/>' +
  '<text class="lbl" x="' + cx + '" y="' + (cy - ventR - 6) + '" text-anchor="middle">穴 ' +
    r.ventDiaMm.toFixed(0) + ' mm</text>' +

  '<text class="ttl" x="360" y="22" text-anchor="middle">横から見たところ</text>' +
  // キャノピー（頂点に穴の隙間をあける）
  '<path d="M' + (sideX - 80) + ',' + rimY + ' Q' + (sideX - 50) + ',' + apexY + ' ' +
    (sideX - gap / 2) + ',' + (apexY - 2) + '" fill="none" stroke="#0078d7" stroke-width="2"/>' +
  '<path d="M' + (sideX + 80) + ',' + rimY + ' Q' + (sideX + 50) + ',' + apexY + ' ' +
    (sideX + gap / 2) + ',' + (apexY - 2) + '" fill="none" stroke="#0078d7" stroke-width="2"/>' +
  lines +
  // 缶サット（68mm x 124mm を 26 x 48px で）
  '<rect x="' + (sideX - 13) + '" y="' + payY + '" width="26" height="48" rx="4" ' +
    'fill="#fff" stroke="#333" stroke-width="1.5"/>' +
  '<text class="sub" x="' + (sideX + 22) + '" y="' + (payY + 28) + '">缶サット ' +
    r.massG.toFixed(0) + ' g</text>' +
  // 紐の長さ寸法
  '<line class="dim" x1="' + (sideX + 100) + '" y1="' + rimY + '" x2="' + (sideX + 100) + '" y2="' + payY + '"/>' +
  '<line class="dim" x1="' + (sideX + 95) + '" y1="' + rimY + '" x2="' + (sideX + 105) + '" y2="' + rimY + '"/>' +
  '<line class="dim" x1="' + (sideX + 95) + '" y1="' + payY + '" x2="' + (sideX + 105) + '" y2="' + payY + '"/>' +
  '<text class="lbl" x="' + (sideX + 108) + '" y="' + ((rimY + payY) / 2) + '">紐</text>' +
  '<text class="sub" x="' + (sideX + 108) + '" y="' + ((rimY + payY) / 2 + 13) + '">' +
    r.lineLenMm.toFixed(0) + ' mm</text>' +
  // 降下速度
  '<text class="lbl" x="' + (sideX - 100) + '" y="' + (payY + 20) + '" text-anchor="end">↓ ' +
    r.descentSpeed.toFixed(1) + ' m/s</text>' +
'</svg>';

    diagramDiv.innerHTML = svg;
  }

  /* ---------------- 地図 ---------------- */

  let map = null, baseLayers = null, launchMk = null, landMk = null, pathLn = null, errCir = null;

  function initMap() {
    const card = document.getElementById('mapCard');
    if (typeof L === 'undefined') {
      card.innerHTML = '<strong>どこに落ちそうか</strong>' +
        '<span style="color:#777;font-size:0.8rem;">地図を読み込めませんでした。' +
        '「当日の予想」の距離と向きを見てください。</span>';
      return;
    }
    card.innerHTML =
      '<strong>どこに落ちそうか</strong>' +
      '<div id="map"></div>' +
      '<div class="maprow">' +
        '<button type="button" id="btnPale" class="on">地図</button>' +
        '<button type="button" id="btnPhoto">航空写真</button>' +
      '</div>' +
      '<small style="color:#777;font-size:0.75rem;line-height:1.6;display:block;">' +
        '<strong style="color:#c65c00;">放出地点を発射台の真上と仮定した予想です。</strong>' +
        '実際にはロケットを風上へ傾けて打ち上げるため、パラシュートが開く地点そのものも、' +
        '発射台から風上側へずれることがあります。' +
        'ここでは降下中に風で流される分だけを描いています。<br>' +
        '赤が予想の着地点、円は風速が ±1 m/s ぶれたときの範囲です。</small>';

    const lat = numOf('lat'), lon = numOf('lon');
    map = L.map('map').setView([lat, lon], 16);
    const attr = '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>';
    baseLayers = {
      pale: L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
        { attribution: attr, maxZoom: 18 }),
      photo: L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        { attribution: attr, maxZoom: 18 }),
    };
    baseLayers.pale.addTo(map);

    $('btnPale').addEventListener('click', () => switchBase('pale'));
    $('btnPhoto').addEventListener('click', () => switchBase('photo'));
  }

  function switchBase(which) {
    if (!map) return;
    Object.keys(baseLayers).forEach((k) => {
      if (map.hasLayer(baseLayers[k])) map.removeLayer(baseLayers[k]);
    });
    baseLayers[which].addTo(map);
    $('btnPale').classList.toggle('on', which === 'pale');
    $('btnPhoto').classList.toggle('on', which === 'photo');
  }

  function updateMap(r) {
    if (!map) return;
    const lat = numOf('lat'), lon = numOf('lon');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    [launchMk, landMk, pathLn, errCir].forEach((l) => { if (l) map.removeLayer(l); });

    launchMk = L.circleMarker([lat, lon], {
      radius: 7, color: '#0078d7', fillColor: '#0078d7', fillOpacity: 0.9,
    }).addTo(map).bindTooltip('発射台：' + $('placeName').value);

    if (r && r.landing) {
      landMk = L.circleMarker([r.landing.lat, r.landing.lon], {
        radius: 8, color: '#c00', fillColor: '#c00', fillOpacity: 0.85,
      }).addTo(map).bindTooltip(
        '予想着地点（放出地点＝発射台の真上と仮定）<br>降下中に ' + r.driftM.toFixed(0) + ' m ' + P.bearingToJa(r.driftBearingDeg) + 'へ');

      pathLn = L.polyline([[lat, lon], [r.landing.lat, r.landing.lon]],
        { color: '#c00', weight: 2, dashArray: '6 4' }).addTo(map);

      // 風速が ±1 m/s ぶれたときの範囲
      const err = Math.max(5, r.descentTimeS * 1.0);
      errCir = L.circle([r.landing.lat, r.landing.lon], {
        radius: err, color: '#c00', weight: 1, fillOpacity: 0.08,
      }).addTo(map);

      map.fitBounds(L.latLngBounds([[lat, lon], [r.landing.lat, r.landing.lon]]).pad(0.6));
    } else {
      map.setView([lat, lon], 16);
    }
  }

  /* ---------------- 気象の取り込み ---------------- */

  async function fetchWeather() {
    const msg = $('fetchMsg');
    const lat = numOf('lat'), lon = numOf('lon');
    const dtv = $('dt').value;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !dtv) {
      msg.textContent = '緯度・経度・日時を入れてから押してください。';
      return;
    }
    const date = dtv.slice(0, 10);
    const hour = dtv.slice(11, 13);
    msg.textContent = '取り込んでいます…';

    const url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat + '&longitude=' + lon +
      '&hourly=temperature_2m,relative_humidity_2m,surface_pressure,' +
      'wind_speed_10m,wind_direction_10m,weather_code' +
      '&start_date=' + date + '&end_date=' + date +
      '&timezone=Asia%2FTokyo&wind_speed_unit=ms';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const times = j.hourly && j.hourly.time;
      if (!times || !times.length) throw new Error('データがありません');
      let i = times.indexOf(date + 'T' + hour + ':00');
      if (i < 0) i = 0;

      setIf('tempC',       j.hourly.temperature_2m[i], 1);
      setIf('humidity',    j.hourly.relative_humidity_2m[i], 0);
      setIf('pressureHpa', j.hourly.surface_pressure[i], 1);
      setIf('wind10',      j.hourly.wind_speed_10m[i], 1);
      setIf('windDirDeg',  j.hourly.wind_direction_10m[i], 0);
      const code = j.hourly.weather_code[i];
      $('weather').value = WEATHER[code] !== undefined ? WEATHER[code] : ('コード ' + code);

      msg.textContent = date + ' ' + times[i].slice(11) + ' の予報を入れました。手で直せます。';
      render();
    } catch (e) {
      msg.innerHTML = '<span class="err">取り込めませんでした（' + e.message +
        '）。取得できるのは過去 3 か月〜16 日先までです。手で入力してください。</span>';
    }
  }

  function setIf(id, value, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    $(id).value = value.toFixed(digits);
  }

  /* ---------------- 配線 ---------------- */

  PAIRS.forEach(([numId, rangeId]) => {
    const n = $(numId), s = $(rangeId);
    n.addEventListener('input', () => { s.value = n.value; render(); });
    s.addEventListener('input', () => { n.value = s.value; render(); });
  });

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  $('fetchBtn').addEventListener('click', fetchWeather);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    render();
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultDiv.classList.add('highlight');
    setTimeout(() => resultDiv.classList.remove('highlight'), 1500);
  });

  $('resetBtn').addEventListener('click', () => {
    form.reset();
    PAIRS.forEach(([numId, rangeId]) => { $(rangeId).value = $(numId).value; });
    $('weather').value = '—';
    $('fetchMsg').textContent = 'Open-Meteo から取り込みます。取り込んだあと手で直せます。';
    render();
  });

  initMap();
  render();
})();
