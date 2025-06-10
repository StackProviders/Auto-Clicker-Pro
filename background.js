// On install, set default state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isRunning: false,
        isRecording: false, // State for recording mode
        runningTabId: null,
        steps: [],
        loopSettings: { enabled: false, infinite: false, count: 5 }
    });

    // Create Context Menus
    chrome.contextMenus.create({
        id: 'autoClickerMenu',
        title: '🚀 Auto Clicker Pro',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'addStepLegacy', // Kept for single-click additions
        parentId: 'autoClickerMenu',
        title: '➕ Add Single Click Step',
        contexts: ['all']
    });
});

let lastRightClick = { x: 0, y: 0 };

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Store right-click position for the legacy context menu
    if (msg.action === 'storeRightClick') {
        lastRightClick = { x: msg.x, y: msg.y };
    }
    // Popup wants to start the click sequence
    else if (msg.action === 'startSequence') {
        chrome.storage.local.get(['steps', 'isRunning', 'loopSettings'], (data) => {
            if (data.isRunning) return;
            if (data.steps && data.steps.length > 0) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const currentTab = tabs[0];
                    if (currentTab) {
                        chrome.storage.local.set({ isRunning: true, runningTabId: currentTab.id });
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'runSteps',
                            steps: data.steps,
                            loop: data.loopSettings
                        });
                    }
                });
            }
        });
    }
    // Popup wants to stop the click sequence
    else if (msg.action === 'stopSequence') {
        chrome.storage.local.get(['runningTabId'], (data) => {
            if (data.runningTabId) {
                chrome.tabs.sendMessage(data.runningTabId, { action: 'stop' });
            }
        });
    }
    // Content script finished execution
    else if (msg.action === 'executionFinished') {
        chrome.storage.local.set({ isRunning: false, runningTabId: null });
    }

    // --- New Recording Actions ---
    else if (msg.action === 'startRecording') {
        chrome.storage.local.set({ isRecording: true });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startRecordingSession' });
            }
        });
    } else if (msg.action === 'stopRecording') {
        chrome.storage.local.set({ isRecording: false });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'stopRecordingSession' });
            }
        });
    } else if (msg.action === 'addNewStep') {
        // This message comes from the content script during recording
        chrome.storage.local.get(['steps'], (data) => {
            const steps = data.steps || [];
            steps.push({
                action: 'clickAt',
                x: msg.x,
                y: msg.y,
                delay: 1000 // Default delay, can be edited later
            });
            chrome.storage.local.set({ steps });
        });
    }

    return true; // Keep the message channel open for asynchronous responses
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Legacy support for single step adding
    if (info.menuItemId === 'addStepLegacy') {
        chrome.storage.local.get(['steps'], (data) => {
            const steps = data.steps || [];
            steps.push({
                action: 'clickAt',
                x: lastRightClick.x,
                y: lastRightClick.y,
                delay: 1000
            });
            chrome.storage.local.set({ steps }, () => {
                // Notify popup to update its UI if it's open
                chrome.runtime.sendMessage({ action: 'stepsUpdated' });
            });
        });
    }
});
