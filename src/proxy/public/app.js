/**
 * Antigravity Console - Main Entry
 *
 * This file orchestrates Alpine.js initialization.
 * Components are loaded via separate script files that register themselves
 * to window.Components before this script runs.
 */

document.addEventListener('alpine:init', () => {
    // Register Components (loaded from separate files via window.Components)
    Alpine.data('dashboard', window.Components.dashboard);
    Alpine.data('models', window.Components.models);
    Alpine.data('accountManager', window.Components.accountManager);
    Alpine.data('claudeConfig', window.Components.claudeConfig);
    Alpine.data('logsViewer', window.Components.logsViewer);
    Alpine.data('addAccountModal', window.Components.addAccountModal);
    Alpine.data('commandPalette', window.Components.commandPalette);
    Alpine.data('accountHero', window.Components.accountHero);

    // x-count-up="expr": animates a numeric text value toward expr (skips animation under reduced motion)
    Alpine.directive('count-up', (el, { expression }, { evaluateLater, effect, cleanup }) => {
        const getValue = evaluateLater(expression);
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let shown = 0;
        let raf = null;

        effect(() => getValue((value) => {
            if (raf) cancelAnimationFrame(raf);
            const target = Number(value);
            if (value === null || value === undefined || value === '' || !Number.isFinite(target)) {
                el.textContent = value ?? '';
                shown = 0;
                return;
            }
            if (!Number.isInteger(target) || reduced.matches || target === shown) {
                el.textContent = target;
                shown = target;
                return;
            }
            const from = shown;
            const start = performance.now();
            const duration = 600;
            const step = (now) => {
                const p = Math.min(1, (now - start) / duration);
                shown = from + (target - from) * (1 - Math.pow(1 - p, 3));
                el.textContent = Math.round(shown);
                if (p < 1) {
                    raf = requestAnimationFrame(step);
                } else {
                    shown = target;
                    el.textContent = target;
                }
            };
            raf = requestAnimationFrame(step);
        }));

        cleanup(() => { if (raf) cancelAnimationFrame(raf); });
    });

    // Skeleton placeholder shown while a view's HTML is loading
    const buildSkeleton = () => {
        const wrap = document.createElement('div');
        wrap.className = 'view-container';
        wrap.setAttribute('aria-busy', 'true');
        wrap.setAttribute('aria-label', 'Loading');
        const title = document.createElement('div');
        title.className = 'skeleton-title';
        const grid = document.createElement('div');
        grid.className = 'stats-grid';
        for (let i = 0; i < 4; i++) {
            const card = document.createElement('div');
            card.className = 'skeleton-stat-card';
            grid.appendChild(card);
        }
        const chart = document.createElement('div');
        chart.className = 'skeleton-chart';
        wrap.append(title, grid, chart);
        return wrap;
    };

    // View Loader Directive
    Alpine.directive('load-view', (el, { expression }, { evaluate }) => {
        if (!window.viewCache) window.viewCache = new Map();

        // Evaluate the expression to get the actual view name (removes quotes)
        const viewName = evaluate(expression);

        if (window.viewCache.has(viewName)) {
            el.innerHTML = window.viewCache.get(viewName);
            Alpine.initTree(el);
            return;
        }

        el.replaceChildren(buildSkeleton());

        fetch(`views/${viewName}.html?t=${Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(html => {
                // Update cache (optional, or remove if we want always-fresh)
                // keeping cache for session performance, but initial load will now bypass browser cache
                window.viewCache.set(viewName, html);
                el.innerHTML = html;
                Alpine.initTree(el);
            })
            .catch(err => {
                console.error('Failed to load view:', viewName, err);
                const wrapper = document.createElement('div');
                wrapper.className = 'p-4 border border-red-500/50 bg-red-500/10 rounded-lg text-red-400 font-mono text-sm';
                const title = document.createElement('span');
                title.textContent = `Error loading view: ${viewName}`;
                const br = document.createElement('br');
                const detail = document.createElement('span');
                detail.className = 'text-xs opacity-75';
                detail.textContent = err.message;
                wrapper.append(title, br, detail);
                el.replaceChildren(wrapper);
            });
    });

    // Main App Controller
    Alpine.data('app', () => ({
        get connectionStatus() {
            return Alpine.store('data')?.connectionStatus || 'connecting';
        },
        get loading() {
            return Alpine.store('data')?.loading || false;
        },

        sidebarOpen: window.innerWidth >= 1024,
        toggleSidebar() {
            this.sidebarOpen = !this.sidebarOpen;
        },

        init() {
            // Handle responsive sidebar transitions
            let lastWidth = window.innerWidth;
            let resizeTimeout = null;
            
            window.addEventListener('resize', () => {
                if (resizeTimeout) clearTimeout(resizeTimeout);
                
                resizeTimeout = setTimeout(() => {
                    const currentWidth = window.innerWidth;
                    const lgBreakpoint = 1024;
                    
                    // Desktop -> Mobile: Auto-close sidebar to prevent overlay blocking screen
                    if (lastWidth >= lgBreakpoint && currentWidth < lgBreakpoint) {
                        this.sidebarOpen = false;
                    }
                    
                    // Mobile -> Desktop: Auto-open sidebar (restore standard desktop layout)
                    if (lastWidth < lgBreakpoint && currentWidth >= lgBreakpoint) {
                        this.sidebarOpen = true;
                    }
                    
                    lastWidth = currentWidth;
                }, 150);
            });

            // Theme setup
            document.documentElement.setAttribute('data-theme', 'black');
            document.documentElement.classList.add('dark');

            // Chart Defaults
            if (typeof Chart !== 'undefined') {
                Chart.defaults.color = window.utils.getThemeColor('--color-text-dim');
                Chart.defaults.borderColor = window.utils.getThemeColor('--color-space-border');
                Chart.defaults.font.family = '"JetBrains Mono", monospace';
            }

            // Start Data Polling
            this.startAutoRefresh();
            document.addEventListener('refresh-interval-changed', () => this.startAutoRefresh());

            // Initial Fetch
            Alpine.store('data').fetchData();
        },

        refreshTimer: null,

        fetchData() {
            Alpine.store('data').fetchData();
        },

        startAutoRefresh() {
            if (this.refreshTimer) clearInterval(this.refreshTimer);
            const interval = parseInt(Alpine.store('settings')?.refreshInterval || 60);
            if (interval > 0) {
                this.refreshTimer = setInterval(() => Alpine.store('data').fetchData(), interval * 1000);
            }
        },

        t(key) {
            return Alpine.store('global')?.t(key) || key;
        },

        async addAccountWeb(reAuthEmail = null) {
            const password = Alpine.store('global').webuiPassword;
            try {
                const urlPath = reAuthEmail
                    ? `/api/auth/url?email=${encodeURIComponent(reAuthEmail)}`
                    : '/api/auth/url';

                const { response, newPassword } = await window.utils.request(urlPath, {}, password);
                if (newPassword) Alpine.store('global').webuiPassword = newPassword;

                const data = await response.json();

                if (data.status === 'ok') {
                    // Show info toast that OAuth is in progress
                    Alpine.store('global').showToast(Alpine.store('global').t('oauthInProgress'), 'info');

                    // Open OAuth window
                    const oauthWindow = window.open(data.url, 'google_oauth', 'width=600,height=700,scrollbars=yes');

                    const initialAccounts = Alpine.store('data').accounts.map(a => `${a.email}:${a.status}`).sort().join(',');
                    let pollCount = 0;
                    const maxPolls = 60; // 2 minutes (2 second intervals)
                    let cancelled = false;

                    // Show progress modal
                    Alpine.store('global').oauthProgress = {
                        active: true,
                        current: 0,
                        max: maxPolls,
                        cancel: () => {
                            cancelled = true;
                            clearInterval(pollInterval);
                            Alpine.store('global').oauthProgress.active = false;
                            Alpine.store('global').showToast(Alpine.store('global').t('oauthCancelled'), 'info');
                            if (oauthWindow && !oauthWindow.closed) {
                                oauthWindow.close();
                            }
                        }
                    };

                    const pollInterval = setInterval(async () => {
                        if (cancelled) {
                            clearInterval(pollInterval);
                            return;
                        }

                        pollCount++;
                        Alpine.store('global').oauthProgress.current = pollCount;

                        // Check if OAuth window was closed manually
                        if (oauthWindow && oauthWindow.closed && !cancelled) {
                            clearInterval(pollInterval);
                            Alpine.store('global').oauthProgress.active = false;
                            Alpine.store('global').showToast(Alpine.store('global').t('oauthWindowClosed'), 'warning');
                            return;
                        }

                        // Refresh account list
                        await Alpine.store('data').fetchData();

                        // Check if accounts changed (new account added or existing re-authed)
                        const currentAccounts = Alpine.store('data').accounts.map(a => `${a.email}:${a.status}`).sort().join(',');
                        if (currentAccounts !== initialAccounts) {
                            clearInterval(pollInterval);
                            Alpine.store('global').oauthProgress.active = false;

                            const actionKey = reAuthEmail ? 'accountReauthSuccess' : 'accountAddedSuccess';
                            Alpine.store('global').showToast(
                                Alpine.store('global').t(actionKey),
                                'success'
                            );
                            document.getElementById('add_account_modal')?.close();

                            if (oauthWindow && !oauthWindow.closed) {
                                oauthWindow.close();
                            }
                        }

                        // Stop polling after max attempts
                        if (pollCount >= maxPolls) {
                            clearInterval(pollInterval);
                            Alpine.store('global').oauthProgress.active = false;
                            Alpine.store('global').showToast(
                                Alpine.store('global').t('oauthTimeout'),
                                'warning'
                            );
                        }
                    }, 2000); // Poll every 2 seconds
                } else {
                    Alpine.store('global').showToast(data.error || Alpine.store('global').t('failedToGetAuthUrl'), 'error');
                }
            } catch (e) {
                Alpine.store('global').showToast(Alpine.store('global').t('failedToStartOAuth') + ': ' + e.message, 'error');
            }
        }
    }));
});