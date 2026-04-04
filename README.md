# Custom Death Sound Server

Server for managing custom death sound effects with GitHub login and a Vite-based frontend served from the same port.

## Features

- Upload and manage sound effects (SFX) and sound packs
- Role-based access control through GitHub login
- Automatic user creation on first GitHub login
- Minimal user storage (`githubId` + `role`), with profile data fetched from GitHub API when needed
- Rate limiting and file size restrictions
- Profanity filtering

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `example.env` to `.env` and configure:
```bash
cp example.env .env
```

3. Set up GitHub OAuth in `.env`:
```
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
SESSION_SECRET=long-random-secret
```

4. Start the server once and log in with GitHub.

5. Promote admins by editing [db/users.json](db/users.json) and setting `role` to `admin` for the desired users.

	`db/users.json` stores only:
	- `githubId`
	- `role`

6. Start the server:
```bash
npm start
```

7. Build the frontend for production if needed:
```bash
npm run build
```

## One-Command Run

Development (backend + frontend on same port, no separate frontend server):
```bash
npm run dev
```

Production (compile backend and frontend, then run compiled server):
```bash
npm run prod
```

## Production Build

Compile backend + frontend:
```bash
npm run build:prod
```

Run compiled server:
```bash
npm run start:prod
```

Security hardening in production and development:

- Requests to sensitive paths such as `/.env`, `/db/*`, `/src/*`, `/scripts/*`, and `/.git/*` are denied.
- Static file serving uses dotfile denial.
- Vite dev middleware is configured with filesystem restrictions.

## Authentication

All upload and delete operations require a GitHub login. The frontend uses the same session cookie as the backend routes.

### User Roles

- **Admin**: Full access, can upload SFX/packs and delete them
- **User**: Read-only access

### GitHub Login

Use `GET /auth/github` to start the login flow. The callback is `GET /auth/github/callback`. The current session is available from `GET /auth/me`.

## API Endpoints

### Upload SFX (Admin Only)
```bash
POST /uploadSFX
Body: multipart/form-data with 'file' and 'name' fields
```

### Upload Pack (Admin Only)
```bash
POST /uploadPack
Body: {"name": "pack name", "ids": ["sfx-id-1", "sfx-id-2"]}
```

### Update Pack (Admin Only)
```bash
PUT /pack/:packID
Body: {"name": "pack name", "ids": ["sfx-id-1", "sfx-id-2"]}
```

### List Packs For Editor (Admin Only)
```bash
GET /pack
```

### Search SFX (Public)
```bash
GET /sfx?query=searchTerm&limit=20
```

### Get SFX (Public)
```bash
GET /sfx/:sfxID
```

### Record SFX Download (Public)
```bash
GET /sfx/:sfxID/download
```

### Verify SFX File Exists (Admin Only)
```bash
GET /sfx/:sfxID/file-status
```

Returns whether the backing file currently exists in `public/sounds`.

### Get Pack (Public)
```bash
GET /pack/:packID
```

### Delete SFX (Admin Only)
```bash
DELETE /sfx/:sfxID
```

Response includes `fileDeleted` to indicate whether the sound file was physically removed from `public/sounds`.

### Delete Pack (Admin Only)
```bash
DELETE /pack/:packID
```

## Frontend

The homepage is now a Vite app. In development, it is served through the Express process on the same port as the API. In production, build the frontend with `npm run build` and start the server normally.

### List Users (Admin Only)
```bash
GET /users
```

### Delete User (Admin Only)
```bash
DELETE /users/:userId
```

