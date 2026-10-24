# CSPC S.A.F.E. (Suggestions And Feedback Engagement)

CSPC S.A.F.E. is a web-based campus feedback and issue management portal designed for Camarines Sur Polytechnic Colleges. It enables students to submit feedback, track issue resolution, upvote suggestions, and engage in campus community discussions, while providing dedicated dashboards for administrative staff and specific department units (such as the General Services Unit - GSU).

---

## Features

### Student & Community Portal
- **Feedback & Report Submission:** Submit feedback with custom subject lines, category selection, urgency indicators, and optional anonymity.
- **Interactive Community Feed:** Real-time community upvoting, status updates, and interactive comment threads.
- **Dark / Light Theme Toggle:** Customizable visual appearance with persistent local storage preferences.
- **Analytics Overview:** Visual metrics powered by Chart.js representing submission trends, category distributions, and resolution statistics.

### Role-Based Portals & Access Control
- **Admin Dashboard (`/admin.html`):** Full administrative control over all submitted reports, status progression, account settings, and official comment replies.
- **GSU Dashboard (`/gsu.html`):** Specialized unit dashboard restricted specifically to GSU-managed categories: **Facilities**, **Cafeteria & Dining**, and **Campus Safety**.
- **Role-Based Routing:** Automated routing upon sign-in directing users to their designated home module (`index.html`, `admin.html`, `gsu.html`, `faculty.html`, or `guidance.html`).
- **Form State Safety:** Automatic input and status clearing during modal navigation and tab switches to prevent user entry leakage.

---

## Tech Stack

- **Backend:** Node.js with **Express.js** web framework (`express`, `cors`, `cookie-parser`, `dotenv`)
- **Database:** MySQL / MariaDB (`mysql2` connection pooling with Promises)
- **Security & Authentication:** Session-based authentication via HttpOnly cookies, password hashing with Node native `crypto` (`scrypt`)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), Chart.js (Data Analytics)

---

## Getting Started & Prerequisites

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [XAMPP](https://www.apachefriends.org/) (or a running local MySQL instance on port 3306)

---

## Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/kraa4m/Safe
   cd CSPC-SAFE