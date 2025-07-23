// background.js - Service Worker (Manifest V3 Module)

// --- 1. IMPORT FIREBASE SDKs ---
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js";

// --- 2. INITIALIZE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBmCi2l_D-sW8wBVwW9p128BsFEyGQOuz0",
    authDomain: "salesbee-test.firebaseapp.com",
    projectId: "salesbee-test",
    storageBucket: "salesbee-test.firebasestorage.app",
    messagingSenderId: "519990493612",
    appId: "1:519990493612:web:9e49c76f8f683e4fb47a09",
    measurementId: "G-S28X5JZQ0Z"
};

let app, auth, functions, db;

try {
    if (self.firebase && !firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      functions = app.functions('europe-west3');
      db = firebase.firestore();
    } else if (self.firebase) {
      app = firebase.app();
      auth = firebase.auth();
      functions = app.functions('europe-west3');
      db = firebase.firestore();
    }
} catch(e) {
    console.error("Error during Firebase initialization:", e);
}

// --- 3. MANAGE USER STATE ---
let userStatus = { user: null, isEmailVerified: false, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
let firestoreListener = null; // This will hold the unsubscribe function for our real-time listener.

const serializeUser = (user) => {
    if (!user) return null;
    return { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };
};

const broadcastStatusUpdate = (statusToBroadcast = userStatus) => {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.id && tab.url?.startsWith('http')) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'USER_STATUS_CHANGED',
                    payload: statusToBroadcast
                }).catch(err => {}); // Ignore errors from tabs without content script
            }
        }
    });
};

async function buildUserStatus(user) {
    if (!user) {
        return { user: null, isEmailVerified: false, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
    }
    try {
        await user.reload(); // Always get the latest auth state
        const freshUser = auth.currentUser;
        if (!freshUser) {
             return { user: null, isEmailVerified: false, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
        }

        const idTokenResult = await freshUser.getIdTokenResult();
        const stripeRole = idTokenResult.claims.stripeRole || null;
        const isEmailVerified = freshUser.emailVerified;

        // The user's customer document is the single source of truth for subscription status
        const customerRef = db.collection('customers').doc(freshUser.uid);
        const customerDoc = await customerRef.get();

        if (!customerDoc.exists) {
            // This can happen briefly during user initialization
            return { user: serializeUser(freshUser), isEmailVerified, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: stripeRole };
        }
        
        const customerData = customerDoc.data();
        const finalStatus = {
            user: serializeUser(freshUser),
            isEmailVerified,
            isSubscribed: customerData.isSubscribed === true, // Directly use the reliable flag from Firestore
            isVintedVerified: !!customerData.vintedInfo,
            hasHadTrial: customerData.hasHadTrial === true,
            role: stripeRole
        };
        return finalStatus;

    } catch (error) {
        console.error("Error building user status:", error);
        return { user: serializeUser(user), isEmailVerified: user.emailVerified, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
    }
}


if (auth) {
    auth.onAuthStateChanged((user) => {
        // ** CORRECTED REAL-TIME LISTENER LOGIC **
        // First, always detach any existing listener from the previous user.
        if (firestoreListener) {
            firestoreListener(); // This function unsubscribes the listener.
            firestoreListener = null;
        }

        if (user && db) {
            // If a user is logged in, attach a new real-time listener to their document.
            const customerRef = db.collection('customers').doc(user.uid);
            
            firestoreListener = customerRef.onSnapshot(async (doc) => {
                console.log("Real-time update received! Rebuilding status.");
                // When the document changes (e.g., `isSubscribed` becomes false),
                // rebuild the entire status object from the latest data and broadcast it.
                userStatus = await buildUserStatus(auth.currentUser);
                broadcastStatusUpdate(userStatus);
            }, (error) => {
                console.error("Firestore listener failed:", error);
            });
        } else {
            // If user logged out, create and broadcast a clean, logged-out status.
            buildUserStatus(null).then(status => {
                userStatus = status;
                broadcastStatusUpdate(userStatus);
            });
        }
    });
}


// --- 4. LISTEN FOR MESSAGES ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!auth) {
      sendResponse({ success: false, error: "Firebase not initialized." });
      return true;
    }

    (async () => {
        let status;
        switch (message.type) {
            case 'GET_USER_STATUS':
                // Forcing a refresh is good practice for critical UI loads.
                if (message.forceRefresh && auth.currentUser) {
                    status = await buildUserStatus(auth.currentUser);
                    userStatus = status; // Update the central status
                } else {
                    status = userStatus; // Otherwise, send the latest known status
                }
                sendResponse(status);
                break;

            case 'LOGIN':
            case 'LOGOUT':
            case 'START_FREE_TRIAL':
            case 'LINK_VINTED_ACCOUNT':
                // For all auth-related actions, we let onAuthStateChanged and the listener handle the status update.
                // We just need to perform the action and send back a success/error message.
                try {
                    let responseData = { success: true };
                    if (message.type === 'LOGIN') {
                        await auth.signInWithEmailAndPassword(message.payload.email, message.payload.password);
                    } else if (message.type === 'LOGOUT') {
                        await auth.signOut();
                    } else if (message.type === 'START_FREE_TRIAL') {
                        const startFreeTrial = functions.httpsCallable('startFreeTrial');
                        await startFreeTrial();
                    } else if (message.type === 'LINK_VINTED_ACCOUNT') {
                        const linkVintedAccount = functions.httpsCallable('linkVintedAccount');
                        await linkVintedAccount({ vintedUsername: message.payload.vintedUsername });
                    }
                    // We can rebuild status here to ensure the response is immediate
                    responseData.status = await buildUserStatus(auth.currentUser);
                    sendResponse(responseData);
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'USE_FEATURE':
                try {
                    const useFeature = functions.httpsCallable('useFeature');
                    const result = await useFeature({ feature: message.payload.featureName });
                    sendResponse({ success: true, data: result.data });
                } catch (error) {
                    // ** IMPORTANT ** If the backend denies permission, refresh the UI state
                    if (error.code === 'functions/permission-denied') {
                        console.log("Permission denied by backend. Forcing a status refresh.");
                        buildUserStatus(auth.currentUser).then(newStatus => {
                           userStatus = newStatus;
                           broadcastStatusUpdate(userStatus);
                        });
                    }
                    sendResponse({ success: false, error: error.message });
                }
                break;
            
            // The SEND_VERIFICATION_EMAIL case can remain as it was.
            case 'SEND_VERIFICATION_EMAIL':
                 try {
                    await auth.currentUser.sendEmailVerification();
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;
        }
    })();

    return true; // Keep message channel open for async response
});
