// src/content.js

(async () => {
    // This will hold the function that updates the UI, so the message listener can call it.
    let uiUpdater = null;

    // --- A. SET UP THE SINGLE MESSAGE LISTENER ---
    // We set this up only once to avoid duplicate listeners on re-injection.
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'USER_STATUS_CHANGED' && typeof uiUpdater === 'function') {
            uiUpdater(message.payload);
        }
    });

    const initializeApp = async () => {
        // --- 0. PREVENT DUPLICATE INJECTION ---
        // If the app container already exists, don't do anything.
        if (document.getElementById('my-auth-extension-container')) {
            return;
        }

        // --- 1. INJECT APP CONTAINER AND CREATE SHADOW ROOT ---
        const appHost = document.createElement('div');
        appHost.id = 'my-auth-extension-container';
        document.body.prepend(appHost);

        const shadowRoot = appHost.attachShadow({ mode: 'open' });

        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('styles/main.css');
        shadowRoot.appendChild(styleLink);

        const appContainer = document.createElement('div');
        appContainer.id = 'auth-app-content-wrapper';
        shadowRoot.appendChild(appContainer);


        // --- 2. DYNAMIC VIEW LOADER (ADAPTED FOR SHADOW DOM) ---
        const loadView = async (viewName, status) => {
            try {
                const viewHtmlUrl = chrome.runtime.getURL(`src/views/${viewName}/${viewName}.html`);
                const response = await fetch(viewHtmlUrl);
                if (!response.ok) throw new Error(`Failed to fetch ${viewName}.html: ${response.statusText}`);
                
                appContainer.innerHTML = await response.text();

                const viewJsUrl = chrome.runtime.getURL(`src/views/${viewName}/${viewName}.js`);
                const viewModule = await import(viewJsUrl);
                if (viewModule && typeof viewModule.init === 'function') {
                    viewModule.init(status, shadowRoot);
                }
            } catch (error) {
                console.error(`Error loading view ${viewName}:`, error);
                appContainer.innerHTML = `<div id="auth-app-content"><p class="error">Error loading view. Please refresh.</p></div>`;
            }
        };

        // --- 3. UI ROUTER ---
        const updateUserInterface = (status) => {
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

        // Assign the UI update function to the outer scope variable.
        uiUpdater = updateUserInterface;
      
        // --- 4. LISTENERS & INITIALIZATION ---
        appHost.addEventListener('auth-state-update', (e) => {
            updateUserInterface(e.detail);
        });

        try {
            const initialStatus = await chrome.runtime.sendMessage({ type: 'GET_USER_STATUS' });
            updateUserInterface(initialStatus);
        } catch (error) {
            console.warn("Could not get initial status. This is often normal on first load.", error.message);
        }

        // --- 5. OBSERVE AND RE-INJECT IF REMOVED ---
        const observer = new MutationObserver((mutations, obs) => {
            const appRemoved = mutations.some(mutation => 
                Array.from(mutation.removedNodes).some(node => node.id === 'my-auth-extension-container')
            );

            if (appRemoved) {
                console.log("Auth extension container removed via MutationObserver, re-injecting...");
                obs.disconnect(); // Stop observing before re-injecting
                initializeApp(); // Re-initialize the app
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: false // We only care about direct children of the body
        });
    };

    // --- 6. PERIODIC CHECK (FALLBACK MECHANISM) ---
    // This will run every 2 seconds to ensure the app is always present,
    // acting as a backup for the MutationObserver.
    setInterval(() => {
        if (!document.getElementById('my-auth-extension-container')) {
            console.log('Auth extension container not found, re-injecting via setInterval.');
            initializeApp();
        }
    }, 2000); // Check every 2 seconds


    // Initial load of the app
    initializeApp();
})();
