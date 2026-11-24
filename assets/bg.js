// Decorative network in the left pane: drifting nodes linked to near neighbors and to the cursor.
(function () {
  var canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LINK = 120, GRAB = 160;
  var nodes = [], w = 0, h = 0, dpr = 1, mouse = null, raf = null;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // The network is carried from page to page (as fractions of the pane size), so
  // switching tabs continues the same picture instead of starting a new one.
  var KEY = 'bgnet:v1';
  function save() {
    if (!w || !h || !nodes.length) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(nodes.map(function (n) {
        return [+(n.x / w).toFixed(4), +(n.y / h).toFixed(4), +n.vx.toFixed(4), +n.vy.toFixed(4), +n.r.toFixed(2)];
      })));
    } catch (e) { /* storage unavailable: start fresh each page */ }
  }
  function load() {
    try {
      var s = JSON.parse(sessionStorage.getItem(KEY));
      if (!Array.isArray(s) || s.length < 5 || s.length > 80) return null;
      for (var i = 0; i < s.length; i++) {
        if (!Array.isArray(s[i]) || s[i].length !== 5 || s[i].some(function (v) { return typeof v !== 'number' || !isFinite(v); })) return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function build() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh) return;
    // keep the current nodes on resize, or restore the ones the last page saved
    var keep = nodes.length && w && h
      ? nodes.map(function (n) { return [n.x / w, n.y / h, n.vx, n.vy, n.r]; })
      : load();
    w = nw; h = nh;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes = [];
    if (keep) {
      keep.forEach(function (k) { nodes.push({ x: k[0] * w, y: k[1] * h, vx: k[2], vy: k[3], r: k[4] }); });
    } else {
      var n = Math.max(12, Math.min(48, Math.round(w * h / 9000)));
      for (var i = 0; i < n; i++) {
        nodes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-.18, .18), vy: rand(-.18, .18), r: rand(1.4, 3) });
      }
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var i, j, a, b, dx, dy, d;
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j]; dx = a.x - b.x; dy = a.y - b.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          ctx.strokeStyle = 'rgba(110,122,138,' + (0.34 * (1 - d / LINK)).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse) {
        dx = a.x - mouse.x; dy = a.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < GRAB) {
          ctx.strokeStyle = 'rgba(27,95,196,' + (0.5 * (1 - d / GRAB)).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }
    ctx.fillStyle = 'rgba(110,122,138,.55)';
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i]; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
    }
  }

  function step() {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx = -n.vx;
      if (n.y < 0 || n.y > h) n.vy = -n.vy;
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  window.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    mouse = (x >= 0 && x <= r.width && y >= 0 && y <= r.height) ? { x: x, y: y } : null;
    if (reduce) draw();
  }, { passive: true });
  document.addEventListener('mouseleave', function () { mouse = null; });
  window.addEventListener('resize', build);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { save(); cancelAnimationFrame(raf); raf = null; } else if (!reduce && !raf) raf = requestAnimationFrame(step);
  });
  window.addEventListener('pagehide', save);

  build();
  if (!reduce) raf = requestAnimationFrame(step);
})();
