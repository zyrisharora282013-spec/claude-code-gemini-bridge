import * as THREE from 'three';

// Decorative 3D hero: glowing core, orbiting rings with "account" nodes, drifting particles.
export function initHero(canvas) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // no WebGL: the CSS aurora background still shows
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const l1 = new THREE.PointLight(0x8b5cf6, 90, 30);
  l1.position.set(4, 3, 4);
  scene.add(l1);
  const l2 = new THREE.PointLight(0x22d3ee, 80, 30);
  l2.position.set(-4, -2, 3);
  scene.add(l2);

  const root = new THREE.Group();
  scene.add(root);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.25, 1),
    new THREE.MeshPhysicalMaterial({ color: 0x6d4aff, metalness: 0.55, roughness: 0.18, clearcoat: 1, flatShading: true, emissive: 0x2a1a8a, emissiveIntensity: 0.6 })
  );
  root.add(core);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 2),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.18 })
  );
  root.add(shell);

  const rings = [];
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.4 });
  [[2.3, 0.3, 0.2], [3.0, 1.1, -0.5], [3.7, -0.7, 0.9]].forEach(([r, tx, tz], i) => {
    const g = new THREE.Group();
    g.rotation.set(tx, 0, tz);
    g.add(new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.012, 8, 160),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x22d3ee : 0xa78bfa, transparent: true, opacity: 0.55 })
    ));
    const nodes = new THREE.Group();
    const count = 3 + i;
    for (let k = 0; k < count; k++) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.09 + 0.03 * (k % 2), 16, 16), nodeMat);
      const a = (k / count) * Math.PI * 2;
      n.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      nodes.add(n);
    }
    g.add(nodes);
    root.add(g);
    rings.push({ nodes, speed: (0.25 + i * 0.12) * (i % 2 ? -1 : 1) });
  });

  const N = 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 4 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xc4b5fd, size: 0.035, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(stars);

  let w = 0;
  let h = 0;
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w < 640 ? 9.5 : 7; // keep the model uncropped on phones
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let visible = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const frame = () => {
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const sc = Math.min(window.scrollY / Math.max(h, 1), 1.2);
    root.rotation.y = t * 0.18 + mouse.x * 0.6;
    root.rotation.x = mouse.y * 0.4 + sc * 0.8;
    root.position.y = sc * 1.6;
    root.scale.setScalar(1 + Math.sin(t * 1.2) * 0.02 - sc * 0.25);
    core.rotation.y = -t * 0.4;
    shell.rotation.x = t * 0.15;
    rings.forEach((r) => { r.nodes.rotation.z = t * r.speed; });
    stars.rotation.y = t * 0.02 + mouse.x * 0.05;
    renderer.render(scene, camera);
    if (!reduce && visible) raf = requestAnimationFrame(frame);
  };

  if (reduce) { frame(); return; }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { clock.getDelta(); raf = requestAnimationFrame(frame); }
  }).observe(canvas);
  raf = requestAnimationFrame(frame);
}
