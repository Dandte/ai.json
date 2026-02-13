// ia.json Viewer - Background Service Worker

// Check for ia.json when a tab finishes loading
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  let origin;
  try {
    origin = new URL(tab.url).origin;
  } catch {
    return;
  }

  // Skip non-http(s) pages
  if (!origin.startsWith('http')) return;

  const result = await checkIaJson(origin);

  // Store result for this tab
  await chrome.storage.session.set({ [`tab_${tabId}`]: result });

  // Update badge
  if (result.found) {
    chrome.action.setBadgeText({ tabId, text: 'IA' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#38a169' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`tab_${tabId}`);
});

async function checkIaJson(origin) {
  // Try primary location
  const primary = await fetchIaJson(`${origin}/ia.json`);
  if (primary.found) return primary;

  // Try well-known location
  const wellKnown = await fetchIaJson(`${origin}/.well-known/ia.json`);
  return wellKnown;
}

async function fetchIaJson(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return { found: false, url };
    }

    const text = await response.text();
    const data = JSON.parse(text);

    // Basic check: must be an object with version, site, api
    if (typeof data === 'object' && data !== null && data.version && data.site && data.api) {
      return { found: true, url, data, raw: text };
    }

    return { found: false, url };
  } catch {
    return { found: false, url };
  }
}
