# CSPC S.A.F.E.

## Run locally

Use Node.js 18 or newer with XAMPP's MySQL module running.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Use the onboarding page to create an account; dashboard access requires signing in.

`npm install` installs the Node.js dependencies. Database setup runs when `npm start` launches the server: it creates the `cspc_safe` database and required tables if they do not exist, and applies additive migrations to existing databases. This reproduces the database schema, not another installation's users, feedback, comments, or other private records; each installation keeps its own data.

By default, the backend connects to XAMPP MySQL at `127.0.0.1:3306` as `root` with an empty password. Configure a different XAMPP installation in a `.env` file:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cspc_safe
PORT=3000
ADMIN_EMAIL=
ADMIN_PASSWORD=
GSU_EMAIL=
GSU_PASSWORD=
```

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` to bootstrap the administrator account; the password must be at least 12 characters. Restart the server and sign in with those credentials. Administrators can then create Faculty, GSU, MICT & ICTU, and Guidance Office accounts from the Stakeholder Accounts section of the Admin Dashboard. Enter the stakeholder's name, sign-in email, role, and an initial password of at least 12 characters, then share those credentials securely. The password is never shown again after creation. Faculty sign in to a separate portal to submit Academic and Administrative feedback and track their reports. MICT & ICTU can manage Technical Support reports. The Guidance Office can manage confidential Guidance & Personal submissions; these are excluded from public, GSU, and administrator feedback lists and are visible only to the submitter and Guidance. Role checks are enforced by the API as well as the interface.

`GSU_EMAIL` and `GSU_PASSWORD` remain optional for deployments that provision a GSU account at startup; accounts created by an administrator do not require these settings. The database startup migration adds the confidential-feedback flag to existing installations. Selecting the Guidance & Personal category automatically makes a submission private.

You can also open phpMyAdmin at [http://localhost/phpmyadmin](http://localhost/phpmyadmin) to inspect the database and tables. The MySQL account needs permission to create the database and tables. Passwords are stored as salted scrypt hashes; session tokens are stored as hashes. Do not expose this development server directly to the public internet; deploy behind HTTPS and use production-grade database credentials and configuration.

## API

- `POST /api/auth/register` — create an account and sign in
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PATCH /api/profile` — update the signed-in profile
- `GET /api/admin/feedback` — list reports (admin only)
- `PATCH /api/admin/feedback/:id/status` — update a report status (admin only)
- `GET /api/admin/stakeholders`, `POST /api/admin/stakeholders` — list and create stakeholder accounts (admin only)
- `GET /api/stakeholder/feedback` — list the signed-in stakeholder's reports or assigned queue
- `PATCH /api/stakeholder/feedback/:id/status` — update an assigned stakeholder report
- `GET /api/feedback`, `POST /api/feedback`
- `POST /api/feedback/:id/vote` — toggle the current account's vote
- `GET /api/feedback/:id/comments`, `POST /api/feedback/:id/comments`
- `GET /api/health` — server health check
