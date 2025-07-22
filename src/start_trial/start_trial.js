// src/views/start_trial/start_trial.js

export function init(status, shadowRoot) {
    const welcomeEl = shadowRoot.getElementById('welcome-message-trial');
    if (welcomeEl && status.user) {
        welcomeEl.textContent = `Welcome, ${status.user.email}!`;
    }

    const startBtn = shadowRoot.getElementById('start-trial-btn');
    startBtn?.addEventListener('click', () => handleStartTrial(shadowRoot));

    const logoutBtn = shadowRoot.getElementById('logout-btn-trial');
    logoutBtn?.addEventListener('click', () => handleLogout(shadowRoot));
}

async function handleStartTrial(shadowRoot) {
    const startBtn = shadowRoot.getElementById('start-trial-btn');
    const messageBox = shadowRoot.getElementById('trial-message-box');

    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';
    messageBox.style.display = 'none';

    const response = await chrome.runtime.sendMessage({ type: 'START_FREE_TRIAL' });

    if (response.success) {
        messageBox.textContent = "Trial started! Taking you to the next step...";
        messageBox.className = 'feedback success';
        messageBox.style.display = 'block';
        
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        startBtn.dispatchEvent(event);

    } else {
        messageBox.textContent = `Error: ${response.error}`;
        messageBox.className = 'feedback error';
        messageBox.style.display = 'block';
        startBtn.disabled = false;
        startBtn.textContent = 'Start 7-Day Free Trial';
    }
}

async function handleLogout(shadowRoot) {
    const logoutBtn = shadowRoot.getElementById('logout-btn-trial');
    if (logoutBtn) logoutBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });

    if (response.success) {
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        logoutBtn.dispatchEvent(event);
    }
}
