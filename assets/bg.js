// Decorative network in the left pane: drifting nodes linked to near neighbors and to the cursor.
(function () {
  var canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LINK = 120, GRAB = 160;
  var nodes = [], w = 0, h = 0, dpr = 1, mouse = null, raf = null;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function build() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(r.width); h = Math.round(r.height);
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.max(12, Math.min(48, Math.round(w * h / 9000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-.18, .18), vy: rand(-.18, .18), r: rand(1.4, 3) });
    }
    if (reduce) draw();
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
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; } else if (!reduce && !raf) raf = requestAnimationFrame(step);
  });

  build();
  if (!reduce) raf = requestAnimationFrame(step);
})();
