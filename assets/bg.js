// Decorative background: slow-drifting geometric shapes that gently move away from the cursor.
(function () {
  var canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = ['27,95,196', '229,154,15', '85,101,122'];
  var shapes = [], w = 0, h = 0, dpr = 1, mouse = { x: -9999, y: -9999 }, raf = null;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.max(14, Math.min(46, Math.round(w * h / 30000)));
    shapes = [];
    for (var i = 0; i < n; i++) {
      var sides = [0, 3, 4, 6][Math.floor(Math.random() * 4)]; // 0 = circle
      shapes.push({
        x: rand(0, w), y: rand(0, h), vx: rand(-.12, .12), vy: rand(-.12, .12),
        ox: 0, oy: 0, r: rand(12, 40), sides: sides, rot: rand(0, 6.28), vr: rand(-.003, .003),
        c: COLORS[Math.floor(Math.random() * COLORS.length)], filled: Math.random() < .35
      });
    }
  }

  function path(s) {
    ctx.beginPath();
    if (!s.sides) { ctx.arc(s.x + s.ox, s.y + s.oy, s.r, 0, 6.2832); return; }
    for (var i = 0; i < s.sides; i++) {
      var a = s.rot + i * 6.2832 / s.sides;
      var px = s.x + s.ox + Math.cos(a) * s.r, py = s.y + s.oy + Math.sin(a) * s.r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      path(s);
      if (s.filled) { ctx.fillStyle = 'rgba(' + s.c + ',.06)'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(' + s.c + ',.2)'; ctx.lineWidth = 1.4; ctx.stroke();
    }
  }

  function step() {
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      s.x += s.vx; s.y += s.vy; s.rot += s.vr;
      if (s.x < -60) s.x = w + 60; else if (s.x > w + 60) s.x = -60;
      if (s.y < -60) s.y = h + 60; else if (s.y > h + 60) s.y = -60;
      var dx = s.x + s.ox - mouse.x, dy = s.y + s.oy - mouse.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 170 && d > 0.1) {
        var f = (170 - d) / 170;
        s.ox += (dx / d) * f * 3.2; s.oy += (dy / d) * f * 3.2;
      }
      s.ox *= .965; s.oy *= .965; // ease back toward rest position
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  function start() {
    build();
    if (reduce) { draw(); return; }
    if (!raf) raf = requestAnimationFrame(step);
  }

  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('mouseout', function () { mouse.x = mouse.y = -9999; });
  window.addEventListener('resize', function () { build(); if (reduce) draw(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; } else if (!reduce && !raf) raf = requestAnimationFrame(step);
  });
  start();
})();
