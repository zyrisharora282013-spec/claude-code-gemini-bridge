/**
 * Utility functions for Antigravity Console
 */

window.utils = {
    _passwordResolve: null,

    showPasswordModal() {
        return new Promise((resolve) => {
            window.utils._passwordResolve = resolve;
            const modal = document.getElementById('password_prompt_modal');
            if (modal) {
                const input = modal.querySelector('input[type="password"]');
                if (input) input.value = '';
                modal.showModal();
                setTimeout(() => input?.focus(), 50);
            } else {
                resolve(null);
            }
        });
    },

    submitPassword() {
        const modal = document.getElementById('password_prompt_modal');
        const input = modal?.querySelector('input[type="password"]');
        const password = input?.value || '';
        if (modal) modal.close();
        if (window.utils._passwordResolve) {
            window.utils._passwordResolve(password || null);
            window.utils._passwordResolve = null;
        }
    },

    cancelPassword() {
        const modal = document.getElementById('password_prompt_modal');
        if (modal) modal.close();
        if (window.utils._passwordResolve) {
            window.utils._passwordResolve(null);
            window.utils._passwordResolve = null;
        }
    },

    _confirmResolve: null,

    showConfirmModal(message) {
        return new Promise((resolve) => {
            window.utils._confirmResolve = resolve;
            const modal = document.getElementById('confirm_action_modal');
            if (modal) {
                const msgEl = modal.querySelector('[data-confirm-message]');
                if (msgEl) msgEl.textContent = message;
                modal.showModal();
            } else {
                resolve(false);
            }
        });
    },

    confirmAction(accepted) {
        const modal = document.getElementById('confirm_action_modal');
        if (modal) modal.close();
        if (window.utils._confirmResolve) {
            window.utils._confirmResolve(accepted);
            window.utils._confirmResolve = null;
        }
    },

    // Shared Request Wrapper
    async request(url, options = {}, webuiPassword = '') {
        options.headers = options.headers || {};
        if (webuiPassword) {
            options.headers['x-webui-password'] = webuiPassword;
        }

        let response = await fetch(url, options);

        if (response.status === 401) {
            const password = await window.utils.showPasswordModal();
            if (password) {
                localStorage.setItem('antigravity_webui_password', password);
                options.headers['x-webui-password'] = password;
                response = await fetch(url, options);
                return { response, newPassword: password };
            }
        }

        return { response, newPassword: null };
    },

    formatTimeUntil(isoTime) {
        const store = Alpine.store('global');
        const diff = new Date(isoTime) - new Date();
        if (diff <= 0) return store ? store.t('ready') : 'READY';
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(mins / 60);

        const hSuffix = store ? store.t('timeH') : 'H';
        const mSuffix = store ? store.t('timeM') : 'M';

        if (hrs > 0) return `${hrs}${hSuffix} ${mins % 60}${mSuffix}`;
        return `${mins}${mSuffix}`;
    },

    getThemeColor(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },

    /**
     * Debounce function - delays execution until after specified wait time
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
