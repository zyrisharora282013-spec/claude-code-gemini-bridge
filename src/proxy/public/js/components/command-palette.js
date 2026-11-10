/**
 * Command Palette (Ctrl/Cmd+K)
 * Registers itself to window.Components for Alpine.js to consume
 */
window.Components = window.Components || {};

window.Components.commandPalette = () => ({
    open: false,
    query: '',
    index: 0,
    previousFocus: null,

    get commands() {
        const g = Alpine.store('global');
        const t = (key, fallback) => {
            const v = g.t(key);
            return v === key ? fallback : v;
        };
        const go = (tab, sub) => () => {
            g.activeTab = tab;
            if (sub) g.settingsTab = sub;
        };
        return [
            { id: 'nav-dashboard', group: 'Go to', label: t('dashboard', 'Dashboard'), run: go('dashboard') },
            { id: 'nav-accounts', group: 'Go to', label: t('accounts', 'Accounts'), run: go('accounts') },
            { id: 'nav-models', group: 'Go to', label: t('models', 'Models'), run: go('models') },
            { id: 'nav-logs', group: 'Go to', label: t('logs', 'Logs'), run: go('logs') },
            { id: 'nav-settings', group: 'Go to', label: t('settings', 'Settings'), run: go('settings', 'ui') },
            { id: 'nav-settings-claude', group: 'Go to', label: 'Settings: Claude CLI', run: go('settings', 'claude') },
            { id: 'nav-settings-models', group: 'Go to', label: 'Settings: Models', run: go('settings', 'models') },
            { id: 'nav-settings-server', group: 'Go to', label: 'Settings: Server', run: go('settings', 'server') },
            {
                id: 'act-add-account',
                group: 'Action',
                label: t('addAccount', 'Add account'),
                run: () => document.getElementById('add_account_modal')?.showModal()
            },
            {
                id: 'act-refresh',
                group: 'Action',
                label: t('refreshData', 'Refresh data'),
                run: () => Alpine.store('data').fetchData()
            },
            { id: 'act-theme', group: 'Action', label: 'Toggle light / dark theme', run: () => g.toggleMode() }
        ];
    },

    get results() {
        const q = this.query.trim().toLowerCase();
        if (!q) return this.commands;
        return this.commands.filter(c => (c.label + ' ' + c.group).toLowerCase().includes(q));
    },

    show() {
        this.previousFocus = document.activeElement;
        this.query = '';
        this.index = 0;
        this.open = true;
        this.$nextTick(() => this.$refs.input?.focus());
    },

    close() {
        this.open = false;
        if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
            this.previousFocus.focus();
        }
    },

    toggle() {
        this.open ? this.close() : this.show();
    },

    move(delta) {
        const n = this.results.length;
        if (!n) return;
        this.index = (this.index + delta + n) % n;
        this.$nextTick(() => {
            document.getElementById('palette-opt-' + this.index)?.scrollIntoView({ block: 'nearest' });
        });
    },

    run(cmd) {
        this.close();
        cmd.run();
    },

    runSelected() {
        const cmd = this.results[this.index];
        if (cmd) this.run(cmd);
    },

    init() {
        this.$watch('query', () => { this.index = 0; });
    }
});
