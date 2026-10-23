require('dotenv').config();

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
    randomBytes,
    randomUUID,
    scrypt: scryptCallback,
    createHash,
    timingSafeEqual
} = require('node:crypto');
const { promisify } = require('node:util');
const mysql = require('mysql2/promise');

const scrypt = promisify(scryptCallback);
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'cspc_safe';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
if (!/^[a-zA-Z0-9_]{1,64}$/.test(DB_NAME)) {
    throw new Error('DB_NAME must contain 1-64 letters, numbers, or underscores.');
}
const CATEGORIES = new Set([
    'Facilities',
    'Academic',
    'Administrative',
    'Student Life',
    'Cafeteria & Dining',
    'Campus Safety'
]);
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

let pool;

function sendJson(response, status, data, headers = {}) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...headers
    });
    response.end(JSON.stringify(data));
}

function fail(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function readJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) throw fail(413, 'Request body is too large.');
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        throw fail(400, 'Request body must be valid JSON.');
    }
}

function getCookies(request) {
    return Object.fromEntries((request.headers.cookie || '')
        .split(';')
        .map(cookie => cookie.trim())
        .filter(Boolean)
        .map(cookie => {
            const separator = cookie.indexOf('=');
            return separator < 0
                ? [cookie, '']
                : [cookie.slice(0, separator), decodeURIComponent(cookie.slice(separator + 1))];
        }));
}

