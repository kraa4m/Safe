/**
 * CSPC S.A.F.E. - Guidance Office View
 * Works with the existing S.A.F.E. API (server.js). Only accounts with role "guidance" can use this page.
 * Data comes from GET /api/admin/feedback, which the server limits to Sensitive / Personal reports
 * for the Guidance Office. Status changes use PATCH /api/admin/feedback/:id/status and replies use
 * POST /api/feedback/:id/comments (saved as Official replies by the server).
 */

const GUIDANCE_ROLE = 'guidance';
const STATUSES = ['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved', 'Rejected'];
const STATUS_CLASSES = {
    'Just Submitted': 'status-submitted',
    'Under Review': 'status-in-review',
    'In Progress': 'status-in-progress',
    Approved: 'status-approved',
    Resolved: 'status-resolved',
    Rejected: 'status-rejected'
};
const URGENCY_RANK = { Critical: 3, High: 2, Normal: 1 };
const AUTO_REFRESH_MS = 60000;
const SVG_COMMENT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const SVG_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
const SVG_USER = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const SVG_SUN = '<svg class="theme-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const SVG_MOON = '<svg class="theme-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

let cases = [];
let activeCommentFeedbackId = null;
let toastTimer = null;

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'same-origin'
    });
    let result = {};
    try { result = await response.json(); } catch { /* non-JSON response */ }
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function showToast(message, duration = 3200) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.innerHTML = `${SVG_CHECK} <span>${escapeHtml(message)}</span>`;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initDropdown();
    initFilters();
    initCaseActions();
    initCommentsModal();
    initProfileEditor();
    initLogout();

    const user = await loadCurrentUser();
    if (!user) return;
    await loadCases();
    setInterval(() => {
        // Skip the refresh while the staff member is replying or changing a status.
        const busy = document.getElementById('commentsModalBackdrop').classList.contains('show')
            || document.activeElement?.matches('[data-status-for]');
        if (!busy && !document.hidden) loadCases(true);
    }, AUTO_REFRESH_MS);
});

/* ---------- Session / access ---------- */
async function loadCurrentUser() {
    try {
        const { user } = await apiRequest('/api/auth/me');
        if (!user) {
            window.location.replace('onboarding.html');
            return null;
        }
        if (user.role !== GUIDANCE_ROLE) {
            window.location.replace(user.role === 'faculty' ? 'faculty_view.html' : 'index.html');
            return null;
        }
        renderProfile(user);
        return user;
    } catch (error) {
        console.error('Unable to load the signed-in account:', error);
        showToast('Unable to connect to S.A.F.E. Please check that the server is running.');
        return null;
    }
}

function renderProfile(user) {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('profileDisplayName', user.name);
    set('profileDisplayEmail', user.email);
    set('profileDepartment', user.department || 'Guidance Office');
    const name = document.getElementById('settingName');
    const email = document.getElementById('settingEmail');
    const dept = document.getElementById('settingDept');
    if (name) name.value = user.name;
    if (email) email.value = user.email;
    if (dept) dept.value = user.department || 'Guidance Office';
}

/* ---------- Theme (shares the key used by the main dashboard) ---------- */
function initTheme() {
    let saved = 'light';
    try { saved = localStorage.getItem('safe_cspc_theme') || 'light'; } catch { /* storage unavailable */ }
    applyTheme(saved);
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('safe_cspc_theme', next); } catch { /* storage unavailable */ }
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    btn.innerHTML = theme === 'dark' ? SVG_SUN : SVG_MOON;
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
}

/* ---------- Header dropdown ---------- */
function initDropdown() {
    const btn = document.getElementById('userProfileBtn');
    const menu = document.getElementById('profileDropdown');
    if (!btn || !menu) return;
    btn.addEventListener('click', event => {
        event.stopPropagation();
        const open = menu.classList.toggle('show');
        btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.header-dropdown-container')) closeDropdown();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeDropdown();
            closeCommentsModal();
            closeProfileEditor();
        }
    });
}

function closeDropdown() {
    document.getElementById('profileDropdown')?.classList.remove('show');
    document.getElementById('userProfileBtn')?.setAttribute('aria-expanded', 'false');
}

/* ---------- Data ---------- */
async function loadCases(silent = false) {
    try {
        const { feedback } = await apiRequest('/api/admin/feedback');
        cases = feedback;
        renderStats();
        renderCases();
        document.getElementById('refreshNote').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error('Unable to load cases:', error);
        if (!silent) showToast(error.message);
    }
}

