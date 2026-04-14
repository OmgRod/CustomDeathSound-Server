import { Router, Request, Response } from 'express';
import https from 'https';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { createSignedSessionToken, parseCookieHeader, serializeCookie, verifySignedSessionToken } from '../utils/session';
import { upsertGithubUser } from '../utils/userAccounts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth';
import { usersDB } from '../db';
import { resolveClientIp, clearRateLimitForRequest } from '../utils/rateLimiter';

const router = Router();
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

type GitHubProfile = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string;
};

function getBaseUrl(req: Request) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function requestJson<T>(url: string, options: https.RequestOptions = {}, body?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers: options.headers,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(raw || `Request failed with status ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(raw) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const clientId = process.env['GITHUB_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth is not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  }).toString();

  const response = await requestJson<{ access_token?: string; error?: string }>(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'CustomDeathSounds-Server',
      },
    },
    body,
  );

  if (!response.access_token) {
    throw new Error(response.error || 'Unable to exchange OAuth code');
  }

  return response.access_token;
}

async function fetchGithubProfile(accessToken: string) {
  return requestJson<GitHubProfile>('https://api.github.com/user', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'CustomDeathSounds-Server',
    },
  });
}

async function fetchGithubProfileById(githubId: string) {
  return requestJson<GitHubProfile>(`https://api.github.com/user/${encodeURIComponent(githubId)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CustomDeathSounds-Server',
    },
  });
}

function setCookieHeaders(name: string, value: string, maxAgeSeconds: number) {
  return serializeCookie(name, value, {
    httpOnly: true,
    maxAge: maxAgeSeconds,
    path: '/',
    sameSite: 'Lax',
  });
}

router.post('/mod/generate-token', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  // TypeScript: requireAuth guarantees req.user is set
  const user = req.user!;
  await usersDB.read();
  if (!usersDB.data) usersDB.data = { users: [] };
  let dbUser = usersDB.data.users.find(u => u.githubId === user.githubId);
  if (!dbUser) {
    dbUser = { githubId: user.githubId, role: 'user' };
    usersDB.data.users.push(dbUser);
  }
  // Only generate a new modVerificationCode if one does not exist
  if (!(dbUser as any).modVerificationCode) {
    (dbUser as any).modVerificationCode = crypto.randomBytes(24).toString('hex');
    await usersDB.write();
  }
  res.json({ token: (dbUser as any).modVerificationCode });
}));



router.get('/github', asyncHandler(async (req: Request, res: Response) => {
  const clientId = process.env['GITHUB_CLIENT_ID'];
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub login is not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectParam = typeof req.query.redirect === 'string' ? req.query.redirect : '';
  const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'read:user');
  authorizeUrl.searchParams.set('state', state);

  // Store intended redirect in a cookie
  res.setHeader('Set-Cookie', [
    setCookieHeaders('cds_oauth_state', state, OAUTH_STATE_MAX_AGE_SECONDS),
    redirectParam ? setCookieHeaders('cds_oauth_redirect', redirectParam, OAUTH_STATE_MAX_AGE_SECONDS) : ''
  ].filter(Boolean));
  res.redirect(authorizeUrl.toString());
}));

router.get('/github/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookies = parseCookieHeader(req.headers.cookie);
  const expectedState = cookies['cds_oauth_state'];
  const redirectAfter = cookies['cds_oauth_redirect'] || '/';

  if (typeof code !== 'string' || typeof state !== 'string' || !expectedState || state !== expectedState) {
    return res.status(400).send('Invalid GitHub login response');
  }

  const redirectUri = `${getBaseUrl(req)}/auth/github/callback`;
  const accessToken = await exchangeCodeForToken(code, redirectUri);
  const profile = await fetchGithubProfile(accessToken);
  const user = await upsertGithubUser({
    githubId: String(profile.id),
    githubUsername: profile.login,
  });

  const sessionSecret = process.env['SESSION_SECRET'] || 'dev-session-secret';
  const sessionToken = createSignedSessionToken({
    userId: user.githubId,
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  }, sessionSecret);

  res.setHeader('Set-Cookie', [
    setCookieHeaders('cds_session', sessionToken, SESSION_MAX_AGE_SECONDS),
    serializeCookie('cds_oauth_state', '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'Lax' }),
    serializeCookie('cds_oauth_redirect', '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'Lax' }),
  ]);

  res.redirect(redirectAfter);
}));

router.get('/me', asyncHandler(async (req: AuthRequest, res: Response) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sessionToken = cookies['cds_session'];
  const sessionSecret = process.env['SESSION_SECRET'] || 'dev-session-secret';
  const session = verifySignedSessionToken(sessionToken, sessionSecret);

  if (!session) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  await usersDB.read();
  const user = usersDB.data?.users.find((item) => item.githubId === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  let profile: GitHubProfile | null = null;
  try {
    profile = await fetchGithubProfileById(user.githubId);
  } catch {
    profile = null;
  }

  const githubUsername = profile?.login || user.githubId;
  const username = (profile?.name || githubUsername).trim();

  return res.status(200).json({
    user: {
      id: user.githubId,
      githubId: user.githubId,
      username,
      githubUsername,
      avatarUrl: profile?.avatar_url || null,
      role: user.role,
    },
  });
}));

router.post('/logout', asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', [
    serializeCookie('cds_session', '', { httpOnly: true, maxAge: 0, path: '/', sameSite: 'Lax' }),
  ]);
  res.status(200).json({ message: 'Logged out' });
}));

router.get('/admin/network', requireAuth, requireRole(['admin']), asyncHandler(async (req: AuthRequest, res: Response) => {
  const ip = resolveClientIp(req);
  return res.status(200).json({ ip });
}));


router.post('/admin/network/reset-rate-limit', requireAuth, requireRole(['admin']), asyncHandler(async (req: AuthRequest, res: Response) => {
  const ip = resolveClientIp(req);
  clearRateLimitForRequest(req);
  return res.status(200).json({ message: 'Rate limit reset for this IP.', ip });
}));

export default router;