async function getUser(request) {
    const token = getCookies(request).safe_session;
    if (!token) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.execute(
        `SELECT u.id, u.name, u.email, u.department, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
        [tokenHash, Date.now()]
    );
    return rows[0] || null;
}

async function requireUser(request) {
    const user = await getUser(request);
    if (!user) throw fail(401, 'Please log in to continue.');
    return user;
}

async function requireAdmin(request) {
    const user = await requireUser(request);
    if (user.role !== 'admin') throw fail(403, 'Administrator access is required.');
    return user;
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department || '',
        role: user.role || 'user'
    };
}

function validateText(value, field, maxLength, minLength = 1) {
    if (typeof value !== 'string') throw fail(400, `${field} is required.`);
    const text = value.trim();
    if (text.length < minLength || text.length > maxLength) {
        throw fail(400, `${field} must be between ${minLength} and ${maxLength} characters.`);
    }
    return text;
}

function validateEmail(value) {
    if (typeof value !== 'string') throw fail(400, 'A valid email address is required.');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw fail(400, 'A valid email address is required.');
    }
    return email;
}

async function createSession(response, userId) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
    await pool.execute('DELETE FROM sessions WHERE expires_at <= ?', [Date.now()]);
    await pool.execute(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
        [tokenHash, userId, expiresAt]
    );
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    response.setHeader('Set-Cookie',
        `safe_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`);
}

function clearSessionCookie(response) {
    response.setHeader('Set-Cookie', 'safe_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

async function serializeFeedback(item, user) {
    const [[voteResult], [commentResult], [userVote]] = await Promise.all([
        pool.execute('SELECT COUNT(*) AS count FROM votes WHERE feedback_id = ?', [item.id]),
        pool.execute('SELECT COUNT(*) AS count FROM comments WHERE feedback_id = ?', [item.id]),
        user
            ? pool.execute('SELECT 1 AS voted FROM votes WHERE feedback_id = ? AND user_id = ?', [item.id, user.id])
            : Promise.resolve([[]])
    ]);
    return {
        id: item.id,
        subject: item.subject,
        message: item.message,
        category: item.category,
        urgency: item.urgency,
        anonymous: Boolean(item.anonymous),
        author: item.anonymous ? 'Anonymous Student' : item.author_name,
        status: item.status,
        createdAt: new Date(item.created_at).toISOString(),
        votes: Number(voteResult[0].count),
        voted: userVote.length > 0,
        commentCount: Number(commentResult[0].count)
    };
}

async function initializeDatabase() {
    const connection = await mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD
    });
    try {
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } finally {
        await connection.end();
    }

    pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'
    });

    const schema = [
        `CREATE TABLE IF NOT EXISTS users (
            id CHAR(36) NOT NULL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(254) NOT NULL UNIQUE,
            department VARCHAR(120) NOT NULL DEFAULT '',
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            salt CHAR(32) NOT NULL,
            password_hash CHAR(128) NOT NULL,
            created_at DATETIME(3) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS sessions (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            expires_at BIGINT NOT NULL,
            INDEX idx_sessions_expiration (expires_at),
            CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS feedback (
            id CHAR(36) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            author_name VARCHAR(100) NOT NULL,
            anonymous BOOLEAN NOT NULL DEFAULT FALSE,
            subject VARCHAR(100) NOT NULL,
            message VARCHAR(800) NOT NULL,
            category VARCHAR(40) NOT NULL,
            urgency VARCHAR(20) NOT NULL,
            status VARCHAR(40) NOT NULL,
            created_at DATETIME(3) NOT NULL,
            INDEX idx_feedback_created (created_at),
            CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS votes (
            feedback_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            PRIMARY KEY (feedback_id, user_id),
            CONSTRAINT fk_votes_feedback FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
            CONSTRAINT fk_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        `CREATE TABLE IF NOT EXISTS comments (
            id CHAR(36) NOT NULL PRIMARY KEY,
            feedback_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            author_name VARCHAR(100) NOT NULL,
            message VARCHAR(500) NOT NULL,
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            created_at DATETIME(3) NOT NULL,
            INDEX idx_comments_feedback_created (feedback_id, created_at),
            CONSTRAINT fk_comments_feedback FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
            CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];
    for (const statement of schema) await pool.query(statement);
    const [userColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
    if (!userColumns.length) {
        await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'");
    }
    const [commentColumns] = await pool.query("SHOW COLUMNS FROM comments LIKE 'is_admin'");
    if (!commentColumns.length) {
        await pool.query('ALTER TABLE comments ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE');
    }
    await initializeAdminAccount();
    await pool.query('SELECT 1');
}

async function initializeAdminAccount() {
    if (!ADMIN_EMAIL && !ADMIN_PASSWORD) return;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to enable the admin account.');
    }
    const email = validateEmail(ADMIN_EMAIL);
    if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 128) {
        throw new Error('ADMIN_PASSWORD must be between 12 and 128 characters.');
    }
    const salt = randomBytes(16);
    const passwordHash = Buffer.from(await scrypt(ADMIN_PASSWORD, salt, 64));
    await pool.execute(
        `INSERT INTO users (id, name, email, department, role, salt, password_hash, created_at)
         VALUES (?, 'S.A.F.E. Administrator', ?, 'CSPC Administration', 'admin', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            department = VALUES(department),
            role = 'admin',
            salt = VALUES(salt),
            password_hash = VALUES(password_hash)`,
        [randomUUID(), email, salt.toString('hex'), passwordHash.toString('hex'), new Date()]
    );
}

async function handleApi(request, response, url) {
    const { pathname } = url;
    if (request.method === 'GET' && pathname === '/api/health') {
        await pool.query('SELECT 1');
        return sendJson(response, 200, { status: 'ok', database: 'connected' });
    }

    if (request.method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJson(request);
        const name = validateText(body.name, 'Name', 100, 2);
        const email = validateEmail(body.email);
        if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
            throw fail(400, 'Password must be between 8 and 128 characters.');
        }
        const salt = randomBytes(16);
        const passwordHash = Buffer.from(await scrypt(body.password, salt, 64));
        const user = {
            id: randomUUID(),
            name,
            email,
            department: 'College of Computer Studies (CCS) - BSIT'
        };
        try {
            await pool.execute(
                `INSERT INTO users (id, name, email, department, role, salt, password_hash, created_at)
                 VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
                [user.id, user.name, user.email, user.department, salt.toString('hex'),
                    passwordHash.toString('hex'), new Date()]
            );
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'An account with this email already exists.');
            throw error;
        }
        await createSession(response, user.id);
        return sendJson(response, 201, { user: publicUser(user) });
    }

    if (request.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(request);
        const email = validateEmail(body.email);
        const [users] = await pool.execute(
            'SELECT id, name, email, department, role, salt, password_hash FROM users WHERE email = ?',
            [email]
        );
        const user = users[0];
        if (!user || typeof body.password !== 'string') throw fail(401, 'The email or password is incorrect.');
        const candidate = Buffer.from(await scrypt(body.password, Buffer.from(user.salt, 'hex'), 64));
        const expected = Buffer.from(user.password_hash, 'hex');
        if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
            throw fail(401, 'The email or password is incorrect.');
        }
        await createSession(response, user.id);
        return sendJson(response, 200, { user: publicUser(user) });
    }

    if (request.method === 'GET' && pathname === '/api/auth/me') {
        const user = await getUser(request);
        return sendJson(response, 200, { user: user ? publicUser(user) : null });
    }

    if (request.method === 'POST' && pathname === '/api/auth/logout') {
        const token = getCookies(request).safe_session;
        if (token) {
            const tokenHash = createHash('sha256').update(token).digest('hex');
            await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
        }
        clearSessionCookie(response);
        return sendJson(response, 200, { success: true });
    }

    if (request.method === 'PATCH' && pathname === '/api/profile') {
        const user = await requireUser(request);
        const body = await readJson(request);
        const name = validateText(body.name, 'Name', 100, 2);
        const email = validateEmail(body.email);
        const department = validateText(body.department, 'Department', 120);
        try {
            await pool.execute(
                'UPDATE users SET name = ?, email = ?, department = ? WHERE id = ?',
                [name, email, department, user.id]
            );
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'That email is already used by another account.');
            throw error;
        }
        await pool.execute(
            'UPDATE feedback SET author_name = ? WHERE user_id = ? AND anonymous = FALSE',
            [name, user.id]
        );
        return sendJson(response, 200, { user: publicUser({ ...user, name, email, department }) });
    }

    if (request.method === 'GET' && pathname === '/api/feedback') {
        const user = await getUser(request);
        const [items] = await pool.execute('SELECT * FROM feedback ORDER BY created_at DESC');
        const feedback = await Promise.all(items.map(item => serializeFeedback(item, user)));
        return sendJson(response, 200, { feedback });
    }

    if (request.method === 'GET' && pathname === '/api/admin/feedback') {
        const user = await requireAdmin(request);
        const [items] = await pool.execute('SELECT * FROM feedback ORDER BY created_at DESC');
        const feedback = await Promise.all(items.map(item => serializeFeedback(item, user)));
        return sendJson(response, 200, { feedback });
    }

    const adminStatusMatch = pathname.match(/^\/api\/admin\/feedback\/([0-9a-f-]+)\/status$/i);
    if (request.method === 'PATCH' && adminStatusMatch) {
        await requireAdmin(request);
        const body = await readJson(request);
        const status = validateText(body.status, 'Status', 40);
        if (!['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved', 'Rejected'].includes(status)) {
            throw fail(400, 'Choose a valid report status.');
        }
        const [result] = await pool.execute(
            'UPDATE feedback SET status = ? WHERE id = ?',
            [status, adminStatusMatch[1]]
        );
        if (!result.affectedRows) throw fail(404, 'Feedback not found.');
        return sendJson(response, 200, { id: adminStatusMatch[1], status });
    }

    if (request.method === 'POST' && pathname === '/api/feedback') {
        const user = await requireUser(request);
        const body = await readJson(request);
        const subject = validateText(body.subject, 'Subject', 100);
        const message = validateText(body.message, 'Feedback', 800);
        if (!CATEGORIES.has(body.category)) throw fail(400, 'Choose a valid feedback category.');
        const urgency = body.urgency === undefined ? 'Normal' : body.urgency;
        if (!['Normal', 'High', 'Critical'].includes(urgency)) {
            throw fail(400, 'Choose a valid urgency level.');
        }
        const item = {
            id: randomUUID(),
            subject,
            message,
            category: body.category,
            urgency,
            anonymous: body.anonymous === true,
            author_name: user.name,
            status: 'Just Submitted',
            created_at: new Date()
        };
        await pool.execute(
            `INSERT INTO feedback
             (id, user_id, author_name, anonymous, subject, message, category, urgency, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, user.id, item.author_name, item.anonymous, item.subject, item.message,
                item.category, item.urgency, item.status, item.created_at]
        );
        return sendJson(response, 201, { feedback: await serializeFeedback(item, user) });
    }

    const voteMatch = pathname.match(/^\/api\/feedback\/([0-9a-f-]+)\/vote$/i);
    if (request.method === 'POST' && voteMatch) {
        const user = await requireUser(request);
        const connection = await pool.getConnection();
        let voted;
        try {
            await connection.beginTransaction();
            const [items] = await connection.execute(
                'SELECT id FROM feedback WHERE id = ? FOR UPDATE',
                [voteMatch[1]]
            );
            if (!items.length) throw fail(404, 'Feedback not found.');
            const [existing] = await connection.execute(
                'SELECT user_id FROM votes WHERE feedback_id = ? AND user_id = ?',
                [voteMatch[1], user.id]
            );
            voted = existing.length === 0;
            if (voted) {
                await connection.execute(
                    'INSERT INTO votes (feedback_id, user_id) VALUES (?, ?)',
                    [voteMatch[1], user.id]
                );
            } else {
                await connection.execute(
                    'DELETE FROM votes WHERE feedback_id = ? AND user_id = ?',
                    [voteMatch[1], user.id]
                );
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        const [[result]] = await pool.execute(
            'SELECT COUNT(*) AS count FROM votes WHERE feedback_id = ?',
            [voteMatch[1]]
        );
        return sendJson(response, 200, { votes: Number(result.count), voted });
    }

    const commentsMatch = pathname.match(/^\/api\/feedback\/([0-9a-f-]+)\/comments$/i);
    if (commentsMatch && request.method === 'GET') {
        const [items] = await pool.execute('SELECT id FROM feedback WHERE id = ?', [commentsMatch[1]]);
        if (!items.length) throw fail(404, 'Feedback not found.');
        const [comments] = await pool.execute(
            `SELECT id, author_name AS authorName, message, is_admin AS isAdmin, created_at AS createdAt
             FROM comments WHERE feedback_id = ? ORDER BY created_at ASC`,
            [commentsMatch[1]]
        );
        return sendJson(response, 200, {
            comments: comments.map(comment => ({
                ...comment,
                isAdmin: Boolean(comment.isAdmin),
                createdAt: new Date(comment.createdAt).toISOString()
            }))
        });
    }

    if (commentsMatch && request.method === 'POST') {
        const user = await requireUser(request);
        const [items] = await pool.execute('SELECT id FROM feedback WHERE id = ?', [commentsMatch[1]]);
        if (!items.length) throw fail(404, 'Feedback not found.');
        const body = await readJson(request);
        const message = validateText(body.message, 'Comment', 500);
        const comment = {
            id: randomUUID(),
            authorName: user.name,
            message,
            createdAt: new Date()
        };
        await pool.execute(
            `INSERT INTO comments (id, feedback_id, user_id, author_name, message, is_admin, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [comment.id, commentsMatch[1], user.id, comment.authorName, comment.message,
                user.role === 'admin', comment.createdAt]
        );
        return sendJson(response, 201, {
            comment: { ...comment, isAdmin: user.role === 'admin', createdAt: comment.createdAt.toISOString() }
        });
    }

    return sendJson(response, 404, { error: 'API route not found.' });
}

async function serveStatic(request, response, url) {
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return sendJson(response, 400, { error: 'Invalid URL path.' });
    }
    if (pathname === '/') pathname = '/onboarding.html';
    const allowedFiles = new Set([
        '/index.html',
        '/admin.html',
        '/onboarding.html',
        '/style.css',
        '/onboarding.css',
        '/script.js',
        '/admin.js',
        '/onboarding.js',
        '/images/safe-logo.png'
    ]);
    if (!allowedFiles.has(pathname)) return sendJson(response, 404, { error: 'File not found.' });
    const filePath = path.resolve(ROOT, `.${pathname}`);
    if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
        return sendJson(response, 403, { error: 'Forbidden.' });
    }
    let stat;
    try {
        stat = await fs.promises.stat(filePath);
    } catch {
        return sendJson(response, 404, { error: 'File not found.' });
    }
    if (!stat.isFile()) return sendJson(response, 404, { error: 'File not found.' });
    response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff'
    });
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    try {
        if (url.pathname.startsWith('/api/')) {
            await handleApi(request, response, url);
        } else if (request.method === 'GET' || request.method === 'HEAD') {
            await serveStatic(request, response, url);
        } else {
            sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
        }
    } catch (error) {
        if (error.status) return sendJson(response, error.status, { error: error.message });
        console.error('Request failed:', error);
        return sendJson(response, 500, { error: 'An unexpected server error occurred.' });
    }
});

initializeDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`CSPC S.A.F.E. server listening on http://localhost:${PORT}`);
        console.log(`Connected to MySQL database "${DB_NAME}" at ${DB_HOST}:${DB_PORT}`);
    });
}).catch(error => {
    console.error(
        `Unable to connect to XAMPP MySQL at ${DB_HOST}:${DB_PORT}. ` +
        'Start MySQL in the XAMPP Control Panel and check DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD.'
    );
    console.error(error);
    process.exitCode = 1;
});