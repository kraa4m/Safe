# CSPC S.A.F.E.

## Run locally

Use Node.js 18 or newer with XAMPP's MySQL module running.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Use the onboarding page to create an account; dashboard access requires signing in.

By default, the backend connects to XAMPP MySQL at `127.0.0.1:3306` as `root` with an empty password. It creates the `cspc_safe` database and required tables on first start. Configure a different XAMPP installation in a `.env` file:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cspc_safe
PORT=3000
ADMIN_EMAIL=admin@example.edu
ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
```

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` to provision the administrator account. Use a unique password with at least 12 characters. On startup, these values create or update that account and grant it the admin role; the configured password is re-applied at each server start. Leave both empty to disable admin provisioning. Sign in with that email and password; the Admin Panel link then appears in the sidebar. Admins can review reports, update their status, and post official replies. Role checks are enforced by the API as well as the interface.

You can also open phpMyAdmin at [http://localhost/phpmyadmin](http://localhost/phpmyadmin) to inspect the database and tables. The MySQL account needs permission to create the database and tables. Passwords are stored as salted scrypt hashes; session tokens are stored as hashes. Do not expose this development server directly to the public internet; deploy behind HTTPS and use production-grade database credentials and configuration.

## API

- `POST /api/auth/register` — create an account and sign in
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PATCH /api/profile` — update the signed-in profile
- `GET /api/admin/feedback` — list reports (admin only)
- `PATCH /api/admin/feedback/:id/status` — update a report status (admin only)
- `GET /api/feedback`, `POST /api/feedback`
- `POST /api/feedback/:id/vote` — toggle the current account's vote
- `GET /api/feedback/:id/comments`, `POST /api/feedback/:id/comments`
- `GET /api/health` — server health check
