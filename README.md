# Custom Death Sound Server

Server for managing custom death sound effects with authentication.

## Features

- Upload and manage sound effects (SFX) and sound packs
- Role-based access control (Admin, Moderator, User)
- API key authentication
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

3. Set the `INITIAL_ADMIN_API_KEY` in your `.env` file to create an admin account on first startup:
```
INITIAL_ADMIN_API_KEY=your-secure-api-key-here
```

4. Start the server:
```bash
npm start
```

## Authentication

All upload operations require authentication using an API key. Include the API key in the `x-api-key` header of your requests.

### User Roles

- **Admin**: Full access, can create/delete users and upload SFX/packs
- **Moderator**: Can upload SFX and packs
- **User**: Read-only access

### Creating Users (Admin Only)

Create a new user with API key:
```bash
curl -X POST http://localhost:3000/users \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"username": "moderator1", "role": "moderator"}'
```

Response includes the generated API key - save it securely.

## API Endpoints

### Upload SFX (Moderator/Admin Only)
```bash
POST /uploadSFX
Headers: x-api-key: YOUR_API_KEY
Body: multipart/form-data with 'file' and 'name' fields
```

### Upload Pack (Moderator/Admin Only)
```bash
POST /uploadPack
Headers: x-api-key: YOUR_API_KEY
Body: {"name": "pack name", "ids": ["sfx-id-1", "sfx-id-2"]}
```

### Get SFX (Public)
```bash
GET /sfx/:sfxID
```

### Get Pack (Public)
```bash
GET /pack/:packID
```

### List Users (Admin Only)
```bash
GET /users
Headers: x-api-key: YOUR_ADMIN_API_KEY
```

### Delete User (Admin Only)
```bash
DELETE /users/:userId
Headers: x-api-key: YOUR_ADMIN_API_KEY
```

