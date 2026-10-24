# CSPC S.A.F.E. (Suggestions And Feedback Engagement)

CSPC S.A.F.E. is a web-based campus feedback and issue management portal designed for Camarines Sur Polytechnic Colleges. It enables students to submit feedback, track issue resolution, upvote suggestions, and engage in campus community discussions, while providing dedicated, role-restricted dashboards for administrative staff and campus units.

---

## Features

### Student & Community Portal (`/index.html`)
- **Feedback & Report Submission:** Submit feedback with custom subject lines, category selection, urgency indicators, and optional anonymity.
- **Interactive Community Feed:** Upvoting, status updates, and comment threads.
- **Dark / Light Theme Toggle:** Visual appearance controls with persistent storage preferences.
- **Analytics Overview:** Visual metrics powered by Chart.js representing submission trends and category distributions.

### Role-Based Stakeholder Portals
- **Admin Dashboard (`/admin.html`):** Complete system oversight across non-sensitive reports, status updates, and official administrative replies.
- **General Services Unit (`/gsu.html`):** Restricted to campus maintenance categories: **Facilities**, **Cafeteria & Dining**, and **Campus Safety**.
- **Guidance Office (`/guidance.html`):** Exclusive access to **Guidance & Personal** confidential student feedback.
- **Faculty Portal (`/faculty.html`):** Dedicated portal for faculty members to manage and submit **Academic** and **Administrative** feedback.
- **MICT & ICTU Portal (`/stakeholder.html`):** Specialized stakeholder interface for handling **Technical Support** tickets.

---

## Tech Stack

- **Backend:** Node.js with Express.js framework (`express`, `cors`, `cookie-parser`, `dotenv`, `ejs`)
- **Database:** MySQL / MariaDB (`mysql2` connection pooling with Promises)
- **Security & Auth:** HttpOnly session cookies, password hashing via native `crypto` (`scrypt`)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), Chart.js

---

## Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/kraa4m/Safe
   cd CSPC-SAFE