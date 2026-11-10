/**
 * Account Network Hero
 * A slowly rotating 3D network: one node per enabled account, colored by status.
 * three.js is loaded lazily from /vendor/three (no CDN). Falls back to a static SVG
 * when WebGL is unavailable or three fails to load.
 */
window.Components = window.Components || {};

window.Components.accountHero = () => {
    // WebGL objects stay out of Alpine's reactive state (proxies break them)
    const gl = {
        three: null, renderer: null, scene: null, camera: null, group: null, core: null,
        nodes: [], lines: null, raf: null, running: false, lastTs: 0, io: null, ro: null,
        visible: false, loading: false, onVisibility: null
    };
    const COLORS = { ok: '#22c55e', limited: '#eab308', invalid: '#ef4444' };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const classify = (acc) => {
        if (acc.status !== 'ok') return 'invalid';
        const limits = Object.values(acc.limits || {});
        if (limits.length === 0) return 'limited';
        const limited = limits.some(l => !l || l.remainingFraction === null ||
            l.remainingFraction === undefined || l.remainingFraction <= 0.05);
        return limited ? 'limited' : 'ok';
    };

    const fibonacciSphere = (i, n, radius) => {
        const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = i * 2.399963;
        return [Math.cos(theta) * r * radius, y * radius * 0.7, Math.sin(theta) * r * radius];
    };

    const webglAvailable = () => {
        try {
            const c = document.createElement('canvas');
            return !!(c.getContext('webgl2') || c.getContext('webgl'));
        } catch {
            return false;
        }
    };

    return {
        ready: false,
        failed: false,
        counts: { ok: 0, limited: 0, invalid: 0 },

        get total() {
            return this.counts.ok + this.counts.limited + this.counts.invalid;
        },

        get label() {
            return `Account network: ${this.total} linked accounts, ${this.counts.ok} healthy, ` +
                `${this.counts.limited} rate-limited, ${this.counts.invalid} invalid`;
        },

        get signature() {
            return Alpine.store('data').accounts
                .filter(a => a.enabled !== false)
                .map(a => classify(a))
                .join(',');
        },

        get totalRequests() {
            const history = Alpine.store('data').usageHistory || {};
            return Object.values(history).reduce((sum, h) => sum + ((h && h._total) || 0), 0);
        },

        enabledAccounts() {
            return Alpine.store('data').accounts.filter(a => a.enabled !== false);
        },

        init() {
            this.$nextTick(() => this.refresh());
            this.$watch('signature', () => this.refresh());
            this.$watch('totalRequests', (now, before) => {
                if (before !== undefined && now > before) this.pulse();
            });

            gl.onVisibility = () => this.updateRunning();
            document.addEventListener('visibilitychange', gl.onVisibility);

            gl.io = new IntersectionObserver((entries) => {
                gl.visible = entries[0].isIntersecting;
                if (gl.visible) this.ensureThree();
                this.updateRunning();
            }, { threshold: 0.1 });
            gl.io.observe(this.$el);
        },

        destroy() {
            this.stop();
            if (gl.io) gl.io.disconnect();
            if (gl.ro) gl.ro.disconnect();
            if (gl.onVisibility) document.removeEventListener('visibilitychange', gl.onVisibility);
            this.clearNodes();
            if (gl.renderer) gl.renderer.dispose();
        },

        refresh() {
            const counts = { ok: 0, limited: 0, invalid: 0 };
            this.enabledAccounts().forEach(a => { counts[classify(a)]++; });
            this.counts = counts;
            this.drawFallback();
            if (this.ready) {
                this.rebuild();
                this.renderOnce();
            }
        },

        // ---- static SVG (always drawn; hidden once WebGL is ready) ----
        drawFallback() {
            const svg = this.$refs.fallback;
            if (!svg) return;
            svg.replaceChildren();
            const accounts = this.enabledAccounts();
            const cx = 200, cy = 100, radius = 68;
            const make = (tag, attrs) => {
                const el = document.createElementNS(SVG_NS, tag);
                Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
                return el;
            };
            accounts.forEach((acc, i) => {
                const angle = (i / accounts.length) * Math.PI * 2 - Math.PI / 2;
                const x = cx + Math.cos(angle) * radius * 1.5;
                const y = cy + Math.sin(angle) * radius * 0.75;
                svg.appendChild(make('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: '#22d3ee', 'stroke-opacity': '0.3' }));
                svg.appendChild(make('circle', { cx: x, cy: y, r: 7, fill: COLORS[classify(acc)] }));
            });
            svg.appendChild(make('circle', { cx, cy, r: 14, fill: 'none', stroke: '#a855f7', 'stroke-width': '2' }));
            svg.appendChild(make('circle', { cx, cy, r: 5, fill: '#a855f7' }));
        },

        // ---- three.js ----
        async ensureThree() {
            if (gl.three || this.failed || gl.loading) return;
            if (!webglAvailable()) {
                this.failed = true;
                return;
            }
            gl.loading = true;
            try {
                gl.three = await import('/vendor/three/three.module.min.js');
                this.setup();
                this.ready = true;
                this.renderOnce();
            } catch (e) {
                this.failed = true;
                gl.three = null;
                if (window.UILogger) window.UILogger.debug('3D hero unavailable:', e.message);
            } finally {
                gl.loading = false;
            }
            this.updateRunning();
        },

        setup() {
            const THREE = gl.three;
            gl.renderer = new THREE.WebGLRenderer({ canvas: this.$refs.canvas, antialias: true, alpha: true });
            gl.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            gl.scene = new THREE.Scene();
            gl.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
            gl.camera.position.set(0, 0.8, 6.2);
            gl.camera.lookAt(0, 0, 0);
            gl.group = new THREE.Group();
            gl.scene.add(gl.group);
            gl.core = new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.45, 1),
                new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true })
            );
            gl.group.add(gl.core);
            this.rebuild();
            this.resize();
            gl.ro = new ResizeObserver(() => { this.resize(); this.renderOnce(); });
            gl.ro.observe(this.$refs.stage);
        },

        resize() {
            if (!gl.renderer) return;
            const { clientWidth: w, clientHeight: h } = this.$refs.stage;
            if (!w || !h) return;
            gl.renderer.setSize(w, h, false);
            gl.camera.aspect = w / h;
            gl.camera.updateProjectionMatrix();
        },

        clearNodes() {
            gl.nodes.forEach(n => {
                gl.group.remove(n.mesh, n.halo);
                n.mesh.geometry.dispose();
                n.mesh.material.dispose();
                n.halo.geometry.dispose();
                n.halo.material.dispose();
            });
            gl.nodes = [];
            if (gl.lines) {
                gl.group.remove(gl.lines);
                gl.lines.geometry.dispose();
                gl.lines.material.dispose();
                gl.lines = null;
            }
        },

        rebuild() {
            if (!gl.three || !gl.group) return;
            const THREE = gl.three;
            this.clearNodes();
            const accounts = this.enabledAccounts();
            const points = [];
            accounts.forEach((acc, i) => {
                const [x, y, z] = fibonacciSphere(i, accounts.length, 2.1);
                const color = new THREE.Color(COLORS[classify(acc)]);
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshBasicMaterial({ color }));
                const halo = new THREE.Mesh(
                    new THREE.SphereGeometry(0.15, 12, 12),
                    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 })
                );
                mesh.position.set(x, y, z);
                halo.position.set(x, y, z);
                gl.group.add(mesh, halo);
                gl.nodes.push({ mesh, halo, pulseT: 1, lastUsed: Date.parse(acc.lastUsed) || 0 });
                points.push(0, 0, 0, x, y, z);
            });
            if (points.length) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
                gl.lines = new THREE.LineSegments(
                    geometry,
                    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25 })
                );
                gl.group.add(gl.lines);
            }
        },

        pulse() {
            if (!gl.nodes.length || reduced.matches) return;
            const recent = gl.nodes.reduce((best, n) => (n.lastUsed > best.lastUsed ? n : best), gl.nodes[0]);
            const node = recent.lastUsed ? recent : gl.nodes[Math.floor(Math.random() * gl.nodes.length)];
            node.pulseT = 0;
        },

        renderOnce() {
            if (gl.renderer && gl.scene) gl.renderer.render(gl.scene, gl.camera);
        },

        updateRunning() {
            const shouldRun = this.ready && gl.visible && !document.hidden && !reduced.matches;
            if (shouldRun && !gl.running) {
                gl.running = true;
                gl.lastTs = 0;
                gl.raf = requestAnimationFrame((t) => this.tick(t));
            } else if (!shouldRun) {
                this.stop();
                if (this.ready) this.renderOnce();
            }
        },

        stop() {
            gl.running = false;
            if (gl.raf) cancelAnimationFrame(gl.raf);
            gl.raf = null;
        },

        tick(ts) {
            if (!gl.running) return;
            const dt = Math.min(0.05, (ts - (gl.lastTs || ts)) / 1000);
            gl.lastTs = ts;
            gl.group.rotation.y += dt * 0.22;
            gl.core.rotation.x += dt * 0.3;
            gl.nodes.forEach(n => {
                if (n.pulseT < 1) {
                    n.pulseT = Math.min(1, n.pulseT + dt / 1.2);
                    n.halo.scale.setScalar(1 + n.pulseT * 3);
                    n.halo.material.opacity = 0.18 + 0.5 * (1 - n.pulseT);
                } else {
                    n.halo.scale.setScalar(1);
                    n.halo.material.opacity = 0.18;
                }
            });
            gl.renderer.render(gl.scene, gl.camera);
            gl.raf = requestAnimationFrame((t) => this.tick(t));
        }
    };
};
