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
FACULTY_EMAIL=faculty@cspc.edu.ph
FACULTY_PASSWORD=
MICT_EMAIL=mict@cspc.edu.ph
MICT_PASSWORD=
GUIDANCE_EMAIL=guidance@cspc.edu.ph
GUIDANCE_PASSWORD=
GSU_EMAIL=
GSU_PASSWORD=
```

Set each account's email and password together to provision it at startup. The supported prefixes are `ADMIN`, `FACULTY`, `MICT`, `GUIDANCE`, and `GSU`; passwords must be at least 12 characters. The stakeholder email defaults shown above can be changed. These settings provision or update one account per role, so keep the passwords stable between restarts. Copy `.env.example` to `.env`, set unique credentials, and keep `.env` private; never commit real passwords. Administrators can also create stakeholder accounts from the Admin Dashboard.

## Stakeholders and responsibilities

| Stakeholder | System role | Responsibility in S.A.F.E. |
| --- | --- | --- |
| Student | `user` | Primary users who submit feedback and suggestions, follow updates, and participate in public discussions. |
| Faculty | `faculty` | Submit Academic or Administrative feedback and track their own submissions. |
| School Administration | `admin` | Review and act on non-confidential concerns through report status updates and official replies. Provision this account with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. |
| MICT & ICTU | `mict` | Maintain and support S.A.F.E.; receive Technical Support and legacy Technical / System reports. |
| Guidance Office | `guidance` | Handle sensitive or personal complaints in a restricted queue. Guidance & Personal submissions are private, excluded from public, GSU, and administrator feedback lists, and visible only to the submitter and Guidance. |
| General Service Unit | `gsu` | Receive and resolve facilities-related feedback. |

Role checks are enforced by the API as well as the interface. Faculty submissions are restricted to Academic and Administrative categories. Facilities reports are assigned to GSU; other non-confidential concerns, including dining and campus safety, are assigned to School Administration. Each office's management queue and status updates are limited to its assigned categories.

Leave a role's email and password blank to provision that account through the Admin Dashboard instead. The database startup migration adds the confidential-feedback flag to existing installations. Selecting the Guidance & Personal category automatically makes a submission private.

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
