document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start');
    const startText = document.getElementById('startText');
    const stepList = document.getElementById('stepList');
    const loopEnabled = document.getElementById('loopEnabled');
    const loopSettingsDiv = document.getElementById('loopSettings');
    const loopCount = document.getElementById('loopCount');
    const loopInfinite = document.getElementById('loopInfinite');
    const progressBar = document.getElementById('progressBar');
    const loopCounter = document.getElementById('loopCounter');
    const editModal = document.getElementById('editModal');
    const editDelay = document.getElementById('editDelay');
    const saveEdit = document.getElementById('saveEdit');
    const cancelEdit = document.getElementById('cancelEdit');
    const clearStepsBtn = document.getElementById('clearSteps');

    let editIndex = null;
    let uiControls = [loopEnabled, loopCount, loopInfinite, clearStepsBtn];

    // --- UI Update Function ---
    function updateUI(isRunning) {
        if (isRunning) {
            startText.textContent = 'Stop Execution';
            startBtn.classList.add('running');
            uiControls.forEach((el) => (el.disabled = true));
            stepList.classList.add('running');
        } else {
            startText.textContent = 'Start Sequence';
            startBtn.classList.remove('running');
            uiControls.forEach((el) => (el.disabled = false));
            // Re-apply disabled state based on checkboxes
            loopCount.disabled = loopInfinite.checked || !loopEnabled.checked;
            stepList.classList.remove('running');
            resetProgress();
        }
    }

    // --- Render Steps from Storage ---
    function renderSteps(steps = []) {
        stepList.innerHTML = '';
        if (steps.length === 0) {
            stepList.innerHTML = `<div class="empty-steps">No steps recorded yet.</div>`;
            return;
        }

        steps.forEach((step, index) => {
            const li = document.createElement('li');
            li.dataset.index = index;
            li.innerHTML = `
                <div class="step-content">
                    <div class="step-counter">${index + 1}</div>
                    <div class="step-details">
                        <div class="step-position">Position: (${step.x}, ${step.y})</div>
                        <div class="step-delay">Delay: <strong>${step.delay}ms</strong></div>
                    </div>
                </div>
                <div class="step-actions">
                    <button class="action-btn edit-btn" title="Edit Delay" data-index="${index}">✏️</button>
                    <button class="action-btn remove-btn" title="Delete Step" data-index="${index}">🗑️</button>
                </div>
            `;
            stepList.appendChild(li);
        });

        // Attach event listeners
        document.querySelectorAll('.remove-btn').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeStep(parseInt(btn.dataset.index));
            })
        );
        document.querySelectorAll('.edit-btn').forEach((btn) =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(parseInt(btn.dataset.index));
            })
        );
    }

    // --- Start Sequence ---
    startBtn.addEventListener('click', () => {
        chrome.storage.local.get('isRunning', (data) => {
            if (data.isRunning) {
                chrome.runtime.sendMessage({ action: 'stopSequence' });
            } else {
                chrome.storage.local.get('steps', (res) => {
                    if (!res.steps || res.steps.length === 0) {
                        alert('Please add at least one step before starting.');
                        return;
                    }
                    // CRITICAL FIX: Save loop settings to storage before starting
                    const loopSettings = {
                        enabled: loopEnabled.checked,
                        infinite: loopInfinite.checked,
                        count: parseInt(loopCount.value) || 1
                    };
                    chrome.storage.local.set({ loopSettings }, () => {
                        // Now tell the background script to start
                        chrome.runtime.sendMessage({ action: 'startSequence' });
                    });
                });
            }
        });
    });

    // --- Other Functions (unchanged from previous correct version) ---
    function removeStep(index) {
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            steps.splice(index, 1);
            chrome.storage.local.set({ steps }); // on-change listener will re-render
        });
    }

    function clearAllSteps() {
        if (confirm('Are you sure you want to clear all steps?')) {
            chrome.storage.local.set({ steps: [] });
        }
    }

    function openEditModal(index) {
        chrome.storage.local.get(['steps'], (data) => {
            if (index >= 0 && index < data.steps.length) {
                editIndex = index;
                editDelay.value = data.steps[index].delay;
                editModal.style.display = 'flex';
                editDelay.focus();
            }
        });
    }

    function saveDelayEdit() {
        if (editIndex === null) return;
        chrome.storage.local.get(['steps'], (data) => {
            let steps = data.steps || [];
            steps[editIndex].delay = parseInt(editDelay.value) || 1000;
            chrome.storage.local.set({ steps }, () => {
                closeEditModal();
            });
        });
    }

    function closeEditModal() {
        editModal.style.display = 'none';
        editIndex = null;
    }

    function updateProgress(data) {
        const { stepIndex, totalSteps, currentLoop, totalLoops } = data;
        const percent = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
        progressBar.style.width = `${percent}%`;

        document.querySelectorAll('#stepList li').forEach((li) => li.classList.remove('active'));
        const activeLi = document.querySelector(`#stepList li[data-index='${stepIndex}']`);
        if (activeLi) activeLi.classList.add('active');

        const totalLoopDisplay = totalLoops === Infinity ? '∞' : totalLoops;
        if (loopEnabled.checked && totalLoops > 1) {
            loopCounter.textContent = `Loop ${currentLoop} of ${totalLoopDisplay} | Step ${
                stepIndex + 1
            } of ${totalSteps}`;
        } else {
            loopCounter.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
        }
    }

    function resetProgress() {
        progressBar.style.width = '0%';
        loopCounter.textContent = '';
        document.querySelectorAll('#stepList li').forEach((li) => li.classList.remove('active'));
    }

    function handleLoopControlsChange() {
        loopSettingsDiv.style.display = loopEnabled.checked ? 'block' : 'none';
        loopCount.disabled = !loopEnabled.checked || loopInfinite.checked;
    }

    loopEnabled.addEventListener('change', handleLoopControlsChange);
    loopInfinite.addEventListener('change', handleLoopControlsChange);
    clearStepsBtn.addEventListener('click', clearAllSteps);
    saveEdit.addEventListener('click', saveDelayEdit);
    cancelEdit.addEventListener('click', closeEditModal);

    // --- Real-time Listeners ---
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'stepsUpdated') {
            chrome.storage.local.get(['steps'], (data) => renderSteps(data.steps));
        } else if (msg.action === 'progressUpdate') {
            updateProgress(msg.data);
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.isRunning) {
                updateUI(changes.isRunning.newValue);
            }
            if (changes.steps) {
                renderSteps(changes.steps.newValue);
            }
        }
    });

    // --- Initial Load ---
    function initializePopup() {
        chrome.storage.local.get(['steps', 'isRunning', 'loopSettings'], (data) => {
            renderSteps(data.steps || []);
            updateUI(data.isRunning || false);

            // Restore loop controls state
            const settings = data.loopSettings || { enabled: false, infinite: false, count: 5 };
            loopEnabled.checked = settings.enabled;
            loopInfinite.checked = settings.infinite;
            loopCount.value = settings.count;
            handleLoopControlsChange();
        });
    }

    initializePopup();
});
