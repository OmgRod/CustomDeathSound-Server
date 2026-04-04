import './styles.css';

type SfxItem = {
  id: string;
  name: string;
  url: string;
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
  username: string;
  githubUsername: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: number;
  lastLoginAt: number;
  loginCount: number;
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

let recentSort = true;
let currentUser: CurrentUser | null = null;
let sfxPage = 1;
let sfxTotalPages = 1;
let packPage = 1;
let packTotalPages = 1;
const frontendActionCooldowns = new Map<string, number>();
let activeAudio: HTMLAudioElement | null = null;

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

function setStatus(message: string) {
  if (statusText) {
    statusText.textContent = message;
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
  if (sfxPageInfo) {
    sfxPageInfo.textContent = `Page ${sfxPage} / ${sfxTotalPages}`;
  }
  if (packPageInfo) {
    packPageInfo.textContent = `Page ${packPage} / ${packTotalPages}`;
  }

  if (sfxPrevBtn) {
    sfxPrevBtn.disabled = sfxPage <= 1;
  }
  if (sfxNextBtn) {
    sfxNextBtn.disabled = sfxPage >= sfxTotalPages;
  }
  if (packPrevBtn) {
    packPrevBtn.disabled = packPage <= 1;
  }
  if (packNextBtn) {
    packNextBtn.disabled = packPage >= packTotalPages;
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
        <p class="meta">Set admin users by editing their <code>role</code> in <code>db/users.json</code>.</p>
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
      <p class="meta">Logins: ${currentUser.loginCount} · Last seen: ${formatDateTime(currentUser.lastLoginAt)}</p>
      <div class="auth-actions">
        <button id="logoutBtn" type="button" class="button--ghost">Logout</button>
      </div>
      <p class="meta">${currentUser.role === 'admin' ? 'Admin tools are enabled.' : 'Read-only access only.'}</p>
    </div>
  `;

  document.querySelector<HTMLButtonElement>('#logoutBtn')?.addEventListener('click', () => {
    void logout();
  });
}

function renderAdminTools() {
  if (!adminToolsPanel) return;

  if (!canManage()) {
    adminToolsPanel.innerHTML = '';
    return;
  }

  adminToolsPanel.innerHTML = `
    <div class="panel__header">
      <div>
        <p class="section-label">Admin</p>
        <h2>Manage Library</h2>
      </div>
      <span class="pill">Admin only</span>
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
        <button type="submit">Upload Sound</button>
      </form>

      <form id="createPackForm" class="admin-form">
        <h3>Create Pack</h3>
        <label>
          Pack name
          <input id="createPackName" name="name" type="text" required />
        </label>
        <label>
          SFX IDs (comma or newline separated)
          <textarea id="createPackIds" name="ids" rows="5" placeholder="id-1, id-2"></textarea>
        </label>
        <button type="submit">Create Pack</button>
      </form>
    </div>
  `;

  document.querySelector<HTMLFormElement>('#uploadSfxForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitUploadSfx();
  });

  document.querySelector<HTMLFormElement>('#createPackForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitCreatePack();
  });
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
                <p class="resource-card__meta">${formatDate(item.createdAt)} · ${item.downloads} downloads · ${item.likes} likes</p>
                <p class="resource-card__meta">${escapeHtml(item.url)}</p>
              </div>
              <div class="resource-card__actions">
                <button type="button" class="button button--ghost" data-play-sfx="${escapeHtml(item.id)}">Play</button>
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
                ${canManage() ? `<button type="button" data-delete-pack="${escapeHtml(item.id)}">Delete</button>` : ''}
              </div>
            </article>
          `,
        )
        .join('')
    : `<p class="empty">No packs found on this page.</p>`;

  if (canManage()) {
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
    return;
  }

  const payload = (await response.json()) as { user: CurrentUser };
  currentUser = payload.user;
  renderAuthPanel();
  renderAdminTools();
}

async function loadDashboard() {
  try {
    setStatus('Loading...');

    await loadCurrentUser();
    renderAdminTools();

    const [sfxResponse, packResponse] = await Promise.all([
      fetch(`/getTopSFXlist?recent=${recentSort ? 1 : 0}&page=${sfxPage}`),
      fetch(`/getTopPacksList?recent=${recentSort ? 1 : 0}&page=${packPage}`),
    ]);

    const sfxData = (await sfxResponse.json()) as ListResponse<SfxItem> | { error?: string };
    const packData = (await packResponse.json()) as ListResponse<PackItem> | { error?: string };

    renderSfx('data' in sfxData ? sfxData.data : []);
    renderPacks('data' in packData ? packData.data : []);

    sfxTotalPages = 'totalPages' in sfxData && sfxData.totalPages > 0 ? sfxData.totalPages : 1;
    packTotalPages = 'totalPages' in packData && packData.totalPages > 0 ? packData.totalPages : 1;

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
      setStatus(`Loaded page 1 in ${recentSort ? 'recent' : 'popular'} mode.`);
    }
  } catch (error) {
    console.error(error);
    setStatus('Failed to load dashboard.');
  }
}

async function deleteSfx(sfxId: string) {
  if (!canManage()) {
    setStatus('You need an admin account for deletes.');
    return;
  }

  if (!isActionAllowed(`delete-sfx:${sfxId}`, 3000)) {
    return;
  }

  if (!confirm('Delete this SFX permanently?')) {
    return;
  }

  const response = await fetch(`/sfx/${encodeURIComponent(sfxId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setStatus(payload?.error ?? 'Failed to delete SFX.');
    return;
  }

  setStatus('SFX deleted.');
  await loadDashboard();
}

async function deletePack(packId: string) {
  if (!canManage()) {
    setStatus('You need an admin account for deletes.');
    return;
  }

  if (!isActionAllowed(`delete-pack:${packId}`, 3000)) {
    return;
  }

  if (!confirm('Delete this pack permanently?')) {
    return;
  }

  const response = await fetch(`/pack/${encodeURIComponent(packId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setStatus(payload?.error ?? 'Failed to delete pack.');
    return;
  }

  setStatus('Pack deleted.');
  await loadDashboard();
}

async function playSfx(sfxId: string) {
  if (!isActionAllowed(`play-sfx:${sfxId}`, 1000)) {
    return;
  }

  const response = await fetch(`/sfx/${encodeURIComponent(sfxId)}/download`);

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
  renderAdminTools();
  await loadDashboard();
}

function parseIds(raw: string) {
  return [...new Set(raw.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))];
}

async function submitUploadSfx() {
  if (!canManage()) {
    setStatus('Only admins can upload SFX.');
    return;
  }

  if (!isActionAllowed('upload-sfx', 5000)) {
    return;
  }

  const nameInput = document.querySelector<HTMLInputElement>('#uploadSfxName');
  const fileInput = document.querySelector<HTMLInputElement>('#uploadSfxFile');

  const name = nameInput?.value.trim() ?? '';
  const file = fileInput?.files?.[0];

  if (!name || !file) {
    setStatus('SFX upload requires a name and file.');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);

  const response = await fetch('/uploadSFX', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setStatus(payload?.error ?? 'Failed to upload SFX.');
    return;
  }

  setStatus('SFX uploaded successfully.');
  if (nameInput) nameInput.value = '';
  if (fileInput) fileInput.value = '';
  sfxPage = 1;
  await loadDashboard();
}

async function submitCreatePack() {
  if (!canManage()) {
    setStatus('Only admins can create packs.');
    return;
  }

  if (!isActionAllowed('create-pack', 5000)) {
    return;
  }

  const nameInput = document.querySelector<HTMLInputElement>('#createPackName');
  const idsInput = document.querySelector<HTMLTextAreaElement>('#createPackIds');

  const name = nameInput?.value.trim() ?? '';
  const ids = parseIds(idsInput?.value ?? '');

  if (!name || ids.length === 0) {
    setStatus('Pack creation requires a name and at least one SFX ID.');
    return;
  }

  const response = await fetch('/uploadPack', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, ids }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setStatus(payload?.error ?? 'Failed to create pack.');
    return;
  }

  setStatus('Pack created successfully.');
  if (nameInput) nameInput.value = '';
  if (idsInput) idsInput.value = '';
  packPage = 1;
  await loadDashboard();
}

renderPagination();
void loadDashboard();