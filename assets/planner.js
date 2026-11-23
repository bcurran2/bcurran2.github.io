// Cluster calculator. Same constants and formulas as dc_scaling_planner.ipynb
// (github.com/bcurran2/data-center-scaling-planner), applied to one cluster.
(function () {
  'use strict';

  var HARDWARE = {
    'GB200 NVL72': { gpusPerSystem: 72, peakPerGpu: 180e15 / 72, systemKw: 120.0, systemPrice: 3.0e6 },
    'H100 (DGX H100)': { gpusPerSystem: 8, peakPerGpu: 989e12, systemKw: 10.2, systemPrice: null }
  };
  var CLUSTER_OVERHEAD = 6912 / 6240;           // Vertiv reference design for GB200 NVL72
  var FAC_CAPEX_LOW = 8.9e6, FAC_CAPEX_HIGH = 23.3e6;   // $ per MW of IT load, Cushman & Wakefield 2026
  var FAC_CAPEX_MID = (FAC_CAPEX_LOW + FAC_CAPEX_HIGH) / 2;
  var CHINCHILLA_TOKENS_PER_PARAM = 20;
  var LLAMA3_405B_FLOP = 3.8e25;
  var DEFAULTS = { hw: 'GB200 NVL72', gpus: 10000, state: 'Texas', avail: '', days: 90, mfu: 0.40, goodput: 0.90, pue: 1.54 };

  // EIA Electric Power Monthly, Table 5.6.A, average industrial price, November 2025 (cents per kWh)
  var STATES = [
    ['Alabama', 7.66], ['Alaska', 21.08], ['Arizona', 7.52], ['Arkansas', 6.53], ['California', 19.32],
    ['Colorado', 9.12], ['Connecticut', 17.70], ['Delaware', 9.48], ['District of Columbia', 18.77],
    ['Florida', 9.05], ['Georgia', 6.83], ['Hawaii', 31.84], ['Idaho', 7.61], ['Illinois', 9.96],
    ['Indiana', 8.95], ['Iowa', 6.36], ['Kansas', 8.26], ['Kentucky', 6.86], ['Louisiana', 5.88],
    ['Maine', 15.89], ['Maryland', 12.47], ['Massachusetts', 19.03], ['Michigan', 8.46], ['Minnesota', 9.30],
    ['Mississippi', 7.42], ['Missouri', 7.84], ['Montana', 6.88], ['Nebraska', 7.50], ['Nevada', 7.59],
    ['New Hampshire', 16.86], ['New Jersey', 13.64], ['New Mexico', 5.37], ['New York', 8.95],
    ['North Carolina', 7.69], ['North Dakota', 7.55], ['Ohio', 9.33], ['Oklahoma', 6.13], ['Oregon', 8.10],
    ['Pennsylvania', 10.20], ['Rhode Island', 22.24], ['South Carolina', 6.71], ['South Dakota', 8.67],
    ['Tennessee', 6.43], ['Texas', 6.63], ['Utah', 7.76], ['Vermont', 12.60], ['Virginia', 9.92],
    ['Washington', 6.84], ['West Virginia', 8.27], ['Wisconsin', 8.64], ['Wyoming', 8.79], ['U.S. average', 8.44]
  ];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : NaN; }

  // ---- formatting ----
  function money(x) {
    if (x === null || !isFinite(x)) return 'n/a';
    var u = [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]];
    for (var i = 0; i < u.length; i++) if (Math.abs(x) >= u[i][1]) return '$' + (x / u[i][1]).toFixed(2) + u[i][0];
    return '$' + Math.round(x);
  }
  function mw(x) { return x >= 1000 ? (x / 1000).toFixed(2) + ' GW' : x.toFixed(1) + ' MW'; }
  function count(x) {
    var u = [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]];
    for (var i = 0; i < u.length; i++) if (Math.abs(x) >= u[i][1]) return (x / u[i][1]).toFixed(1) + u[i][0];
    return Math.round(x).toString();
  }
  function sci(x) {
    var e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
    return m.toFixed(1) + '×10' + sup(e);
  }
  function sup(n) {
    var map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
    return String(n).split('').map(function (c) { return map[c]; }).join('');
  }
  function gwh(x) { return x >= 1000 ? (x / 1000).toFixed(2) + ' TWh' : x.toFixed(1) + ' GWh'; }
  function int(x) { return Math.round(x).toLocaleString('en-US'); }

  // ---- the model ----
  function compute(i) {
    var h = HARDWARE[i.hw];
    var systems = i.gpus / h.gpusPerSystem;
    var itMw = systems * h.systemKw / 1000 * CLUSTER_OVERHEAD;
    var facMw = itMw * i.pue;
    var energyMwh = facMw * 8760;
    var peak = i.gpus * h.peakPerGpu;
    var flop = peak * i.mfu * i.goodput * i.days * 86400;
    var n = Math.sqrt(flop / (6 * CHINCHILLA_TOKENS_PER_PARAM));
    var hw = h.systemPrice === null ? null : systems * h.systemPrice;
    return {
      systems: systems, itMw: itMw, facMw: facMw,
      energyGwh: energyMwh / 1000,
      elec: energyMwh * 1000 * i.rate,
      hwCost: hw,
      facCost: itMw * FAC_CAPEX_MID, facLow: itMw * FAC_CAPEX_LOW, facHigh: itMw * FAC_CAPEX_HIGH,
      peak: peak, flop: flop, params: n, tokens: CHINCHILLA_TOKENS_PER_PARAM * n,
      mwPerGpu: facMw / i.gpus
    };
  }

  // ---- inputs ----
  var syncing = false;
  function read() {
    return {
      hw: $('hw').value, gpus: num('gpus'), rate: num('rate'), avail: num('avail'),
      days: num('days'), mfu: num('mfu'), goodput: num('goodput'), pue: num('pue')
    };
  }
  function valid(i) {
    return i.gpus > 0 && i.rate >= 0 && i.days > 0 && i.mfu > 0 && i.mfu <= 1 &&
           i.goodput > 0 && i.goodput <= 1 && i.pue >= 1;
  }

  function render() {
    var i = read(), box = $('results');
    if (!valid(i)) { box.classList.add('stale'); $('summary').textContent = 'Enter a GPU count and check the assumptions to see results.'; return; }
    box.classList.remove('stale');
    var r = compute(i), h = HARDWARE[i.hw];

    $('summary').textContent =
      int(i.gpus) + ' ' + i.hw.split(' (')[0] + ' GPUs (about ' + Math.ceil(r.systems) + (i.hw.indexOf('GB200') === 0 ? ' racks' : ' systems') + ') need roughly ' +
      mw(r.facMw) + ' at the utility meter. In ' + i.days + ' days they could train a ' + sci(r.flop) +
      ' FLOP model, about ' + count(r.params) + ' parameters on ' + count(r.tokens) + ' tokens.';

    $('o-power').textContent = mw(r.facMw);
    $('o-power-s').textContent = mw(r.itMw) + ' of IT load, PUE ' + i.pue;
    $('o-energy').textContent = gwh(r.energyGwh);
    $('o-elec').textContent = money(r.elec);
    $('o-elec-s').textContent = '$' + i.rate.toFixed(4) + ' per kWh';

    var total = r.hwCost === null ? null : r.hwCost + r.facCost;
    $('o-total').textContent = total === null ? money(r.facCost) : money(total);
    $('o-total-s').textContent = total === null ? 'facility only; no published price for this hardware'
      : 'hardware + facility, excludes network and storage';

    // split bar
    var split = $('split'), legend = $('split-legend');
    split.textContent = ''; legend.textContent = '';
    var parts = [['Hardware', r.hwCost, 'seg-a'], ['Facility build', r.facCost, 'seg-b']].filter(function (p) { return p[1] !== null; });
    var sum = parts.reduce(function (a, p) { return a + p[1]; }, 0);
    parts.forEach(function (p) {
      var seg = el('span', 'seg ' + p[2]); seg.style.width = (100 * p[1] / sum).toFixed(2) + '%'; split.appendChild(seg);
      var li = el('li'); li.appendChild(el('i', 'sw ' + p[2]));
      li.appendChild(document.createTextNode(p[0] + ': ' + money(p[1]) + ' (' + Math.round(100 * p[1] / sum) + '%)'));
      if (p[0] === 'Facility build') li.appendChild(document.createTextNode(', range ' + money(r.facLow) + ' to ' + money(r.facHigh)));
      legend.appendChild(li);
    });
    split.setAttribute('aria-label', parts.map(function (p) { return p[0] + ' ' + Math.round(100 * p[1] / sum) + ' percent'; }).join(', '));

    // power check
    var pc = $('power-check');
    if (i.avail > 0) {
      pc.hidden = false;
      var meter = $('meter'); meter.textContent = '';
      var top = Math.max(i.avail, r.facMw);
      var need = el('span', 'bar need'); need.style.width = (100 * r.facMw / top).toFixed(2) + '%';
      var av = el('span', 'bar have'); av.style.width = (100 * i.avail / top).toFixed(2) + '%';
      var row1 = el('div', 'mrow'); row1.appendChild(el('b', null, 'Needed')); row1.appendChild(need); row1.appendChild(el('em', null, mw(r.facMw)));
      var row2 = el('div', 'mrow'); row2.appendChild(el('b', null, 'Available')); row2.appendChild(av); row2.appendChild(el('em', null, mw(i.avail)));
      meter.appendChild(row1); meter.appendChild(row2);
      meter.setAttribute('aria-label', 'Needed ' + mw(r.facMw) + ' versus available ' + mw(i.avail));
      var maxGpus = i.avail / r.mwPerGpu;
      $('power-msg').textContent = r.facMw <= i.avail
        ? 'Covered, with ' + mw(i.avail - r.facMw) + ' to spare. That power could run up to about ' + int(maxGpus) + ' GPUs.'
        : 'Short by ' + mw(r.facMw - i.avail) + '. That power supports about ' + int(maxGpus) + ' GPUs, ' + Math.round(100 * maxGpus / i.gpus) + '% of this cluster.';
    } else { pc.hidden = true; }

    // training
    $('train-msg').textContent = 'Running at ' + Math.round(i.mfu * 100) + '% of peak speed and training ' + Math.round(i.goodput * 100) +
      '% of the time, the cluster delivers the compute below over a ' + i.days + '-day run.';
    var facts = $('facts'); facts.textContent = '';
    [
      ['Peak speed', sci(r.peak) + ' FLOP/s'],
      ['Compute in one run', sci(r.flop) + ' FLOP'],
      ['Model size (Chinchilla rule)', count(r.params) + ' parameters, ' + count(r.tokens) + ' tokens'],
      ['Compared with Llama 3.1 405B', (r.flop / LLAMA3_405B_FLOP).toFixed(r.flop / LLAMA3_405B_FLOP < 10 ? 2 : 1) + '× its training compute']
    ].forEach(function (f) { facts.appendChild(el('dt', null, f[0])); facts.appendChild(el('dd', null, f[1])); });
  }

  // ---- wiring ----
  function setGpusFromBudget() {
    var h = HARDWARE[$('hw').value], b = num('budget');
    if (h.systemPrice === null || !(b >= 0)) return;
    $('gpus').value = Math.round(b * 1e6 / (h.systemPrice / h.gpusPerSystem));
  }
  function setBudgetFromGpus() {
    var h = HARDWARE[$('hw').value], g = num('gpus'), b = $('budget');
    if (h.systemPrice === null) { b.value = ''; b.disabled = true; $('budget-hint').textContent = 'No published price for this hardware.'; return; }
    b.disabled = false;
    $('budget-hint').textContent = 'GPU systems only, at about $' + Math.round(h.systemPrice / h.gpusPerSystem).toLocaleString('en-US') + ' per GPU (analyst estimate).';
    b.value = g > 0 ? +(g * h.systemPrice / h.gpusPerSystem / 1e6).toFixed(1) : '';
  }
  function setRateFromState() {
    var s = $('state').value;
    for (var k = 0; k < STATES.length; k++) if (STATES[k][0] === s) { $('rate').value = (STATES[k][1] / 100).toFixed(4); return; }
  }
  function defaults() {
    syncing = true;
    $('hw').value = DEFAULTS.hw; $('gpus').value = DEFAULTS.gpus; $('state').value = DEFAULTS.state;
    $('avail').value = DEFAULTS.avail; $('days').value = DEFAULTS.days; $('mfu').value = DEFAULTS.mfu;
    $('goodput').value = DEFAULTS.goodput; $('pue').value = DEFAULTS.pue;
    setRateFromState(); setBudgetFromGpus();
    syncing = false; render();
  }

  // ---- MW <-> GWh converter (1 MW for 8,760 hours = 8.76 GWh) ----
  var lastFacMw = null;
  function convFromMw() {
    var m = num('c-mw'), u = num('c-util');
    $('c-gwh').value = (m >= 0 && u > 0) ? +(m * 8.76 * u / 100).toPrecision(6) : '';
  }
  function convFromGwh() {
    var g = num('c-gwh'), u = num('c-util');
    $('c-mw').value = (g >= 0 && u > 0) ? +(g / (8.76 * u / 100)).toPrecision(6) : '';
  }

  function init() {
    if (!$('calc')) return;
    Object.keys(HARDWARE).forEach(function (n) { var o = el('option', null, n); o.value = n; $('hw').appendChild(o); });
    STATES.forEach(function (s) { var o = el('option', null, s[0]); o.value = s[0]; $('state').appendChild(o); });
    var custom = el('option', null, 'Custom rate'); custom.value = 'Custom'; $('state').appendChild(custom);

    $('calc').addEventListener('submit', function (e) { e.preventDefault(); });
    $('hw').addEventListener('change', function () { setBudgetFromGpus(); render(); });
    $('gpus').addEventListener('input', function () { if (!syncing) { setBudgetFromGpus(); render(); } });
    $('budget').addEventListener('input', function () { if (!syncing) { setGpusFromBudget(); render(); } });
    $('state').addEventListener('change', function () { if ($('state').value !== 'Custom') setRateFromState(); render(); });
    $('rate').addEventListener('input', function () { $('state').value = 'Custom'; render(); });
    ['avail', 'days', 'mfu', 'goodput', 'pue'].forEach(function (id) { $(id).addEventListener('input', render); });
    $('reset').addEventListener('click', defaults);
    $('c-mw').addEventListener('input', convFromMw);
    $('c-util').addEventListener('input', convFromMw);
    $('c-gwh').addEventListener('input', convFromGwh);
    $('c-use').addEventListener('click', function () {
      var i = read(); if (!valid(i)) return;
      $('c-mw').value = +compute(i).facMw.toPrecision(6); convFromMw();
    });
    defaults();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
