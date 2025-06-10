// Listen for right-clicks to store the position
window.addEventListener('contextmenu', (e) => {
    chrome.runtime.sendMessage({
        action: 'storeRightClick',
        // CRITICAL CHANGE: Use pageX/pageY instead of clientX/clientY
        // This makes the coordinate relative to the document, not the viewport.
        x: e.pageX,
        y: e.pageY
    });
});

let stopExecution = false;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === 'runSteps') {
        stopExecution = false;
        const steps = msg.steps;
        const loop = msg.loop || { enabled: false, infinite: false, count: 1 };
        const loopCount = loop.enabled ? (loop.infinite ? Infinity : loop.count) : 1;
        let currentLoop = 0;

        // Send initial progress to the popup
        chrome.runtime.sendMessage({
            action: 'progressUpdate',
            data: { stepIndex: 0, totalSteps: steps.length, currentLoop: 1, totalLoops: loopCount }
        });

        try {
            while (currentLoop < loopCount && !stopExecution) {
                currentLoop++;

                for (let i = 0; i < steps.length; i++) {
                    if (stopExecution) break;

                    // Update progress for popup
                    chrome.runtime.sendMessage({
                        action: 'progressUpdate',
                        data: {
                            stepIndex: i,
                            totalSteps: steps.length,
                            currentLoop: currentLoop,
                            totalLoops: loopCount
                        }
                    });

                    // Wait for the specified delay
                    await new Promise((res) => setTimeout(res, steps[i].delay));

                    if (stopExecution) break;

                    // CRITICAL CHANGE: Convert page coordinates back to viewport (client) coordinates
                    // This ensures the click works correctly even if the page is scrolled.
                    const clickX = steps[i].x - window.scrollX;
                    const clickY = steps[i].y - window.scrollY;

                    // Find the topmost element at the calculated viewport coordinates
                    const element = document.elementFromPoint(clickX, clickY);

                    if (element) {
                        // Create a realistic click event at the calculated coordinates
                        const evt = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: clickX,
                            clientY: clickY
                        });
                        // Dispatch the click on the found element
                        element.dispatchEvent(evt);
                    } else {
                        console.warn(
                            `Auto Clicker Pro: No element found at page coordinates (${steps[i].x}, ${steps[i].y}). The element might be off-screen or hidden.`
                        );
                    }
                }
            }
        } catch (error) {
            console.error('AutoClicker Pro Error:', error);
        } finally {
            // Notify the background script that execution has finished
            chrome.runtime.sendMessage({ action: 'executionFinished' });
        }
    } else if (msg.action === 'stop') {
        stopExecution = true;
    }
});