function renderStats() {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    set('statTotal', cases.length);
    set('statNew', cases.filter(item => item.status === 'Just Submitted').length);
    set('statUrgent', cases.filter(item =>
        (item.urgency === 'High' || item.urgency === 'Critical') &&
        item.status !== 'Resolved' && item.status !== 'Rejected'
    ).length);
    set('statResolved', cases.filter(item => item.status === 'Resolved').length);
}

/* ---------- Filters ---------- */
function initFilters() {
    ['caseSearch'].forEach(id => document.getElementById(id).addEventListener('input', renderCases));
    ['statusFilter', 'urgencyFilter', 'sortOrder'].forEach(id =>
        document.getElementById(id).addEventListener('change', renderCases));
    document.getElementById('refreshBtn').addEventListener('click', () => loadCases());
}

function visibleCases() {
    const query = document.getElementById('caseSearch').value.trim().toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const urgency = document.getElementById('urgencyFilter').value;
    const order = document.getElementById('sortOrder').value;

    const items = cases.filter(item =>
        (status === 'all' || item.status === status) &&
        (urgency === 'all' || (item.urgency || 'Normal') === urgency) &&
        (!query || item.subject.toLowerCase().includes(query) || item.message.toLowerCase().includes(query))
    );
    items.sort((a, b) => {
        const byDate = new Date(b.createdAt) - new Date(a.createdAt);
        if (order === 'oldest') return -byDate;
        if (order === 'newest') return byDate;
        const rank = (URGENCY_RANK[b.urgency] || 1) - (URGENCY_RANK[a.urgency] || 1);
        return rank || byDate;
    });
    return items;
}

/* ---------- Cards ---------- */
function urgencyClass(urgency) {
    return { High: 'urgency-high', Critical: 'urgency-critical' }[urgency] || 'urgency-normal';
}

function createCaseCard(item) {
    const card = document.createElement('article');
    const urgency = item.urgency || 'Normal';
    card.className = `card admin-report-card case-card${urgency === 'Critical' ? ' is-critical' : urgency === 'High' ? ' is-high' : ''}`;
    card.dataset.feedbackId = item.id;
    const options = STATUSES.map(status =>
        `<option value="${status}"${status === item.status ? ' selected' : ''}>${status}</option>`).join('');
    card.innerHTML = `
        <div class="admin-report-details">
            <div class="item-meta-row">
                <span class="tag-badge">${escapeHtml(item.category)}</span>
                <span class="status-pill ${STATUS_CLASSES[item.status] || 'status-submitted'}">${escapeHtml(item.status)}</span>
                <span class="urgency-tag ${urgencyClass(urgency)}">${escapeHtml(urgency)}</span>
                <span class="post-time">${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>
            </div>
            <h3 class="item-title">${escapeHtml(item.subject)}</h3>
            <p class="item-description">${escapeHtml(item.message)}</p>
            <p class="admin-report-author">Submitted by ${escapeHtml(item.author)} &bull; Ticket #${escapeHtml(item.id.slice(0, 8).toUpperCase())}</p>
        </div>
        <div class="admin-report-actions">
            <label>
                <span class="form-label">Status</span>
                <select class="form-control form-select" data-status-for="${escapeHtml(item.id)}" data-previous="${escapeHtml(item.status)}">${options}</select>
            </label>
            <button type="button" class="btn btn-secondary" data-reply-for="${escapeHtml(item.id)}">
                ${SVG_COMMENT} Official reply (${Number(item.commentCount) || 0})
            </button>
        </div>`;
    return card;
}

function renderCases() {
    const list = document.getElementById('caseList');
    const empty = document.getElementById('caseEmpty');
    const items = visibleCases();
    list.replaceChildren(...items.map(createCaseCard));
    empty.hidden = items.length > 0;
}

