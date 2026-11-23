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

The backend reads its database and JWT settings from `backend/.env`. Keep this file local and do not share or commit its secret values. Configure these variables if needed:

```env
PORT=5000
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=ucu_lost_found
JWT_SECRET=use_a_long_random_secret
```

Install dependencies and start the API:

```powershell
cd backend
npm install
node server.js
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

## Troubleshooting

- **“Failed to fetch”**: make sure the backend is running on port 5000 and the frontend's `VITE_API_URL` points to it.
- **Database access denied**: check `DB_HOST`, `DB_USER`, and `DB_PASSWORD` in `backend/.env`; make sure the MySQL service is running and that the user can access `ucu_lost_found`.
- **Unknown database or missing tables**: create/import the schema using the one-time setup above.
