// src/content.js

(async () => {
    // --- 1. INJECT APP CONTAINER AND CREATE SHADOW ROOT ---
    const appHost = document.createElement('div');
    appHost.id = 'my-auth-extension-container';
    // **FIX: Use prepend instead of appendChild to inject at the start of the body**
    document.body.prepend(appHost);

    // Attach the shadow root
    const shadowRoot = appHost.attachShadow({ mode: 'open' });

    // Inject the main stylesheet into the shadow DOM
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('styles/main.css');
    shadowRoot.appendChild(styleLink);

    // This div will hold the content of each view
    const appContainer = document.createElement('div');
    appContainer.id = 'auth-app-content-wrapper';
    shadowRoot.appendChild(appContainer);


    // --- 2. DYNAMIC VIEW LOADER (ADAPTED FOR SHADOW DOM) ---
    const loadView = async (viewName, status) => {
        try {
            const viewHtmlUrl = chrome.runtime.getURL(`src/views/${viewName}/${viewName}.html`);
            const response = await fetch(viewHtmlUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${viewName}.html: ${response.statusText}`);
            
            // Load the HTML into our shadow DOM container
            appContainer.innerHTML = await response.text();

            // IMPORTANT: Import the view's JS and pass the shadowRoot to its init function
            const viewJsUrl = chrome.runtime.getURL(`src/views/${viewName}/${viewName}.js`);
            const viewModule = await import(viewJsUrl);
            if (viewModule && typeof viewModule.init === 'function') {
                // Pass the shadowRoot so the view can find its elements
                viewModule.init(status, shadowRoot);
            }
        } catch (error) {
            console.error(`Error loading view ${viewName}:`, error);
            appContainer.innerHTML = `<div id="auth-app-content"><p class="error">Error loading view. Please refresh.</p></div>`;
        }
    };

    // --- 3. UI ROUTER (NO CHANGE NEEDED HERE) ---
    const updateUserInterface = (status) => {
        // This logic remains the same
        if (!status || !status.user) {
            loadView('login', status);
            return;
        }
        if (status.isEmailVerified === false) {
            loadView('verify_email', status);
        } else if (status.isSubscribed === false && status.hasHadTrial === false) {
            loadView('start_trial', status);
        } else if (status.isSubscribed === false && status.hasHadTrial === true) {
            loadView('no_subscription', status);
        } else if (status.isVintedVerified === false) {
            loadView('verify_account', status);
        } else {
            loadView('dashboard', status);
        }
    };
  
    // --- 4. LISTENERS & INITIALIZATION ---
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'USER_STATUS_CHANGED') {
            updateUserInterface(message.payload);
        }
    });
    
    // Listen for the custom event on the HOST element, not the document
    appHost.addEventListener('auth-state-update', (e) => {
        updateUserInterface(e.detail);
    });

    // Initial load
    try {
        const initialStatus = await chrome.runtime.sendMessage({ type: 'GET_USER_STATUS' });
        updateUserInterface(initialStatus);
    } catch (error) {
        console.warn("Could not get initial status. This is often normal on first load.", error.message);
    }

})();
