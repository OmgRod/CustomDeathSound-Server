
import './styles.css';

async function renderVerifyPage() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = `<div class="verify-shell"><h2>Account Token</h2><div id="verify-content">Loading...</div></div>`;

  // Check if user is logged in
  let user: any = null;
  try {
    const res = await fetch('/auth/me');
    if (res.ok) {
      const data = await res.json();
      user = data.user;
    }
  } catch {}

  const content = document.getElementById('verify-content');
  if (!content) return;

  if (!user) {
    // Not logged in, show login button
    content.innerHTML = `
      <p>You must log in with GitHub to verify your mod.</p>
      <button id="githubLoginBtn" type="button">Login with GitHub</button>
    `;
    document.getElementById('githubLoginBtn')?.addEventListener('click', () => {
      window.location.href = '/auth/github?redirect=/verify';
    });
    return;
  }

  // Logged in, request the current account token (does not generate a new one)
  content.textContent = 'Loading account token...';
  try {
    const res = await fetch('/auth/mod/token');
    if (!res.ok) throw new Error('Failed to get token');
    const data = await res.json();
    if (!data.token) throw new Error('No token found');
    content.innerHTML = `
      <div class="verify-copy-hint">Click the token to copy it to your clipboard</div>
      <div class="verify-code-box" id="verifyCodeBox">${data.token}</div>
      <p>Click the token above to copy it and paste it in GD.</p>
      <p><small>This token is valid until you decide to refresh it in the homepage. Do not share this token with anyone else.</small></p>
    `;
    const codeBox = document.getElementById('verifyCodeBox');
    if (codeBox) {
      codeBox.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(data.token);
          codeBox.classList.add('copied');
          codeBox.textContent = 'Copied!';
          setTimeout(() => {
            codeBox.classList.remove('copied');
            codeBox.textContent = data.token;
          }, 1200);
        } catch {
          codeBox.textContent = 'Failed to copy';
        }
      });
    }
  } catch {
    content.textContent = 'Failed to load account token.';
  }
}

renderVerifyPage();