function initCaseActions() {
    const list = document.getElementById('caseList');

    list.addEventListener('change', async event => {
        const select = event.target.closest('[data-status-for]');
        if (!select) return;
        const id = select.dataset.statusFor;
        const previous = select.dataset.previous;
        select.disabled = true;
        try {
            const result = await apiRequest(`/api/admin/feedback/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: select.value })
            });
            const item = cases.find(entry => entry.id === id);
            if (item) item.status = result.status;
            renderStats();
            renderCases();
            showToast('Case status updated.');
        } catch (error) {
            console.error('Unable to update status:', error);
            select.value = previous;
            select.disabled = false;
            showToast(error.message);
        }
    });

    list.addEventListener('click', event => {
        const button = event.target.closest('[data-reply-for]');
        if (button) openThread(button.dataset.replyFor);
    });
}

/* ---------- Thread / official reply ---------- */
function initCommentsModal() {
    const backdrop = document.getElementById('commentsModalBackdrop');
    const input = document.getElementById('commentTextInput');
    const post = document.getElementById('postCommentBtn');
    const thread = document.getElementById('commentsThreadList');

    document.getElementById('closeCommentsModalBtn').addEventListener('click', closeCommentsModal);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeCommentsModal(); });
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); post.click(); }
    });

    post.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text || !activeCommentFeedbackId) return;
        post.disabled = true;
        try {
            const { comment } = await apiRequest(`/api/feedback/${activeCommentFeedbackId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ message: text })
            });
            appendComment(thread, comment);
            input.value = '';
            thread.scrollTop = thread.scrollHeight;
            const item = cases.find(entry => entry.id === activeCommentFeedbackId);
            if (item) item.commentCount = (Number(item.commentCount) || 0) + 1;
            renderCases();
            showToast('Official reply sent.');
        } catch (error) {
            console.error('Unable to post reply:', error);
            showToast(error.message);
        } finally {
            post.disabled = false;
        }
    });
}

async function openThread(id) {
    const item = cases.find(entry => entry.id === id);
    document.getElementById('modalPostTitle').textContent = item ? item.subject : 'Case Thread';
    const thread = document.getElementById('commentsThreadList');
    thread.replaceChildren();
    activeCommentFeedbackId = id;
    try {
        const { comments } = await apiRequest(`/api/feedback/${id}/comments`);
        comments.forEach(comment => appendComment(thread, comment));
    } catch (error) {
        console.error('Unable to load the thread:', error);
        showToast(error.message);
        return;
    }
    document.getElementById('commentsModalBackdrop').classList.add('show');
    document.getElementById('commentTextInput').focus();
}

function closeCommentsModal() {
    document.getElementById('commentsModalBackdrop')?.classList.remove('show');
    activeCommentFeedbackId = null;
}

function appendComment(thread, comment) {
    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble';
    const avatar = document.createElement('div');
    avatar.className = 'avatar-circle mini';
    avatar.innerHTML = SVG_USER;
    const content = document.createElement('div');
    content.className = 'comment-content';
    const row = document.createElement('div');
    row.className = 'comment-author-row';
    const author = document.createElement('span');
    author.className = 'author-name';
    author.textContent = comment.authorName;
    row.append(author);
    if (comment.isAdmin) {
        const badge = document.createElement('span');
        badge.className = 'verified-tag';
        badge.textContent = 'Official';
        row.append(badge);
    }
    const time = document.createElement('span');
    time.className = 'comment-time';
    time.textContent = new Date(comment.createdAt).toLocaleString();
    row.append(time);
    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = comment.message;
    content.append(row, text);
    bubble.append(avatar, content);
    thread.appendChild(bubble);
}

/* ---------- Profile ---------- */
function initProfileEditor() {
    const modal = document.getElementById('profileEditorModal');
    document.getElementById('editProfileLink').addEventListener('click', event => {
        event.preventDefault();
        closeDropdown();
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('settingName').focus();
    });
    document.getElementById('closeProfileEditorBtn').addEventListener('click', closeProfileEditor);
    modal.addEventListener('click', event => { if (event.target === modal) closeProfileEditor(); });

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        const nameInput = document.getElementById('settingName');
        const emailInput = document.getElementById('settingEmail');
        const deptInput = document.getElementById('settingDept');
        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const department = deptInput.value.trim();
        if (!name || !email || !department) {
            showToast('Enter the name, email, and office / department.');
            return;
        }
        if (!emailInput.checkValidity()) {
            emailInput.reportValidity();
            return;
        }
        try {
            const { user } = await apiRequest('/api/profile', {
                method: 'PATCH',
                body: JSON.stringify({ name, email, department })
            });
            renderProfile(user);
            closeProfileEditor();
            showToast('Profile updated.');
        } catch (error) {
            console.error('Unable to save profile:', error);
            showToast(error.message);
        }
    });
}

function closeProfileEditor() {
    const modal = document.getElementById('profileEditorModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

/* ---------- Logout ---------- */
function initLogout() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await apiRequest('/api/auth/logout', { method: 'POST' });
            window.location.assign('onboarding.html');
        } catch (error) {
            console.error('Unable to sign out:', error);
            showToast(error.message);
        }
    });
}