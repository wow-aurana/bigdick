'use strict';

// Receives events from the simulator tab over BroadcastChannel (see
// main.js). Kept as a separate channel/page rather than main.js writing
// straight into this tab's DOM, so this still works if the tab is closed
// and reopened, or reloaded, mid-run.
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const runButton = document.getElementById('run');

const channel = new BroadcastChannel('bigdickDebug');
channel.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'reset') {
    logEl.value = '';
    statusEl.textContent = 'Running...';
    runButton.disabled = true;
  } else if (msg.type === 'lines') {
    const atBottom =
        logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
    logEl.value += msg.lines.join('\n') + '\n';
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;
  } else if (msg.type === 'done') {
    statusEl.textContent = 'Finished.';
    runButton.disabled = false;
  }
};

// Asks the simulator tab (still running in the background -- see main.js)
// to run a debug simulation, without needing to switch back to it.
runButton.addEventListener('click', () => {
  channel.postMessage({ type: 'run' });
});

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(logEl.value);
  } catch (e) {
    logEl.select();
    document.execCommand('copy');
  }
  statusEl.textContent = 'Copied!';
});

document.getElementById('clear').addEventListener('click', () => {
  logEl.value = '';
  statusEl.textContent = '';
});
