import './style.css';
import './effects.css';
import { signUp, logEvent, getDownloadCount } from './supabase.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mobile nav toggle
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('nav-menu');
if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const hidden = menu.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', String(!hidden));
  });
}

// Highlight current page in nav
const here = location.pathname.replace(/\/$/, '').split('/').pop() || 'index.html';
document.querySelectorAll('[data-nav]').forEach((a) => {
  const target = a.getAttribute('href').split('/').pop() || 'index.html';
  if (target === here) {
    a.classList.add('text-white');
    a.setAttribute('aria-current', 'page');
  }
});

// 3D hero (lazy-loaded so inner pages stay light)
const hero = document.getElementById('hero-3d');
if (hero) import('./hero3d.js').then((m) => m.initHero(hero));

// Scroll reveal: elements slide/scale in as they enter, like reels cards
const revealEls = document.querySelectorAll('[data-reveal]');
if (reduce || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
}

// 3D tilt on cards (pointer devices only)
if (!reduce && window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateZ(8px)`;
      card.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
      card.style.setProperty('--my', `${(y + 0.5) * 100}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

// Supabase: email signup, download counter, download click tracking
const form = document.getElementById('signup-form');
if (form) {
  const status = document.getElementById('signup-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    const r = await signUp(new FormData(form).get('email') || '');
    status.textContent = r.message;
    status.className = 'mt-2 text-sm ' + (r.ok ? 'text-cyan-300' : 'text-red-400');
    if (r.ok) form.reset();
    btn.disabled = false;
  });
}
document.querySelectorAll('[data-track]').forEach((a) =>
  a.addEventListener('click', () => logEvent(a.dataset.track))
);
const counter = document.getElementById('download-count');
if (counter) {
  getDownloadCount().then((n) => {
    if (n !== null) counter.textContent = Number(n).toLocaleString() + ' downloads so far';
  });
}
if (hero) logEvent('page_view');
