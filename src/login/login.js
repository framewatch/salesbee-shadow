
// src/views/login/login.js

export function init(status, shadowRoot) {
    const loginBtn = shadowRoot.getElementById('login-btn');
    if (loginBtn) {
        // Use an arrow function to pass shadowRoot to the handler
        loginBtn.addEventListener('click', () => handleLogin(shadowRoot));
    }
}

// The function now accepts shadowRoot as an argument
async function handleLogin(shadowRoot) {
    const emailInput = shadowRoot.getElementById('email-input');
    const passwordInput = shadowRoot.getElementById('password-input');
    const errorEl = shadowRoot.getElementById('error-message');
    const loginBtn = shadowRoot.getElementById('login-btn');

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
        errorEl.textContent = "Please enter email and password.";
        errorEl.style.display = 'block';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    errorEl.style.display = 'none';

    const response = await chrome.runtime.sendMessage({ type: 'LOGIN', payload: { email, password } });

    if (response.success) {
        const event = new CustomEvent('auth-state-update', {
            detail: response.status,
            bubbles: true, // Let the event bubble up
            composed: true // Let the event cross the shadow DOM boundary
        });
        // Dispatch the event from an element *inside* the shadow DOM
        loginBtn.dispatchEvent(event);
    } else {
        errorEl.textContent = response.error;
        errorEl.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}
