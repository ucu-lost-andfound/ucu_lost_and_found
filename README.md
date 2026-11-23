# UCU Campus Lost & Found

A React app and Express API for reporting lost or found items, submitting ownership claims, and reviewing claims as an administrator.

## Features

- Browse, search, and filter lost and found reports.
- Submit ownership claims with private evidence for administrator review.
- Review claims and track item handovers as an administrator.
- Sign in or register over a UCU campus photo background. The login panel uses a translucent glass effect.
- Open **Meet the Developers** on the login page to view the project team:
  Mawejje Alesha, Osire Samuel, Nangiro Apollo, Okumu Oscar Ebiru,
  Mulungi Favour Priscilla, and Nimusima Cuthbert.

## Requirements

- Node.js and npm
- MySQL Server

## Local setup

Open two terminals in the project folder.

### Backend

The backend reads its database and JWT settings from `backend/.env`. Start with the example file and configure your local values:

```env
PORT=5000
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=ucu_lost_found
JWT_SECRET=use_a_long_random_secret
```

For a local setup, copy `backend/.env.example` to `backend/.env`. Keep `.env` local; never commit or share its secret values.

Install dependencies and start the API:

```powershell
cd backend
npm install
npm start
```

The API will be available at `http://localhost:5000/api`.

### Database

The backend connects to the local MySQL database named `ucu_lost_found`. The schema contains the `users`, `items`, and `claims` tables.

For a fresh database only, import [`database/schema_and_seed.sql`](database/schema_and_seed.sql) once using MySQL Workbench, or from the project folder with the MySQL command-line client:

```powershell
mysql -u your_mysql_user -p < database/schema_and_seed.sql
```

The SQL file creates the database and inserts sample users and items. Do not import it again into a database that already has these tables; it is not an upgrade or reset script.

### Frontend

In the second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. By default, the frontend sends API requests to `http://localhost:5000/api`. If the backend runs at a different address, set `VITE_API_URL` in the frontend environment, for example `http://localhost:5000/api`, then restart Vite.

## Deploy online

One simple setup is **Railway** for the Express API and MySQL, with **Vercel** for the Vite frontend.

### 1. Deploy the API and database on Railway

1. Create a Railway project from this GitHub repository and add a MySQL service.
2. Add a service for the repository with its root directory set to `backend` and its start command set to `npm start`.
3. In the API service's variables, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` to the corresponding values provided by the Railway MySQL service. Set `JWT_SECRET` to a new, long random value. Railway supplies `PORT`.
4. Select the hosted database and import `database/schema.sql` once. This production schema does not create demo users.
5. Generate a public domain for the API service. Its API URL will end with `/api`.

Do not upload or commit `backend/.env`; set production values in the hosting provider's secret environment variables. If real credentials were previously committed, rotate them before deploying.

After deployment, register your own account, then promote it to administrator in the hosted database console:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your-admin-email@example.com';
```

Sign out and sign back in for the new role to take effect. Do not use the sample accounts in `database/schema_and_seed.sql` in production; they are for local demos.

### 2. Deploy the frontend on Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `frontend`. Use `npm run build` as the build command and `dist` as the output directory.
3. Add the environment variable `VITE_API_URL` with the Railway API URL, including `/api`, then deploy.

### Uploaded images

The API currently stores uploaded images in its local `backend/uploads` directory. Configure persistent storage mounted at the API's uploads directory, or switch to object storage, so images survive redeployments. Without persistent storage, uploaded images may be lost when the service restarts.

## Troubleshooting

- **“Failed to fetch”**: make sure the backend is running on port 5000 and the frontend's `VITE_API_URL` points to it.
- **Database access denied**: check `DB_HOST`, `DB_USER`, and `DB_PASSWORD` in `backend/.env`; make sure the MySQL service is running and that the user can access `ucu_lost_found`.
- **Unknown database or missing tables**: create/import the schema using the one-time setup above.
