// src/views/verify_account/verify_account.js

export function init(status, shadowRoot) {
    const linkBtn = shadowRoot.getElementById('link-account-btn');
    linkBtn?.addEventListener('click', () => handleLinkAccount(shadowRoot));

    const logoutBtn = shadowRoot.getElementById('logout-btn-verify');
    logoutBtn?.addEventListener('click', () => handleLogout(shadowRoot));
}

async function handleLinkAccount(shadowRoot) {
    const linkBtn = shadowRoot.getElementById('link-account-btn');
    const messageBox = shadowRoot.getElementById('verify-message-box');

    if (!window.location.href.includes('/member/')) {
        messageBox.textContent = "Error: Please navigate to your Vinted profile page first.";
        messageBox.className = 'feedback error';
        messageBox.style.display = 'block';
        return;
    }

    const urlParts = window.location.pathname.split('/');
    const vintedUsername = urlParts.pop() || urlParts.pop();

    if (!vintedUsername) {
        messageBox.textContent = "Error: Could not find Vinted username in the URL.";
        messageBox.className = 'feedback error';
        messageBox.style.display = 'block';
        return;
    }

    linkBtn.disabled = true;
    linkBtn.textContent = 'Linking...';
    messageBox.style.display = 'none';

    const response = await chrome.runtime.sendMessage({
        type: 'LINK_VINTED_ACCOUNT',
        payload: { vintedUsername }
    });

    if (response.success) {
        messageBox.textContent = "Account linked successfully! Refreshing...";
        messageBox.className = 'feedback success';
        messageBox.style.display = 'block';
        
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        linkBtn.dispatchEvent(event);

    } else {
        messageBox.textContent = `Error: ${response.error}`;
        messageBox.className = 'feedback error';
        messageBox.style.display = 'block';
        linkBtn.disabled = false;
        linkBtn.textContent = 'Link My Vinted Account';
    }
}

async function handleLogout(shadowRoot) {
    const logoutBtn = shadowRoot.getElementById('logout-btn-verify');
    if (logoutBtn) logoutBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });

    if (response.success) {
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        logoutBtn.dispatchEvent(event);
    }
}
