# UCU Campus Lost & Found

A responsive React and Express application for reporting lost or found items, submitting private ownership claims, and reviewing claims as an administrator. The frontend works on desktop and mobile browsers.

## Features

- Browse, search, and filter lost and found reports.
- Submit ownership claims with private evidence for administrator review.
- Review claims and track item handovers as an administrator.
- Register and sign in with JWT authentication.
- View the project team from the login screen:
  Mawejje Alesha, Osire Samuel, Nangiro Apollo, Okumu Oscar Ebiru,
  Mulungi Favour Priscilla, and Nimusima Cuthbert.

## Project structure

```text
backend/      Express API, authentication, and MySQL access
database/     Production schema and local demo schema/seed
frontend/     Vite, React, and Tailwind CSS application
```

The GitHub repository is [ucu-lost-andfound/ucu_lost_and_found](https://github.com/ucu-lost-andfound/ucu_lost_and_found).

## Requirements

- Node.js and npm
- MySQL for local development

## Run locally

### 1. Configure and start the backend

From the project root, create `backend/.env` using `backend/.env.example` and fill in your local MySQL credentials and a private JWT secret:

```powershell
Copy-Item backend\.env.example backend\.env
```

Install dependencies and start the API in watch mode:

```powershell
Set-Location backend
npm install
npm run dev
```

The development command restarts the API when backend files change. For a normal production-style start, use `npm start`. The API listens on `http://localhost:5000`; its health endpoint is `http://localhost:5000/health`.

### 2. Create the local database

For a fresh local database only, import `database/schema_and_seed.sql` using MySQL Workbench or your MySQL client. This script creates `ucu_lost_found` and inserts fictional demo records. Do not run it against an existing database; it is not an upgrade or reset script.

### 3. Start the frontend

In another terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal. In development, the frontend defaults to `http://localhost:5000/api`. To use another API address, set `VITE_API_URL` in the frontend environment, including the `/api` suffix, then restart Vite.

## Deploy with Railway and Vercel

The repository is a monorepo. Deploy the API and frontend as separate services from the same GitHub repository.

### 1. Create the Railway project and MySQL database

1. Sign in to [Railway](https://railway.com) with GitHub and create a project.
2. Add a MySQL service. Railway provides connection variables such as `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE`.
3. Import `database/schema.sql` into the Railway database once. This production schema creates the `users`, `items`, and `claims` tables without demo accounts. Use Railway's database console or connect with a MySQL client. Do not import `schema_and_seed.sql` into production.

### 2. Deploy the API on Railway

1. Add a service from this GitHub repository.
2. Set its root directory to `backend` and its start command to `npm start`.
3. In the API service's **Variables**, configure:
   - `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` from the Railway MySQL service (or the equivalent `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` variables).
   - `JWT_SECRET` to a new, long, random secret.
   - `NODE_ENV` to `production`.
   - `CORS_ORIGIN` to the exact Vercel frontend origin after you deploy it, for example `https://your-project.vercel.app`. Multiple origins can be comma-separated.
   - `PORT` is supplied by Railway; do not hardcode it.
4. Under **Settings → Networking**, generate a public domain for the API.
5. Check `https://your-api-domain/health`. A successful response is `{"status":"ok","database":"connected"}`. A `503` response means the API cannot reach MySQL; check Railway service variables and deployment logs.

Register your own user after deployment, then make that account an administrator in the Railway database console:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your-admin-email@example.com';
```

Sign out and sign back in for the new role to take effect. Never use the demo accounts in production. Keep `.env` files and secret values out of GitHub.

### 3. Deploy the frontend on Vercel

1. Import the GitHub repository into [Vercel](https://vercel.com).
2. Set the project root directory to `frontend`. Use `npm run build` as the build command and `dist` as the output directory.
3. Before deploying, add `VITE_API_URL` with the Railway API URL and `/api` suffix, for example `https://your-api-domain/api`.
4. Deploy and note the Vercel origin, such as `https://your-project.vercel.app`.
5. Set Railway's `CORS_ORIGIN` variable to that exact origin and redeploy the API. If using a custom frontend domain, include it as well.

The app's viewport metadata and responsive Tailwind layouts support phone and desktop browsers. Verify the Vercel URL on both, sign in, and confirm API requests in the browser's Network panel use the Railway HTTPS URL and succeed.

### 4. Automatic deployments

When Railway and Vercel are connected to the repository, pushing to the configured GitHub branch triggers new deployments. Environment variable changes require a redeployment before the running services use them.

### Uploaded images

Images are stored under `backend/uploads`. Railway's normal container filesystem is ephemeral, so configure persistent storage mounted at the API's uploads directory or move uploads to object storage if images must survive redeployments.

## Security and repository hygiene

- `.env`, `.env.*` (except `.env.example`), `node_modules`, build output, and uploaded files are ignored by Git.
- Set production secrets in Railway/Vercel project variables, not in source files.
- If real credentials were previously committed, rotate them before deploying.

## Troubleshooting

- **Health endpoint returns 503:** Check the Railway MySQL service is running, its variables are available to the API service, and `database/schema.sql` has been imported.
- **Browser reports a CORS error:** Set `CORS_ORIGIN` to the exact deployed Vercel origin, without a trailing slash, then redeploy the API.
- **Frontend reports `VITE_API_URL` is not configured:** Add the variable in Vercel and redeploy. The URL must use HTTPS and end in `/api`.
- **Failed to fetch locally:** Start the API and check that local MySQL is running with the settings in `backend/.env`.
- **Uploaded images disappear after a deployment:** Configure persistent storage or use an object storage service.
