// On install, set default state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        isRunning: false,
        runningTabId: null,
        steps: [],
        loopSettings: { enabled: false, infinite: false, count: 5 } // Default loop settings
    });

    // Create Context Menus
    chrome.contextMenus.create({
        id: 'autoClickerMenu',
        title: '🚀 Auto Clicker Pro',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'addStep',
        parentId: 'autoClickerMenu',
        title: '➕ Add Click Step',
        contexts: ['all']
    });
});

let lastRightClick = { x: 0, y: 0 };

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Store click position from content script
    if (msg.action === 'storeRightClick') {
        lastRightClick = { x: msg.x, y: msg.y };
    }

    // Popup wants to start the sequence
    if (msg.action === 'startSequence') {
        // Get all required data from storage
        chrome.storage.local.get(['steps', 'isRunning', 'loopSettings'], (data) => {
            if (data.isRunning) {
                console.log('Sequence is already running.');
                return;
            }
            if (data.steps && data.steps.length > 0) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const currentTab = tabs[0];
                    if (currentTab) {
                        chrome.storage.local.set({ isRunning: true, runningTabId: currentTab.id });
                        // Send the 'runSteps' command with steps and loop settings from storage
                        chrome.tabs.sendMessage(currentTab.id, {
                            action: 'runSteps',
                            steps: data.steps,
                            loop: data.loopSettings // CRITICAL FIX: Use loop settings from storage
                        });
                    }
                });
            }
        });
    }

    // Popup wants to stop the sequence
    if (msg.action === 'stopSequence') {
        chrome.storage.local.get(['runningTabId'], (data) => {
            if (data.runningTabId) {
                chrome.tabs.sendMessage(data.runningTabId, { action: 'stop' });
            }
            // The 'executionFinished' message will handle resetting the state.
        });
    }

    // Content script finished execution (or was stopped)
    if (msg.action === 'executionFinished') {
        chrome.storage.local.set({ isRunning: false, runningTabId: null });
    }

    // Return true for asynchronous response
    return true;
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'addStep') {
        chrome.storage.local.get(['steps'], (data) => {
            const steps = data.steps || [];
            steps.push({
                action: 'clickAt',
                x: lastRightClick.x,
                y: lastRightClick.y,
                delay: 1000 // Default delay
            });
            chrome.storage.local.set({ steps }, () => {
                // Notify popup to update its UI
                chrome.runtime.sendMessage({ action: 'stepsUpdated' });
            });
        });
    }
});
