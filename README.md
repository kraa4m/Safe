# CSPC S.A.F.E. (Suggestions And Feedback Engagement)

CSPC S.A.F.E. is a web-based campus feedback and issue management portal designed for Camarines Sur Polytechnic Colleges. It enables students to submit feedback, track issue resolution, upvote suggestions, and engage in campus community discussions, while providing dedicated dashboards for administrators and department units (like the General Services Unit - GSU).

---

## Features

### Student & Community Portal
- **Feedback & Report Submission:** Submit feedback with subject lines, category selection, urgency levels, and optional anonymity.
- **Interactive Community Feed:** Upvote community posts, view official status updates, and participate in comment threads.
- **Dark / Light Theme Toggle:** Customizable visual theme with persistent local storage settings.
- **Analytics Overview:** Visual representation of campus feedback metrics, resolution trends, and category distribution.

### Role-Based Portals & Access Control
- **Admin Dashboard (`/admin.html`):** Full administrative control over all submitted reports, status progression, user accounts, and comment moderation.
- **GSU Dashboard (`/gsu.html`):** Specialized unit dashboard restricted specifically to GSU-related categories (**Facilities**, **Cafeteria & Dining**, and **Campus Safety**).
- **Automated Routing:** Secure session-based authentication routing users directly to their designated dashboard (`index.html`, `admin.html`, or `gsu.html`).

---

## Tech Stack

- **Backend:** Node.js (Vanilla HTTP module), MySQL (`mysql2` connection pooling), Crypto (`scrypt` password hashing)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), Chart.js (Analytics Data Visualization)
- **Database:** MySQL / MariaDB (XAMPP compatible)

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