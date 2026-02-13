// ia.json Viewer - Popup Logic

document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    content.innerHTML = renderNotFound('No active tab');
    return;
  }

  // Get stored result for this tab
  const key = `tab_${tab.id}`;
  const stored = await chrome.storage.session.get(key);
  const result = stored[key];

  if (!result || !result.found) {
    // Try fetching directly (in case background hasn't run yet)
    let origin;
    try {
      origin = new URL(tab.url).origin;
    } catch {
      content.innerHTML = renderNotFound('Invalid URL');
      return;
    }

    if (!origin.startsWith('http')) {
      content.innerHTML = renderNotFound('Only works on HTTP/HTTPS pages');
      return;
    }

    content.innerHTML = '<div class="loading">Checking for ia.json...</div>';

    const freshResult = await checkIaJsonDirect(origin);
    if (freshResult.found) {
      renderData(content, freshResult);
    } else {
      content.innerHTML = renderNotFound(origin);
    }
    return;
  }

  renderData(content, result);
});

async function checkIaJsonDirect(origin) {
  for (const path of ['/ia.json', '/.well-known/ia.json']) {
    try {
      const url = origin + path;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) continue;
      const text = await res.text();
      const data = JSON.parse(text);
      if (data && data.version && data.site && data.api) {
        return { found: true, url, data, raw: text };
      }
    } catch { /* continue */ }
  }
  return { found: false };
}

function renderData(container, result) {
  const data = result.data;
  const validation = validateIaJson(data);

  // Count endpoints
  const publicCount = data.api.public ? Object.keys(data.api.public).length : 0;
  const protectedCount = data.api.protected ? Object.keys(data.api.protected).length : 0;
  const userCount = data.api.user_required ? Object.keys(data.api.user_required).length : 0;
  const totalCount = publicCount + protectedCount + userCount;

  let html = '';

  // Status
  html += `
    <div class="status">
      <div class="status-dot found"></div>
      <div>
        <div class="status-text">ia.json found</div>
        <div class="status-url">${escapeHtml(result.url)}</div>
      </div>
    </div>`;

  // Site info
  html += `
    <div class="site-info">
      <div class="site-name">${escapeHtml(data.site.name || 'Unknown')}</div>
      <div class="site-meta">
        <span class="badge badge-type">${escapeHtml(data.site.type || 'other')}</span>
        <span class="badge badge-version">v${escapeHtml(data.version || '?')}</span>
        <span class="badge ${validation.valid ? 'badge-valid' : 'badge-invalid'}">${validation.valid ? 'Valid' : validation.errors.length + ' errors'}</span>
      </div>
      ${data.site.description ? `<p style="margin-top:8px;font-size:12px;color:#718096;">${escapeHtml(data.site.description)}</p>` : ''}
    </div>`;

  // Endpoints
  if (totalCount > 0) {
    html += `<div class="endpoints">
      <div class="endpoints-title">Endpoints (${totalCount})</div>`;

    if (publicCount > 0) html += renderEndpointGroup('Public', data.api.public, 'public');
    if (protectedCount > 0) html += renderEndpointGroup('Protected', data.api.protected, 'protected');
    if (userCount > 0) html += renderEndpointGroup('User Required', data.api.user_required, 'user_required');

    html += '</div>';
  }

  // Validation warnings/errors
  if (validation.errors.length > 0 || validation.warnings.length > 0) {
    html += '<div class="validation"><div class="validation-header">Validation</div>';
    for (const err of validation.errors) {
      html += `<div class="validation-item error">${escapeHtml(err.path)}: ${escapeHtml(err.message)}</div>`;
    }
    for (const warn of validation.warnings) {
      html += `<div class="validation-item warning">${escapeHtml(warn.path)}: ${escapeHtml(warn.message)}</div>`;
    }
    html += '</div>';
  }

  // Capabilities
  if (data.capabilities) {
    const caps = Object.entries(data.capabilities).filter(([, v]) => v === true).map(([k]) => k);
    if (caps.length > 0) {
      html += `<div class="site-info" style="padding:10px 16px;">
        <div style="font-size:12px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Capabilities</div>
        <div class="site-meta">${caps.map(c => `<span class="badge badge-type">${escapeHtml(c)}</span>`).join('')}</div>
      </div>`;
    }
  }

  // Raw JSON
  html += `
    <div class="raw-toggle">
      <button class="toggle-btn" id="toggleRaw">View Raw JSON</button>
      <pre class="raw-json" id="rawJson">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
    </div>`;

  // Footer
  html += `
    <div class="footer">
      <a href="https://dandte.github.io/ai.json/" target="_blank">ia.json Standard</a>
      &nbsp;&middot;&nbsp;
      <a href="https://dandte.github.io/ai.json/validator.html" target="_blank">Online Validator</a>
    </div>`;

  container.innerHTML = html;

  // Toggle raw JSON
  document.getElementById('toggleRaw').addEventListener('click', () => {
    const raw = document.getElementById('rawJson');
    raw.classList.toggle('open');
    document.getElementById('toggleRaw').textContent = raw.classList.contains('open') ? 'Hide Raw JSON' : 'View Raw JSON';
  });

  // Toggle endpoint groups
  container.querySelectorAll('.group-header').forEach(header => {
    header.addEventListener('click', () => {
      const list = header.nextElementSibling;
      const arrow = header.querySelector('.group-arrow');
      list.classList.toggle('open');
      arrow.classList.toggle('open');
    });
  });
}

function renderEndpointGroup(label, endpoints, level) {
  const entries = Object.entries(endpoints);
  let html = `
    <div class="endpoint-group">
      <div class="group-header">
        <span class="group-name">${label}</span>
        <span class="group-count">${entries.length}</span>
        <span class="group-arrow">&#9654;</span>
      </div>
      <div class="endpoint-list">`;

  for (const [name, ep] of entries) {
    html += `
      <div class="endpoint">
        <span class="method method-${ep.method || 'GET'}">${ep.method || '?'}</span>
        <span class="endpoint-path" title="${escapeHtml(ep.description || name)}">${escapeHtml(ep.path || '/' + name)}</span>
      </div>`;
  }

  html += '</div></div>';
  return html;
}

function renderNotFound(detail) {
  return `
    <div class="not-found">
      <div class="not-found-icon">{ }</div>
      <h3>No ia.json found</h3>
      <p>This site does not have an ia.json file.<br>
      <a href="https://dandte.github.io/ai.json/" target="_blank" style="color:#1a365d;">Learn about ia.json</a></p>
    </div>
    <div class="footer">
      <a href="https://dandte.github.io/ai.json/generator.html" target="_blank">Generate ia.json with AI</a>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
