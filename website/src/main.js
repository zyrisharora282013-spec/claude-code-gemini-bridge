import './style.css';

// Mobile nav toggle
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('nav-menu');
if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', String(!open));
  });
}

// Highlight current page in nav
const here = location.pathname.replace(/\/$/, '').split('/').pop() || 'index.html';
document.querySelectorAll('[data-nav]').forEach((a) => {
  const target = a.getAttribute('href').split('/').pop() || 'index.html';
  if (target === here || (here === '' && target === 'index.html')) {
    a.classList.add('text-white');
    a.setAttribute('aria-current', 'page');
  }
});

// Hero: slowly drifting network of nodes (linked accounts). Decorative only.
const canvas = document.getElementById('hero-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#8b5cf6', '#22d3ee', '#a78bfa', '#67e8f9'];
  let w = 0, h = 0, nodes = [], raf = 0, last = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(18, Math.min(48, Math.round((w * h) / 14000)));
    nodes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 2 + Math.random() * 2.5,
      c: COLORS[i % COLORS.length],
      p: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    const link = 130;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) {
          ctx.strokeStyle = `rgba(139,92,246,${0.35 * (1 - d / link)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      const pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(t / 900 + n.p);
      ctx.fillStyle = n.c;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const step = (t) => {
    const dt = Math.min(t - last, 50);
    last = t;
    for (const n of nodes) {
      n.x += n.vx * dt * 0.06 * 16;
      n.y += n.vy * dt * 0.06 * 16;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    draw(t);
    raf = requestAnimationFrame(step);
  };

  resize();
  window.addEventListener('resize', resize);
  if (reduce) {
    draw(0);
  } else {
    raf = requestAnimationFrame(step);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(step); }
    });
  }
}
