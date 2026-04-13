
import './styles.css';

function injectVerifyStyles() {
  if (document.getElementById('verify-styles')) return;
  const style = document.createElement('style');
  style.id = 'verify-styles';
  style.textContent = `
    .verify-shell {
      max-width: 480px;
      margin: 60px auto 0 auto;
      background: #181a20;
      border-radius: 12px;
      box-shadow: 0 2px 16px #0008;
      padding: 2.5rem 2rem 2rem 2rem;
      color: #fff;
      font-family: 'Segoe UI', 'Arial', sans-serif;
    }
    .verify-shell h2 {
      font-size: 2rem;
      margin-bottom: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      text-shadow: 0 2px 8px #000a;
    }
    .verify-shell p {
      margin: 0.5rem 0 1.2rem 0;
      font-size: 1.1rem;
      color: #e0e0e0;
    }
    .verify-code-box {
      background: #23263a;
      color: #00eaff;
      font-family: 'JetBrains Mono', 'Fira Mono', 'Consolas', monospace;
      font-size: 1.15rem;
      padding: 1.1rem 1.2rem;
      border-radius: 8px;
      margin: 0.5rem 0 1.2rem 0;
      word-break: break-all;
      cursor: pointer;
      border: 2px solid #00eaff44;
      transition: background 0.15s, border 0.15s;
      user-select: all;
      text-align: center;
      position: relative;
    }
    .verify-code-box.copied {
      background: #1e2e1e;
      color: #7fff7f;
      border-color: #7fff7f99;
    }
    .verify-copy-hint {
      font-size: 0.95rem;
      color: #aaa;
      margin-bottom: 0.5rem;
      text-align: center;
    }
    .verify-shell small {
      color: #888;
      font-size: 0.95rem;
    }
    .verify-shell button {
      background: #00eaff;
      color: #181a20;
      border: none;
      border-radius: 6px;
      padding: 0.7rem 1.3rem;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 1.2rem;
      transition: background 0.15s;
    }
    .verify-shell button:hover {
      background: #00b3c6;
    }
  `;
  document.head.appendChild(style);
}

// This file is for the /verify page used by the mod authentication flow

async function renderVerifyPage() {

  injectVerifyStyles();
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

  // Logged in, request a verification code
  content.textContent = 'Generating verification code...';
  try {
    const res = await fetch('/auth/mod/generate-token', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to get code');
    const data = await res.json();
    content.innerHTML = `
      <div class="verify-copy-hint">Click the code to copy it to your clipboard</div>
      <div class="verify-code-box" id="verifyCodeBox">${data.token}</div>
      <p>Click the code above to copy it and paste it in GD.</p>
      <p><small>This code is valid until you decide to refresh it in the homepage. Do not share this code with anyone else.</small></p>
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
    content.textContent = 'Failed to generate verification code.';
  }
}

renderVerifyPage();
