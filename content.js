// Store right-click position for legacy "Add Single Step"
window.addEventListener('contextmenu', (e) => {
    chrome.runtime.sendMessage({
        action: 'storeRightClick',
        x: e.pageX,
        y: e.pageY
    });
});

// --- New Recording Feature ---

// This handler will be activated only when recording
const recordClickHandler = (e) => {
    // Prevent the click from triggering navigation or other default actions
    e.preventDefault();
    e.stopPropagation();

    // Send the coordinates to the background script to save as a new step
    chrome.runtime.sendMessage({
        action: 'addNewStep',
        x: e.pageX,
        y: e.pageY
    });

    // Visual feedback for the user on the page
    createClickIndicator(e.pageX, e.pageY);
};

// Create a visual indicator where the user clicked
const createClickIndicator = (x, y) => {
    const indicator = document.createElement('div');
    // Using a class from content.css for styling
    indicator.className = 'acp-click-indicator';
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;
    document.body.appendChild(indicator);
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 500);
    }, 200);
};

// Show a persistent banner on the page during recording
const showRecordingBanner = () => {
    let banner = document.getElementById('acp-recorder-banner');
    if (banner) return; // Banner already exists

    banner = document.createElement('div');
    banner.id = 'acp-recorder-banner';
    banner.innerHTML = `
        <div class="acp-banner-icon">🔴</div>
        <div class="acp-banner-text">
            <strong>Recording Clicks</strong>
            <span>Press the <b>Esc</b> key to stop</span>
        </div>
    `;
    document.body.appendChild(banner);

    // Listen for Escape key to stop recording
    document.addEventListener('keydown', escapeKeyListener);
};

// Hide the banner
const hideRecordingBanner = () => {
    const banner = document.getElementById('acp-recorder-banner');
    if (banner) banner.remove();
    document.removeEventListener('keydown', escapeKeyListener);
};

// The listener for the Escape key
const escapeKeyListener = (e) => {
    if (e.key === 'Escape') {
        chrome.runtime.sendMessage({ action: 'stopRecording' });
    }
};

// --- Main Message Listener ---

let stopExecution = false;

chrome.runtime.onMessage.addListener(async (msg) => {
    // New Recording Session Control
    if (msg.action === 'startRecordingSession') {
        document.addEventListener('click', recordClickHandler, true); // Use capture to get the event first
        showRecordingBanner();
    } else if (msg.action === 'stopRecordingSession') {
        document.removeEventListener('click', recordClickHandler, true);
        hideRecordingBanner();
    }

    // Existing Step Execution Logic
    else if (msg.action === 'runSteps') {
        stopExecution = false;
        const steps = msg.steps;
        const loop = msg.loop || { enabled: false, infinite: false, count: 1 };
        const loopCount = loop.enabled ? (loop.infinite ? Infinity : loop.count) : 1;
        let currentLoop = 0;

        chrome.runtime.sendMessage({
            action: 'progressUpdate',
            data: { stepIndex: 0, totalSteps: steps.length, currentLoop: 1, totalLoops: loopCount }
        });

        try {
            while (currentLoop < loopCount && !stopExecution) {
                currentLoop++;
                for (let i = 0; i < steps.length; i++) {
                    if (stopExecution) break;
                    chrome.runtime.sendMessage({
                        action: 'progressUpdate',
                        data: {
                            stepIndex: i,
                            totalSteps: steps.length,
                            currentLoop: currentLoop,
                            totalLoops: loopCount
                        }
                    });
                    await new Promise((res) => setTimeout(res, steps[i].delay));
                    if (stopExecution) break;

                    const clickX = steps[i].x - window.scrollX;
                    const clickY = steps[i].y - window.scrollY;
                    const element = document.elementFromPoint(clickX, clickY);

                    if (element) {
                        const evt = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: clickX,
                            clientY: clickY
                        });
                        element.dispatchEvent(evt);
                    } else {
                        console.warn(
                            `Auto Clicker Pro: No element found at page coordinates (${steps[i].x}, ${steps[i].y}).`
                        );
                    }
                }
            }
        } catch (error) {
            console.error('AutoClicker Pro Error:', error);
        } finally {
            chrome.runtime.sendMessage({ action: 'executionFinished' });
        }
    } else if (msg.action === 'stop') {
        stopExecution = true;
    }
});
