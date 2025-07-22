

export function init(status, shadowRoot) {


    const welcomeEl = shadowRoot.getElementById('welcome-message');
    if (welcomeEl && status.user) {
        welcomeEl.textContent = `Welcome, ${status.user.email}!`;
    }

    shadowRoot.querySelectorAll('.use-feature-btn').forEach(button => {
        button.addEventListener('click', () => handleFeatureUsage(button, shadowRoot));
    });
    
    shadowRoot.getElementById('logout-btn-dashboard')?.addEventListener('click', (e) => handleLogout(e.currentTarget));
}

async function handleLogout(logoutBtn) {
    if(logoutBtn) logoutBtn.disabled = true;
    
    const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    
    if (response.success) {
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        logoutBtn.dispatchEvent(event);
    }

}

async function handleFeatureUsage(button, shadowRoot) {

    const featureName = button.dataset.feature;
    const messageBox = shadowRoot.getElementById('message-box');
    
    button.disabled = true;
    button.textContent = '...';

    const response = await chrome.runtime.sendMessage({ type: 'USE_FEATURE', payload: { featureName } });

    if (response.success) {
        messageBox.textContent = response.data.message || `Used ${featureName}!`;
        messageBox.className = 'feedback success';
    } else {
        messageBox.textContent = `Error: ${response.error}`;
        messageBox.className = 'feedback error';
    }
    
    messageBox.style.display = 'block';
    setTimeout(() => { 
        if(messageBox) messageBox.style.display = 'none'; 
    }, 5000);

    button.disabled = false;
    const originalText = featureName === 'refreshes' ? 'Use Refresh' : 'Use AI Description';
    button.textContent = originalText;
    //...
}
