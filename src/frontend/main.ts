import './styles.css';

type SfxItem = {
  id: string;
  name: string;
  url: string;
  tags: string[];
  lengthSeconds: number;
  downloads: number;
  likes: number;
  dislikes: number;
  createdAt: number;
};

type PackItem = {
  id: string;
  name: string;
  ids: string[];
  downloads: number;
  likes: number;
  dislikes: number;
  createdAt: number;
};

type ListResponse<T> = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  data: T[];
};

type CurrentUser = {
  id: string;
  githubId: string;
  username: string;
  githubUsername: string;
  avatarUrl?: string | null;
  role: 'admin' | 'moderator' | 'user';
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <div class="shell">
    <header class="hero">
      <div class="hero__copy">
        <p class="eyebrow">HOME</p>
        <h1>Custom Death Sounds</h1>
        <p class="lede">
          Browse, upload, and manage custom death sounds for the CDS without leaving the page.
        </p>
      </div>
      <div class="hero__panel" id="authPanel"></div>
    </header>

    <main class="grid">
      <section class="panel panel--wide">
        <div class="panel__header">
          <div>
            <p class="section-label">Library</p>
            <h2>Sounds</h2>
          </div>
          <div class="panel__actions">
            <button id="refreshBtn" type="button">Refresh</button>
            <button id="toggleRecentBtn" type="button" class="button--ghost">Sort: Recent</button>
          </div>
        </div>
        <div class="search-row">
          <input id="sfxSearchInput" type="text" placeholder="Search sounds by name or ID" autocomplete="off" />
        </div>
        <div id="sfxList" class="card-list"></div>
        <div class="pagination-row" id="sfxPagination">
          <button id="sfxPrevBtn" type="button" class="button--ghost">Prev</button>
          <span id="sfxPageInfo" class="pill">Page 1 / 1</span>
          <button id="sfxNextBtn" type="button" class="button--ghost">Next</button>
        </div>
      </section>

      <section class="panel panel--wide">
        <div class="panel__header">
          <div>
            <p class="section-label">Collections</p>
            <h2>Packs</h2>
          </div>
          <span id="libraryState" class="pill">Loading</span>
        </div>
        <div class="search-row">
          <input id="packSearchInput" type="text" placeholder="Search packs by name or ID" autocomplete="off" />
        </div>
        <div id="packList" class="card-list"></div>
        <div class="pagination-row" id="packPagination">
          <button id="packPrevBtn" type="button" class="button--ghost">Prev</button>
          <span id="packPageInfo" class="pill">Page 1 / 1</span>
          <button id="packNextBtn" type="button" class="button--ghost">Next</button>
        </div>
      </section>

      <section class="panel panel--wide" id="adminToolsPanel"></section>
    </main>

    <footer class="footer">
      <p id="statusText">Starting up.</p>
    </footer>
  </div>
`;

const authPanel = document.querySelector<HTMLDivElement>('#authPanel');
const refreshBtn = document.querySelector<HTMLButtonElement>('#refreshBtn');
const toggleRecentBtn = document.querySelector<HTMLButtonElement>('#toggleRecentBtn');
const statusText = document.querySelector<HTMLElement>('#statusText');
const libraryState = document.querySelector<HTMLElement>('#libraryState');
const sfxList = document.querySelector<HTMLDivElement>('#sfxList');
const packList = document.querySelector<HTMLDivElement>('#packList');
const sfxPrevBtn = document.querySelector<HTMLButtonElement>('#sfxPrevBtn');
const sfxNextBtn = document.querySelector<HTMLButtonElement>('#sfxNextBtn');
const packPrevBtn = document.querySelector<HTMLButtonElement>('#packPrevBtn');
const packNextBtn = document.querySelector<HTMLButtonElement>('#packNextBtn');
const sfxPageInfo = document.querySelector<HTMLElement>('#sfxPageInfo');
const packPageInfo = document.querySelector<HTMLElement>('#packPageInfo');
const adminToolsPanel = document.querySelector<HTMLElement>('#adminToolsPanel');
const sfxSearchInput = document.querySelector<HTMLInputElement>('#sfxSearchInput');
const packSearchInput = document.querySelector<HTMLInputElement>('#packSearchInput');

let recentSort = true;
let currentUser: CurrentUser | null = null;
let sfxPage = 1;
let sfxTotalPages = 1;
let packPage = 1;
let packTotalPages = 1;
const frontendActionCooldowns = new Map<string, number>();
let activeAudio: HTMLAudioElement | null = null;
let adminPackOptions: PackItem[] = [];
let packEditorSelectedIds: string[] = [];
let packEditorEditingPackId: string | null = null;
let packEditorSearchResults: SfxItem[] = [];
let packEditorSearchTimer: number | null = null;
const packEditorSfxMeta = new Map<string, SfxItem>();
let sfxSearchQuery = '';
let packSearchQuery = '';
let sfxSearchTimer: number | null = null;
let packSearchTimer: number | null = null;
let sfxEditorEditingId: string | null = null;
let adminDetectedIp: string | null = null;

const toastStack = document.createElement('div');
toastStack.id = 'toastStack';
document.body.appendChild(toastStack);

function isActionAllowed(actionKey: string, cooldownMs: number) {
  const now = Date.now();
  const lastRun = frontendActionCooldowns.get(actionKey) ?? 0;
  if (now - lastRun < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - (now - lastRun)) / 1000);
    setStatus(`Please wait ${remainingSeconds}s before trying that again.`);
    return false;
  }

  frontendActionCooldowns.set(actionKey, now);
  return true;
}

refreshBtn?.addEventListener('click', () => {
  if (!isActionAllowed('refresh', 1000)) return;
  void loadDashboard();
});

toggleRecentBtn?.addEventListener('click', () => {
  if (!isActionAllowed('sort-toggle', 1000)) return;
  recentSort = !recentSort;
  sfxPage = 1;
  packPage = 1;
  toggleRecentBtn.textContent = recentSort ? 'Sort: Recent' : 'Sort: Popular';
  void loadDashboard();
});

sfxPrevBtn?.addEventListener('click', () => {
  if (sfxPage <= 1) return;
  if (!isActionAllowed('sfx-page', 500)) return;
  sfxPage -= 1;
  void loadDashboard();
});

sfxNextBtn?.addEventListener('click', () => {
  if (sfxPage >= sfxTotalPages) return;
  if (!isActionAllowed('sfx-page', 500)) return;
  sfxPage += 1;
  void loadDashboard();
});

packPrevBtn?.addEventListener('click', () => {
  if (packPage <= 1) return;
  if (!isActionAllowed('pack-page', 500)) return;
  packPage -= 1;
  void loadDashboard();
});

packNextBtn?.addEventListener('click', () => {
  if (packPage >= packTotalPages) return;
  if (!isActionAllowed('pack-page', 500)) return;
  packPage += 1;
  void loadDashboard();
});

sfxSearchInput?.addEventListener('input', (event) => {
  const nextValue = (event.target as HTMLInputElement).value.trim();
  if (sfxSearchTimer) {
    window.clearTimeout(sfxSearchTimer);
  }

  sfxSearchTimer = window.setTimeout(() => {
    sfxSearchQuery = nextValue;
    sfxPage = 1;
    void loadDashboard();
  }, 250);
});

packSearchInput?.addEventListener('input', (event) => {
  const nextValue = (event.target as HTMLInputElement).value.trim();
  if (packSearchTimer) {
    window.clearTimeout(packSearchTimer);
  }

  packSearchTimer = window.setTimeout(() => {
    packSearchQuery = nextValue;
    packPage = 1;
    void loadDashboard();
  }, 250);
});

function setStatus(message: string) {
  if (statusText) {
    statusText.textContent = message;
  }
}

function showToast(message: string, tone: 'success' | 'error' | 'info' = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${tone}`;
  toast.textContent = message;
  toastStack.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('toast--leaving');
    window.setTimeout(() => {
      toast.remove();
    }, 240);
  }, 2600);
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatLength(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0.00s';
  }

  return `${seconds.toFixed(2)}s`;
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value: string) {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

function canManage() {
  return currentUser?.role === 'admin';
}

function renderPagination() {
  const isSfxSearching = sfxSearchQuery.length > 0;
  const isPackSearching = packSearchQuery.length > 0;

  if (sfxPageInfo) {
    sfxPageInfo.textContent = isSfxSearching ? `Search (${sfxTotalPages})` : `Page ${sfxPage} / ${sfxTotalPages}`;
  }
  if (packPageInfo) {
    packPageInfo.textContent = isPackSearching ? `Search (${packTotalPages})` : `Page ${packPage} / ${packTotalPages}`;
  }

  if (sfxPrevBtn) {
    sfxPrevBtn.disabled = isSfxSearching || sfxPage <= 1;
  }
  if (sfxNextBtn) {
    sfxNextBtn.disabled = isSfxSearching || sfxPage >= sfxTotalPages;
  }
  if (packPrevBtn) {
    packPrevBtn.disabled = isPackSearching || packPage <= 1;
  }
  if (packNextBtn) {
    packNextBtn.disabled = isPackSearching || packPage >= packTotalPages;
  }
}

function renderAuthPanel() {
  if (!authPanel) return;

  if (!currentUser) {
    authPanel.innerHTML = `
      <div class="auth-card">
        <p class="section-label">Sign in</p>
        <h2>Use GitHub to get in.</h2>
        <p class="meta">Users are created automatically when they log in. Browse is open once you're signed in.</p>
        <div class="auth-actions">
          <button id="githubLoginBtn" type="button">Login with GitHub</button>
        </div>
      </div>
    `;

    document.querySelector<HTMLButtonElement>('#githubLoginBtn')?.addEventListener('click', () => {
      window.location.href = '/auth/github';
    });
    return;
  }

  authPanel.innerHTML = `
    <div class="auth-card auth-card--logged-in">
      <p class="section-label">Signed in</p>
      <h2>${escapeHtml(currentUser.username)}</h2>
      <p class="meta">GitHub: ${escapeHtml(currentUser.githubUsername)} · ${currentUser.role.toUpperCase()}</p>
      <div class="auth-actions">
        <button id="refreshAccountCodeBtn" type="button" class="button--ghost">Refresh Account Code</button>
        <button id="logoutBtn" type="button" class="button--ghost">Logout</button>
      </div>
      <p class="meta">${currentUser.role === 'admin' ? 'Admin tools are enabled.' : 'Read-only access only.'}</p>
    </div>
  `;

  document.querySelector<HTMLButtonElement>('#logoutBtn')?.addEventListener('click', () => {
    void logout();
  });

  document.querySelector<HTMLButtonElement>('#refreshAccountCodeBtn')?.addEventListener('click', async () => {
    if (!window.confirm('Are you sure you want to refresh your account code? This will invalidate the old code and generate a new one.')) return;
    try {
      const res = await fetch('/auth/mod/generate-token', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to refresh code');
      alert('Your account code has been refreshed. You can view the new code on the /verify page.');
    } catch {
      alert('Failed to refresh account code.');
    }
  });
}

async function loadAdminPackOptions() {
  if (!canManage()) {
    adminPackOptions = [];
    return;
  }

  const response = await fetch('/pack');
  if (!response.ok) {
    adminPackOptions = [];
    return;
  }

  const payload = (await response.json()) as { packs?: PackItem[] };
  adminPackOptions = Array.isArray(payload.packs) ? payload.packs : [];
}

function updatePackEditorUiState() {
  const title = document.querySelector<HTMLElement>('#packEditorTitle');
  const submitButton = document.querySelector<HTMLButtonElement>('#savePackBtn');
  const cancelButton = document.querySelector<HTMLButtonElement>('#cancelPackEditBtn');

  if (title) {
    title.textContent = packEditorEditingPackId ? 'Edit Pack' : 'Create Pack';
  }

  if (submitButton) {
    submitButton.textContent = packEditorEditingPackId ? 'Save Pack Changes' : 'Create Pack';
  }

  if (cancelButton) {
    cancelButton.hidden = !packEditorEditingPackId;
  }
}

function updateSfxEditorUiState() {
  const title = document.querySelector<HTMLElement>('#sfxEditorTitle');
  const submitButton = document.querySelector<HTMLButtonElement>('#saveSfxBtn');
  const replaceButton = document.querySelector<HTMLButtonElement>('#replaceSfxFileBtn');
  const cancelButton = document.querySelector<HTMLButtonElement>('#cancelSfxEditBtn');

  if (title) {
    title.textContent = sfxEditorEditingId ? 'Edit SFX' : 'Select SFX To Edit';
  }

  if (submitButton) {
    submitButton.disabled = !sfxEditorEditingId;
    submitButton.textContent = sfxEditorEditingId ? 'Save SFX Changes' : 'Save SFX Changes';
  }

  if (replaceButton) {
    replaceButton.disabled = !sfxEditorEditingId;
  }

  if (cancelButton) {
    cancelButton.hidden = !sfxEditorEditingId;
  }
}

function parseTags(raw: string) {
  return [...new Set(raw.split(/[\n,]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

function beginEditingSfx(item: SfxItem) {
  sfxEditorEditingId = item.id;
  const nameInput = document.querySelector<HTMLInputElement>('#editSfxName');
  const downloadsInput = document.querySelector<HTMLInputElement>('#editSfxDownloads');
  const tagsInput = document.querySelector<HTMLTextAreaElement>('#editSfxTags');
  const fileInput = document.querySelector<HTMLInputElement>('#editSfxFile');
  const idPill = document.querySelector<HTMLElement>('#editSfxIdPill');

  if (nameInput) nameInput.value = item.name;
  if (downloadsInput) downloadsInput.value = String(Math.max(0, item.downloads ?? 0));
  if (tagsInput) tagsInput.value = (item.tags ?? []).join(', ');
  if (fileInput) fileInput.value = '';
  if (idPill) idPill.textContent = item.id;

  updateSfxEditorUiState();
}

function resetSfxEditor() {
  sfxEditorEditingId = null;
  const nameInput = document.querySelector<HTMLInputElement>('#editSfxName');
  const downloadsInput = document.querySelector<HTMLInputElement>('#editSfxDownloads');
  const tagsInput = document.querySelector<HTMLTextAreaElement>('#editSfxTags');
  const fileInput = document.querySelector<HTMLInputElement>('#editSfxFile');
  const idPill = document.querySelector<HTMLElement>('#editSfxIdPill');

  if (nameInput) nameInput.value = '';
  if (downloadsInput) downloadsInput.value = '0';
  if (tagsInput) tagsInput.value = '';
  if (fileInput) fileInput.value = '';
  if (idPill) idPill.textContent = 'No SFX selected';

  updateSfxEditorUiState();
}

function renderPackEditorSelectedList() {
  const container = document.querySelector<HTMLElement>('#packSelectedSfx');
  if (!container) return;

  if (packEditorSelectedIds.length === 0) {
    container.innerHTML = '<p class="empty">No sounds selected yet.</p>';
    return;
  }

  container.innerHTML = packEditorSelectedIds
    .map((id) => {
      const meta = packEditorSfxMeta.get(id);
      const label = meta ? `${meta.name} (${meta.id})` : id;
      return `
        <div class="picker-item picker-item--row">
          <span>${escapeHtml(label)}</span>
          <button type="button" class="button--ghost" data-remove-pack-sfx="${escapeHtml(id)}">Remove</button>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-remove-pack-sfx]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-remove-pack-sfx');
      if (!id) return;
      packEditorSelectedIds = packEditorSelectedIds.filter((value) => value !== id);
      renderPackEditorSelectedList();
      renderPackEditorSearchResults();
    });
  });
}

function renderPackEditorSearchResults() {
  const container = document.querySelector<HTMLElement>('#packSfxSearchResults');
  if (!container) return;

  const availableResults = packEditorSearchResults.filter((item) => !packEditorSelectedIds.includes(item.id));
  if (availableResults.length === 0) {
    container.innerHTML = '<p class="empty">Search by sound name or ID to add items.</p>';
    return;
  }

  container.innerHTML = availableResults
    .map((item) => `
      <button type="button" class="picker-item" data-add-pack-sfx="${escapeHtml(item.id)}">
        <span>${escapeHtml(item.name)}</span>
        <span class="chip">${escapeHtml(item.id)}</span>
      </button>
    `)
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-add-pack-sfx]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-add-pack-sfx');
      if (!id || packEditorSelectedIds.includes(id)) return;
      const matched = packEditorSearchResults.find((item) => item.id === id);
      if (matched) {
        packEditorSfxMeta.set(matched.id, matched);
      }
      packEditorSelectedIds.push(id);
      renderPackEditorSelectedList();
      renderPackEditorSearchResults();
    });
  });
}

async function hydrateSelectedSfxMeta(ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    try {
      const response = await fetch(`/sfx/${encodeURIComponent(id)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { sfx?: SfxItem };
      if (payload.sfx) {
        packEditorSfxMeta.set(payload.sfx.id, payload.sfx);
      }
    } catch {
      // Keep fallback display using ID if a sound cannot be loaded.
    }
  }));
}

async function searchSfxForPackEditor(query: string) {
  const response = await fetch(`/sfx/search?query=${encodeURIComponent(query)}&limit=20`);
  if (!response.ok) {
    packEditorSearchResults = [];
    renderPackEditorSearchResults();
    return;
  }

  const payload = (await response.json()) as { data?: SfxItem[] };
  packEditorSearchResults = Array.isArray(payload.data) ? payload.data : [];
  packEditorSearchResults.forEach((item) => {
    packEditorSfxMeta.set(item.id, item);
  });
  renderPackEditorSearchResults();
}

async function beginEditingPack(packId: string) {
  const nameInput = document.querySelector<HTMLInputElement>('#savePackName');
  const searchInput = document.querySelector<HTMLInputElement>('#packSfxSearch');
  const downloadsInput = document.querySelector<HTMLInputElement>('#savePackDownloads');

  if (!packId) {
    packEditorEditingPackId = null;
    packEditorSelectedIds = [];
    packEditorSfxMeta.clear();
    packEditorSearchResults = [];
    if (nameInput) nameInput.value = '';
    if (searchInput) searchInput.value = '';
    if (downloadsInput) downloadsInput.value = '0';
    updatePackEditorUiState();
    renderPackEditorSelectedList();
    renderPackEditorSearchResults();
    return;
  }

  const matched = adminPackOptions.find((item) => item.id === packId);
  if (!matched) {
    setStatus('Pack not found in editor list.');
    return;
  }

  packEditorEditingPackId = matched.id;
  packEditorSelectedIds = [...matched.ids];
  packEditorSfxMeta.clear();
  packEditorSearchResults = [];
  if (nameInput) nameInput.value = matched.name;
  if (searchInput) searchInput.value = '';
  if (downloadsInput) downloadsInput.value = String(Math.max(0, matched.downloads ?? 0));
  await hydrateSelectedSfxMeta(packEditorSelectedIds);
  updatePackEditorUiState();
  renderPackEditorSelectedList();
  renderPackEditorSearchResults();
}

async function renderAdminTools(force = false) {
  if (!adminToolsPanel) return;

  if (!canManage()) {
    adminToolsPanel.innerHTML = '';
    adminPackOptions = [];
    packEditorSelectedIds = [];
    packEditorEditingPackId = null;
    packEditorSfxMeta.clear();
    return;
  }

  if (!force && adminToolsPanel.querySelector('#uploadSfxForm') && adminToolsPanel.querySelector('#createPackForm')) {
    return;
  }

  await loadAdminPackOptions();

  const packOptionsHtml = adminPackOptions
    .map((pack) => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.name)} (${escapeHtml(pack.id)})</option>`)
    .join('');

  adminToolsPanel.innerHTML = `
    <div class="panel__header">
      <div>
        <p class="section-label">Admin</p>
        <h2>Manage Library</h2>
      </div>
      <span class="pill">Admin only</span>
    </div>

    <div class="admin-macro-row">
      <button id="macroDeleteMissingBtn" type="button" class="button--ghost">Macro: Delete Missing-File SFX</button>
      <button id="macroAutoTagBtn" type="button" class="button--ghost">Macro: Auto Assign Tags</button>
      <button id="macroCalcLengthsBtn" type="button" class="button--ghost">Macro: Calculate Lengths (All Sounds)</button>
      <button id="macroTrimSilenceBtn" type="button" class="button--ghost">Macro: Trim Leading/Trailing Silence</button>
    </div>

    <div class="admin-macro-row">
      <span id="adminIpLabel" class="pill">IP: ${escapeHtml(adminDetectedIp ?? 'Not checked yet')}</span>
      <button id="adminCheckIpBtn" type="button" class="button--ghost">Check My IP</button>
      <button id="adminResetRateLimitsBtn" type="button" class="button--ghost">Reset My Rate Limits</button>
    </div>

    <div class="admin-grid">
      <form id="uploadSfxForm" class="admin-form">
        <h3>Upload SFX</h3>
        <label>
          Name
          <input id="uploadSfxName" name="name" type="text" required />
        </label>
        <label>
          File
          <input id="uploadSfxFile" name="file" type="file" accept=".mp3,.wav,.ogg,.flac" required />
        </label>
        <label class="inline-option">
          <input id="uploadAutoTagOnUpload" name="autoTagOnUpload" type="checkbox" />
          Auto-assign tags on this upload only
        </label>
        <label class="inline-option">
          <input id="uploadCalcLengthOnUpload" name="calculateLengthOnUpload" type="checkbox" checked />
          Calculate length on this upload only
        </label>
        <label class="inline-option">
          <input id="uploadTrimSilenceOnUpload" name="trimSilenceOnUpload" type="checkbox" />
          Trim leading/trailing silence on this upload only
        </label>
        <button type="submit">Upload Sound</button>
      </form>

      <form id="editSfxForm" class="admin-form">
        <h3 id="sfxEditorTitle">Select SFX To Edit</h3>
        <p id="editSfxIdPill" class="pill">No SFX selected</p>
        <label>
          Name
          <input id="editSfxName" name="name" type="text" />
        </label>
        <label>
          Downloads
          <input id="editSfxDownloads" name="downloads" type="number" min="0" step="1" value="0" />
        </label>
        <label>
          Tags (comma or newline separated)
          <textarea id="editSfxTags" name="tags" rows="4" placeholder="long, loud"></textarea>
        </label>
        <label>
          Replace audio file (optional)
          <input id="editSfxFile" name="file" type="file" accept=".mp3,.wav,.ogg,.flac" />
        </label>
        <div class="auth-actions">
          <button id="saveSfxBtn" type="submit" disabled>Save SFX Changes</button>
          <button id="replaceSfxFileBtn" type="button" class="button--ghost" disabled>Replace SFX File</button>
          <button id="cancelSfxEditBtn" type="button" class="button--ghost" hidden>Cancel Edit</button>
        </div>
      </form>

      <form id="createPackForm" class="admin-form">
        <h3 id="packEditorTitle">Create Pack</h3>
        <label>
          Edit existing pack (optional)
          <select id="packEditorSelect">
            <option value="">Create a new pack</option>
            ${packOptionsHtml}
          </select>
        </label>
        <label>
          Pack name
          <input id="savePackName" name="name" type="text" required />
        </label>
        <label>
          Downloads
          <input id="savePackDownloads" name="downloads" type="number" min="0" step="1" value="0" />
        </label>
        <label>
          Search sounds by name or ID
          <input id="packSfxSearch" name="sfxSearch" type="text" placeholder="Type to search sounds" autocomplete="off" />
        </label>
        <div id="packSfxSearchResults" class="picker-list"></div>
        <div>
          <p class="section-label">Selected sounds</p>
          <div id="packSelectedSfx" class="picker-list"></div>
        </div>
        <div class="auth-actions">
          <button id="savePackBtn" type="submit">Create Pack</button>
          <button id="cancelPackEditBtn" type="button" class="button--ghost" hidden>Cancel Edit</button>
        </div>
      </form>
    </div>
  `;

  document.querySelector<HTMLFormElement>('#uploadSfxForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitUploadSfx();
  });

  document.querySelector<HTMLFormElement>('#createPackForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitSavePack();
  });

  document.querySelector<HTMLFormElement>('#editSfxForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitSaveSfx();
  });

  document.querySelector<HTMLSelectElement>('#packEditorSelect')?.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;
    void beginEditingPack(value);
  });

  document.querySelector<HTMLInputElement>('#packSfxSearch')?.addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value.trim();

    if (packEditorSearchTimer) {
      window.clearTimeout(packEditorSearchTimer);
    }

    packEditorSearchTimer = window.setTimeout(() => {
      void searchSfxForPackEditor(query);
    }, 200);
  });

  document.querySelector<HTMLButtonElement>('#cancelPackEditBtn')?.addEventListener('click', () => {
    const selector = document.querySelector<HTMLSelectElement>('#packEditorSelect');
    if (selector) selector.value = '';
    void beginEditingPack('');
  });

  document.querySelector<HTMLButtonElement>('#cancelSfxEditBtn')?.addEventListener('click', () => {
    resetSfxEditor();
  });

  document.querySelector<HTMLButtonElement>('#replaceSfxFileBtn')?.addEventListener('click', () => {
    void submitReplaceSfxFile();
  });

  document.querySelector<HTMLButtonElement>('#macroDeleteMissingBtn')?.addEventListener('click', () => {
    void runMacroDeleteMissingFiles();
  });

  document.querySelector<HTMLButtonElement>('#macroAutoTagBtn')?.addEventListener('click', () => {
    void runMacroAutoAssignTags();
  });

  document.querySelector<HTMLButtonElement>('#macroCalcLengthsBtn')?.addEventListener('click', () => {
    void runMacroCalculateLengths();
  });

  document.querySelector<HTMLButtonElement>('#macroTrimSilenceBtn')?.addEventListener('click', () => {
    void runMacroTrimSilence();
  });

  document.querySelector<HTMLButtonElement>('#adminCheckIpBtn')?.addEventListener('click', () => {
    void loadAdminIp();
  });

  document.querySelector<HTMLButtonElement>('#adminResetRateLimitsBtn')?.addEventListener('click', () => {
    void resetMyRateLimits();
  });

  updatePackEditorUiState();
  renderPackEditorSelectedList();
  renderPackEditorSearchResults();
  updateSfxEditorUiState();
}

function renderSfx(items: SfxItem[]) {
  if (!sfxList) return;

  sfxList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="resource-card">
              <div>
                <div class="resource-card__title-row">
                  <h3>${escapeHtml(item.name)}</h3>
                  <span class="chip">${escapeHtml(item.id.slice(0, 8))}</span>
                </div>
                <p class="resource-card__meta">${formatDate(item.createdAt)} · ${formatLength(item.lengthSeconds)} · ${item.downloads} downloads · ${item.likes} likes</p>
                <p class="resource-card__meta">${escapeHtml(item.url)}</p>
                ${item.tags?.length ? `<p class="resource-card__meta">tags: ${escapeHtml(item.tags.join(', '))}</p>` : ''}
              </div>
              <div class="resource-card__actions">
                <button type="button" class="button button--ghost" data-play-sfx="${escapeHtml(item.id)}">Play</button>
                ${canManage() ? `<button type="button" data-edit-sfx="${escapeHtml(item.id)}">Edit</button>` : ''}
                ${canManage() ? `<button type="button" data-delete-sfx="${escapeHtml(item.id)}">Delete</button>` : ''}
              </div>
            </article>
          `,
        )
        .join('')
    : `<p class="empty">No sounds found on this page.</p>`;

  sfxList.querySelectorAll<HTMLButtonElement>('[data-play-sfx]').forEach((button) => {
    button.addEventListener('click', () => {
      const sfxId = button.getAttribute('data-play-sfx');
      if (!sfxId) return;
      void playSfx(sfxId);
    });
  });

  if (canManage()) {
    sfxList.querySelectorAll<HTMLButtonElement>('[data-edit-sfx]').forEach((button) => {
      button.addEventListener('click', () => {
        const sfxId = button.getAttribute('data-edit-sfx');
        if (!sfxId) return;
        const item = items.find((entry) => entry.id === sfxId);
        if (!item) return;

        beginEditingSfx(item);
        document.querySelector<HTMLElement>('#adminToolsPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    sfxList.querySelectorAll<HTMLButtonElement>('[data-delete-sfx]').forEach((button) => {
      button.addEventListener('click', () => {
        const sfxId = button.getAttribute('data-delete-sfx');
        if (!sfxId) return;
        void deleteSfx(sfxId);
      });
    });
  }
}

function renderPacks(items: PackItem[]) {
  if (!packList) return;

  packList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="resource-card">
              <div>
                <div class="resource-card__title-row">
                  <h3>${escapeHtml(item.name)}</h3>
                  <span class="chip">${item.ids.length} sounds</span>
                </div>
                <p class="resource-card__meta">${formatDate(item.createdAt)} · ${item.downloads} downloads · ${item.likes} likes</p>
                <p class="resource-card__meta">${escapeHtml(item.ids.join(', '))}</p>
              </div>
              <div class="resource-card__actions">
                ${canManage() ? `<button type="button" data-edit-pack="${escapeHtml(item.id)}">Edit</button>` : ''}
                ${canManage() ? `<button type="button" data-delete-pack="${escapeHtml(item.id)}">Delete</button>` : ''}
              </div>
            </article>
          `,
        )
        .join('')
    : `<p class="empty">No packs found on this page.</p>`;

  if (canManage()) {
    packList.querySelectorAll<HTMLButtonElement>('[data-edit-pack]').forEach((button) => {
      button.addEventListener('click', () => {
        const packId = button.getAttribute('data-edit-pack');
        if (!packId) return;

        const selector = document.querySelector<HTMLSelectElement>('#packEditorSelect');
        if (selector) {
          selector.value = packId;
        }

        void beginEditingPack(packId).then(() => {
          document.querySelector<HTMLElement>('#adminToolsPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });

    packList.querySelectorAll<HTMLButtonElement>('[data-delete-pack]').forEach((button) => {
      button.addEventListener('click', () => {
        const packId = button.getAttribute('data-delete-pack');
        if (!packId) return;
        void deletePack(packId);
      });
    });
  }

}

async function loadCurrentUser() {
  const response = await fetch('/auth/me');

  if (!response.ok) {
    currentUser = null;
    renderAuthPanel();
    await renderAdminTools();
    return;
  }

  const payload = (await response.json()) as { user: CurrentUser };
  currentUser = payload.user;
  renderAuthPanel();
  await renderAdminTools();
}

async function loadDashboard() {
  try {
    setStatus('Loading...');

    await loadCurrentUser();

    const sfxFetch = sfxSearchQuery
      ? fetch(`/sfx/search?query=${encodeURIComponent(sfxSearchQuery)}&limit=50`)
      : fetch(`/getTopSFXlist?recent=${recentSort ? 1 : 0}&page=${sfxPage}`);
    const packFetch = packSearchQuery
      ? fetch(`/pack/search?query=${encodeURIComponent(packSearchQuery)}&limit=50`)
      : fetch(`/getTopPacksList?recent=${recentSort ? 1 : 0}&page=${packPage}`);

    const [sfxResponse, packResponse] = await Promise.all([sfxFetch, packFetch]);

    const sfxData = (await sfxResponse.json()) as ListResponse<SfxItem> | { data?: SfxItem[]; error?: string };
    const packData = (await packResponse.json()) as ListResponse<PackItem> | { data?: PackItem[]; error?: string };

    const sfxItems = 'data' in sfxData && Array.isArray(sfxData.data) ? sfxData.data : [];
    const packItems = 'data' in packData && Array.isArray(packData.data) ? packData.data : [];

    renderSfx(sfxItems);
    renderPacks(packItems);

    sfxTotalPages = sfxSearchQuery
      ? 1
      : ('totalPages' in sfxData && sfxData.totalPages > 0 ? sfxData.totalPages : 1);
    packTotalPages = packSearchQuery
      ? 1
      : ('totalPages' in packData && packData.totalPages > 0 ? packData.totalPages : 1);

    if (sfxPage > sfxTotalPages) {
      sfxPage = sfxTotalPages;
    }
    if (packPage > packTotalPages) {
      packPage = packTotalPages;
    }

    renderPagination();

    if (libraryState) {
      libraryState.textContent = currentUser?.role === 'admin' ? 'Admin' : currentUser ? 'Member' : 'Visitor';
    }

    if ('error' in sfxData || 'error' in packData) {
      setStatus('Loaded with empty results or API warnings.');
    } else {
      const sfxMode = sfxSearchQuery ? `sounds search "${sfxSearchQuery}"` : `${recentSort ? 'recent' : 'popular'} sounds`;
      const packMode = packSearchQuery ? `packs search "${packSearchQuery}"` : `${recentSort ? 'recent' : 'popular'} packs`;
      setStatus(`Loaded ${sfxMode} and ${packMode}.`);
    }
  } catch (error) {
    console.error(error);
    setStatus('Failed to load dashboard.');
  }
}

async function deleteSfx(sfxId: string) {
  if (!canManage()) {
    setStatus('You need an admin account for deletes.');
    showToast('You need an admin account for deletes.', 'error');
    return;
  }

  if (!isActionAllowed(`delete-sfx:${sfxId}`, 3000)) {
    return;
  }

  if (!confirm('Delete this SFX permanently?')) {
    showToast('Delete cancelled.', 'info');
    return;
  }

  const response = await fetch(`/sfx/${encodeURIComponent(sfxId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = payload?.error ?? 'Failed to delete SFX.';
    setStatus(message);
    showToast(message, 'error');
    return;
  }

  setStatus('SFX deleted.');
  showToast('SFX deleted.', 'success');
  await loadDashboard();
}

async function deletePack(packId: string) {
  if (!canManage()) {
    setStatus('You need an admin account for deletes.');
    showToast('You need an admin account for deletes.', 'error');
    return;
  }

  if (!isActionAllowed(`delete-pack:${packId}`, 3000)) {
    return;
  }

  if (!confirm('Delete this pack permanently?')) {
    showToast('Delete cancelled.', 'info');
    return;
  }

  const response = await fetch(`/pack/${encodeURIComponent(packId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = payload?.error ?? 'Failed to delete pack.';
    setStatus(message);
    showToast(message, 'error');
    return;
  }

  setStatus('Pack deleted.');
  showToast('Pack deleted.', 'success');
  await loadDashboard();
}

async function playSfx(sfxId: string) {
  if (!isActionAllowed(`play-sfx:${sfxId}`, 1000)) {
    return;
  }

  const response = await fetch(`/sfx/${encodeURIComponent(sfxId)}`);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setStatus(payload?.error ?? 'Failed to load SFX.');
    return;
  }

  const payload = (await response.json()) as { sfx?: SfxItem };
  const sfxUrl = payload.sfx?.url;

  if (!sfxUrl) {
    setStatus('SFX URL is missing.');
    return;
  }

  if (!activeAudio) {
    activeAudio = new Audio();
  }

  activeAudio.pause();
  activeAudio.src = sfxUrl;

  try {
    await activeAudio.play();
    setStatus('Playing sound.');
  } catch {
    setStatus('Unable to play this sound right now.');
  }

  await loadDashboard();
}

async function logout() {
  if (!isActionAllowed('logout', 1500)) {
    return;
  }

  await fetch('/auth/logout', { method: 'POST' });
  currentUser = null;
  renderAuthPanel();
  await renderAdminTools(true);
  await loadDashboard();
}

async function submitUploadSfx() {
  if (!canManage()) {
    setStatus('Only admins can upload SFX.');
    showToast('Only admins can upload SFX.', 'error');
    return;
  }

  if (!isActionAllowed('upload-sfx', 5000)) {
    return;
  }

  const nameInput = document.querySelector<HTMLInputElement>('#uploadSfxName');
  const fileInput = document.querySelector<HTMLInputElement>('#uploadSfxFile');
  const autoTagInput = document.querySelector<HTMLInputElement>('#uploadAutoTagOnUpload');
  const calcLengthInput = document.querySelector<HTMLInputElement>('#uploadCalcLengthOnUpload');
  const trimSilenceInput = document.querySelector<HTMLInputElement>('#uploadTrimSilenceOnUpload');

  const name = nameInput?.value.trim() ?? '';
  const file = fileInput?.files?.[0];

  if (!name || !file) {
    setStatus('SFX upload requires a name and file.');
    showToast('SFX upload requires a name and file.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);
  formData.append('autoTagOnUpload', autoTagInput?.checked ? '1' : '0');
  formData.append('calculateLengthOnUpload', calcLengthInput?.checked ? '1' : '0');
  formData.append('trimSilenceOnUpload', trimSilenceInput?.checked ? '1' : '0');

  const response = await fetch('/uploadSFX', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    macroWarnings?: string[];
    macrosApplied?: {
      autoTagOnUpload?: boolean;
      calculateLengthOnUpload?: boolean;
      trimSilenceOnUpload?: boolean;
    };
  } | null;

  if (!response.ok) {
    const message = payload?.error ?? 'Failed to upload SFX.';
    setStatus(message);
    showToast(message, 'error');
    return;
  }

  setStatus('SFX uploaded successfully.');
  showToast('SFX uploaded successfully.', 'success');
  if (payload?.macrosApplied?.autoTagOnUpload || payload?.macrosApplied?.calculateLengthOnUpload || payload?.macrosApplied?.trimSilenceOnUpload) {
    showToast(
      `Upload macros applied: tags=${payload?.macrosApplied?.autoTagOnUpload ? 'yes' : 'no'}, length=${payload?.macrosApplied?.calculateLengthOnUpload ? 'yes' : 'no'}, trim=${payload?.macrosApplied?.trimSilenceOnUpload ? 'yes' : 'no'}`,
      'info',
    );
  }
  if (Array.isArray(payload?.macroWarnings) && payload?.macroWarnings.length > 0) {
    showToast(`Upload macro warnings: ${payload.macroWarnings.join('; ')}`, 'error');
  }
  if (nameInput) nameInput.value = '';
  if (fileInput) fileInput.value = '';
  sfxPage = 1;
  await loadDashboard();
}

async function submitSavePack() {
  if (!canManage()) {
    setStatus('Only admins can manage packs.');
    showToast('Only admins can manage packs.', 'error');
    return;
  }

  if (!isActionAllowed('create-pack', 5000)) {
    return;
  }

  const nameInput = document.querySelector<HTMLInputElement>('#savePackName');
  const selector = document.querySelector<HTMLSelectElement>('#packEditorSelect');
  const downloadsInput = document.querySelector<HTMLInputElement>('#savePackDownloads');

  const name = nameInput?.value.trim() ?? '';
  const ids = [...new Set(packEditorSelectedIds.map((entry) => entry.trim()).filter(Boolean))];
  const downloads = Number.isFinite(Number(downloadsInput?.value))
    ? Math.max(0, Math.floor(Number(downloadsInput?.value)))
    : 0;

  if (!name || ids.length === 0) {
    setStatus('Pack requires a name and at least one selected sound.');
    showToast('Pack requires a name and at least one selected sound.', 'error');
    return;
  }

  const isEditing = Boolean(packEditorEditingPackId);
  const endpoint = isEditing
    ? `/pack/${encodeURIComponent(packEditorEditingPackId as string)}`
    : '/uploadPack';
  const method = isEditing ? 'PUT' : 'POST';

  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, ids, downloads }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = payload?.error ?? `Failed to ${isEditing ? 'save' : 'create'} pack.`;
    setStatus(message);
    showToast(message, 'error');
    return;
  }

  setStatus(`Pack ${isEditing ? 'updated' : 'created'} successfully.`);
  showToast(`Pack ${isEditing ? 'updated' : 'created'} successfully.`, 'success');
  if (nameInput) nameInput.value = '';
  if (selector) selector.value = '';
  if (downloadsInput) downloadsInput.value = '0';
  packEditorEditingPackId = null;
  packEditorSelectedIds = [];
  packEditorSearchResults = [];
  packEditorSfxMeta.clear();
  packPage = 1;
  await renderAdminTools(true);
  await loadDashboard();
}

async function submitSaveSfx() {
  if (!canManage()) {
    setStatus('Only admins can edit SFX.');
    showToast('Only admins can edit SFX.', 'error');
    return;
  }

  if (!sfxEditorEditingId) {
    setStatus('Choose a sound from the list first.');
    showToast('Choose a sound from the list first.', 'error');
    return;
  }

  const nameInput = document.querySelector<HTMLInputElement>('#editSfxName');
  const downloadsInput = document.querySelector<HTMLInputElement>('#editSfxDownloads');
  const tagsInput = document.querySelector<HTMLTextAreaElement>('#editSfxTags');

  const name = nameInput?.value.trim() ?? '';
  const downloads = Number.isFinite(Number(downloadsInput?.value))
    ? Math.max(0, Math.floor(Number(downloadsInput?.value)))
    : 0;
  const tags = parseTags(tagsInput?.value ?? '');

  if (!name) {
    setStatus('SFX name is required.');
    showToast('SFX name is required.', 'error');
    return;
  }

  const response = await fetch(`/sfx/${encodeURIComponent(sfxEditorEditingId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, downloads, tags }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = payload?.error ?? 'Failed to update SFX.';
    setStatus(message);
    showToast(message, 'error');
    return;
  }

  setStatus('SFX updated successfully.');
  showToast('SFX updated successfully.', 'success');
  await loadDashboard();
}

async function submitReplaceSfxFile() {
  if (!canManage()) {
    setStatus('Only admins can replace SFX files.');
    showToast('Only admins can replace SFX files.', 'error');
    return;
  }

  if (!sfxEditorEditingId) {
    setStatus('Choose a sound from the list first.');
    showToast('Choose a sound from the list first.', 'error');
    return;
  }

  if (!isActionAllowed(`replace-sfx-file:${sfxEditorEditingId}`, 4000)) {
    return;
  }

  const fileInput = document.querySelector<HTMLInputElement>('#editSfxFile');
  const file = fileInput?.files?.[0];

  if (!file) {
    setStatus('Choose a replacement audio file first.');
    showToast('Choose a replacement audio file first.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/sfx/${encodeURIComponent(sfxEditorEditingId)}/replace-file`, {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    const message = payload?.error ?? 'Failed to replace SFX file.';
    setStatus(message);
    showToast(message, 'error');
    return;
  }

  if (fileInput) {
    fileInput.value = '';
  }

  setStatus('SFX file replaced successfully.');
  showToast('SFX file replaced successfully.', 'success');
  await loadDashboard();
}

async function runMacroDeleteMissingFiles() {
  if (!canManage()) {
    showToast('Only admins can run macros.', 'error');
    return;
  }

  const response = await fetch('/sfx/admin/macros/delete-missing-files', {
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    removedCount?: number;
    remainingCount?: number;
    error?: string;
  } | null;

  if (!response.ok) {
    showToast(payload?.error ?? 'Missing-file macro failed.', 'error');
    return;
  }

  showToast(
    `${payload?.message ?? 'Cleanup complete.'} Removed ${payload?.removedCount ?? 0} SFX, ${payload?.remainingCount ?? 0} remaining.`,
    'success',
  );
  await loadDashboard();
}

async function runMacroAutoAssignTags() {
  if (!canManage()) {
    showToast('Only admins can run macros.', 'error');
    return;
  }

  const response = await fetch('/sfx/admin/macros/auto-assign-tags', {
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    updatedCount?: number;
    longCount?: number;
    loudCount?: number;
    failedCount?: number;
    error?: string;
  } | null;

  if (!response.ok) {
    showToast(payload?.error ?? 'Auto-tag macro failed.', 'error');
    return;
  }

  showToast(
    `${payload?.message ?? 'Auto-tag complete.'} Updated ${payload?.updatedCount ?? 0}, long=${payload?.longCount ?? 0}, loud=${payload?.loudCount ?? 0}, failed=${payload?.failedCount ?? 0}.`,
    'success',
  );
  await loadDashboard();
}

async function runMacroCalculateLengths() {
  if (!canManage()) {
    showToast('Only admins can run macros.', 'error');
    return;
  }

  const response = await fetch('/sfx/admin/macros/calculate-lengths', {
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    updatedCount?: number;
    failedCount?: number;
    error?: string;
  } | null;

  if (!response.ok) {
    showToast(payload?.error ?? 'Length macro failed.', 'error');
    return;
  }

  showToast(
    `${payload?.message ?? 'Length macro complete.'} Updated ${payload?.updatedCount ?? 0}, failed=${payload?.failedCount ?? 0}.`,
    'success',
  );
  await loadDashboard();
}

async function runMacroTrimSilence() {
  if (!canManage()) {
    showToast('Only admins can run macros.', 'error');
    return;
  }

  const response = await fetch('/sfx/admin/macros/trim-silence', {
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    processedCount?: number;
    lengthUpdatedCount?: number;
    failedCount?: number;
    error?: string;
  } | null;

  if (!response.ok) {
    showToast(payload?.error ?? 'Trim-silence macro failed.', 'error');
    return;
  }

  showToast(
    `${payload?.message ?? 'Trim macro complete.'} Processed ${payload?.processedCount ?? 0}, length-updated=${payload?.lengthUpdatedCount ?? 0}, failed=${payload?.failedCount ?? 0}.`,
    'success',
  );
  await loadDashboard();
}

function updateAdminIpLabel(ip: string | null) {
  const label = document.querySelector<HTMLElement>('#adminIpLabel');
  if (!label) return;
  label.textContent = `IP: ${ip ?? 'Not checked yet'}`;
}

async function loadAdminIp() {
  if (!canManage()) {
    showToast('Only admins can check IP.', 'error');
    return;
  }

  if (!isActionAllowed('admin-check-ip', 1000)) {
    return;
  }

  const response = await fetch('/auth/admin/network');
  const payload = (await response.json().catch(() => null)) as { ip?: string; error?: string } | null;

  if (!response.ok) {
    showToast(payload?.error ?? 'Failed to check IP.', 'error');
    return;
  }

  adminDetectedIp = payload?.ip?.trim() || 'Unknown';
  updateAdminIpLabel(adminDetectedIp);
  setStatus(`Detected IP: ${adminDetectedIp}`);
  showToast(`Detected IP: ${adminDetectedIp}`, 'info');
}

async function resetMyRateLimits() {
  if (!canManage()) {
    showToast('Only admins can reset rate limits.', 'error');
    return;
  }

  if (!isActionAllowed('admin-reset-ratelimit', 1500)) {
    return;
  }

  const response = await fetch('/auth/admin/network/reset-rate-limit', {
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as { message?: string; ip?: string; error?: string } | null;

  if (!response.ok) {
    showToast(payload?.error ?? 'Failed to reset rate limits.', 'error');
    return;
  }

  adminDetectedIp = payload?.ip?.trim() || adminDetectedIp || 'Unknown';
  updateAdminIpLabel(adminDetectedIp);
  const message = payload?.message ?? 'Rate limits reset.';
  setStatus(`${message} (${adminDetectedIp})`);
  showToast(`${message} (${adminDetectedIp})`, 'success');
}

renderPagination();
void loadDashboard();