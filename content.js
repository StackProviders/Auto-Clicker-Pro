window.addEventListener('contextmenu', (e) => {
    chrome.runtime.sendMessage({
        action: 'storeRightClick',
        x: e.clientX,
        y: e.clientY
    });
});

let stopExecution = false;

chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === 'runSteps') {
        stopExecution = false;
        const steps = msg.steps;
        const loop = msg.loop || { enabled: false, infinite: false, count: 1 };
        const loopCount = loop.enabled ? (loop.infinite ? Infinity : loop.count) : 1;
        let currentLoop = 0;

        // Send initial progress
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

                    await new Promise((res) => setTimeout(res, steps[i].delay));

                    if (stopExecution) break;

                    const evt = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: steps[i].x,
                        clientY: steps[i].y,
                        view: window
                    });

                    const element = document.elementFromPoint(steps[i].x, steps[i].y);
                    if (element) {
                        element.dispatchEvent(evt);
                    }
                }
            }
        } catch (error) {
            console.error('AutoClicker Pro Error:', error);
        } finally {
            // Send completion message to background script
            chrome.runtime.sendMessage({ action: 'executionFinished' });
        }
    } else if (msg.action === 'stop') {
        stopExecution = true;
        // The loop will break, and the finally block will send 'executionFinished'
    }
});
