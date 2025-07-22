// src/views/verify_email/verify_email.js

export function init(status, shadowRoot) {
    const emailDisplay = shadowRoot.getElementById('user-email-display');
    if (emailDisplay && status.user) {
        emailDisplay.textContent = status.user.email;
    }

    const checkBtn = shadowRoot.getElementById('check-verification-btn');
    checkBtn?.addEventListener('click', () => handleCheckVerification(shadowRoot));

    const resendLink = shadowRoot.getElementById('resend-email-link');
    resendLink?.addEventListener('click', (e) => handleResendEmail(e, shadowRoot));

    const logoutBtn = shadowRoot.getElementById('logout-btn-email');
    logoutBtn?.addEventListener('click', () => handleLogout(shadowRoot));
}

async function handleCheckVerification(shadowRoot) {
    const checkBtn = shadowRoot.getElementById('check-verification-btn');
    const messageBox = shadowRoot.getElementById('email-message-box');

    checkBtn.disabled = true;
    checkBtn.textContent = 'Checking...';
    messageBox.style.display = 'none';

    const latestStatus = await chrome.runtime.sendMessage({ type: 'GET_USER_STATUS', forceRefresh: true });

    const event = new CustomEvent('auth-state-update', { detail: latestStatus, bubbles: true, composed: true });
    checkBtn.dispatchEvent(event);

    if (!latestStatus.isEmailVerified) {
        messageBox.textContent = "Email not verified yet. Please check your inbox and try again.";
        messageBox.className = 'feedback error';
        messageBox.style.display = 'block';
        checkBtn.disabled = false;
        checkBtn.textContent = "I've Verified My Email";
    }
}

async function handleResendEmail(e, shadowRoot) {
    e.preventDefault();
    const messageBox = shadowRoot.getElementById('email-message-box');
    messageBox.textContent = 'Sending new link...';
    messageBox.className = 'feedback success';
    messageBox.style.display = 'block';

    const response = await chrome.runtime.sendMessage({ type: 'SEND_VERIFICATION_EMAIL' });

    if (response.success) {
        messageBox.textContent = 'New verification email sent!';
    } else {
        messageBox.textContent = `Error: ${response.error}`;
        messageBox.className = 'feedback error';
    }
}

async function handleLogout(shadowRoot) {
    const logoutBtn = shadowRoot.getElementById('logout-btn-email');
    if (logoutBtn) logoutBtn.disabled = true;
    const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    if (response.success) {
        const event = new CustomEvent('auth-state-update', { detail: response.status, bubbles: true, composed: true });
        logoutBtn.dispatchEvent(event);
    }
}
