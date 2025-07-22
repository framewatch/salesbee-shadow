// src/views/no_subscription/no_subscription.js

export function init(status, shadowRoot) {
    const logoutBtn = shadowRoot.getElementById('logout-btn-no-sub');
    logoutBtn?.addEventListener('click', () => handleLogout(shadowRoot));
}

async function handleLogout(shadowRoot) {
    const logoutBtn = shadowRoot.getElementById('logout-btn-no-sub');
    if(logoutBtn) logoutBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });

    if (response.success) {
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        logoutBtn.dispatchEvent(event);
    }
}
