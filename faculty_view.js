/**
 * CSPC S.A.F.E. - Faculty View
 * Works with the existing S.A.F.E. API (server.js). Only accounts with role "faculty" can use this page.
 */

const FACULTY_ROLE = 'faculty';
const STATUS_CLASSES = {
    'Just Submitted': 'status-submitted',
    'Under Review': 'status-in-review',
    'In Progress': 'status-in-progress',
    Approved: 'status-approved',
    Resolved: 'status-resolved',
    Rejected: 'status-rejected'
};
const SENSITIVE_CATEGORY = 'Sensitive / Personal';
const SVG_UP = '<svg class="upvote-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>';
const SVG_COMMENT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const SVG_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
const SVG_USER = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const SVG_SUN = '<svg class="theme-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const SVG_MOON = '<svg class="theme-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

let allFeedback = [];
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
    initTabs();
    initSubmitForm();
    initCommunityControls();
    initProfileEditor();
    initCommentsModal();
    initLogout();
    initCardActions();

    const user = await loadCurrentUser();
    if (!user) return;
    await loadFeedback();
});

/* ---------- Session / access ---------- */
async function loadCurrentUser() {
    try {
        const { user } = await apiRequest('/api/auth/me');
        if (!user) {
            window.location.replace('onboarding.html');
            return null;
        }
        if (user.role !== FACULTY_ROLE) {
            window.location.replace(user.role === 'guidance' ? 'guidance_view.html' : 'index.html');
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
    set('profileDepartment', user.department || 'CSPC Faculty');
    set('welcomeName', user.name);
    const name = document.getElementById('settingName');
    const email = document.getElementById('settingEmail');
    const dept = document.getElementById('settingDept');
    if (name) name.value = user.name;
    if (email) email.value = user.email;
    if (dept) dept.value = user.department || 'CSPC Faculty';
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

/* ---------- Tabs ---------- */
function initTabs() {
    const tabs = document.querySelectorAll('.role-tabs [data-tab]');
    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(item => item.classList.toggle('active', item === tab));
        document.querySelectorAll('.role-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tab.dataset.tab}`);
        });
    }));
}

function switchTab(name) {
    document.querySelector(`.role-tabs [data-tab="${name}"]`)?.click();
}

/* ---------- Data ---------- */
async function loadFeedback() {
    try {
        const { feedback } = await apiRequest('/api/feedback');
        allFeedback = feedback;
        renderAll();
    } catch (error) {
        console.error('Unable to load feedback:', error);
        showToast(error.message);
    }
}

function renderAll() {
    renderStats();
    renderMine();
    renderCommunity();
}

function communityItems() {
    // Sensitive / Personal reports are private and never part of the public community list.
    return allFeedback.filter(item => item.category !== SENSITIVE_CATEGORY);
}

function renderStats() {
    const mine = allFeedback.filter(item => item.mine);
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
    set('statMine', mine.length);
    set('statProgress', mine.filter(item => item.status === 'Under Review' || item.status === 'In Progress').length);
    set('statResolved', mine.filter(item => item.status === 'Resolved').length);
    set('statCommunity', communityItems().length);
}

/* ---------- Cards ---------- */
function urgencyClass(urgency) {
    return { High: 'urgency-high', Critical: 'urgency-critical' }[urgency] || 'urgency-normal';
}

function createCard(item, { showVote }) {
    const card = document.createElement('article');
    card.className = 'card feed-card';
    card.dataset.feedbackId = item.id;
    const voteButton = showVote
        ? `<button type="button" class="upvote-btn ${item.voted ? 'voted' : ''}" data-action="vote" data-id="${escapeHtml(item.id)}" data-voted="${item.voted}">
               ${SVG_UP}<span class="upvote-count">${Number(item.votes) || 0}</span>
           </button>`
        : `<span class="feed-author">${Number(item.votes) || 0} upvotes</span>`;
    card.innerHTML = `
        <div class="item-meta-row">
            <span class="tag-badge">${escapeHtml(item.category)}</span>
            <span class="status-pill ${STATUS_CLASSES[item.status] || 'status-submitted'}">${escapeHtml(item.status)}</span>
            <span class="urgency-tag ${urgencyClass(item.urgency)}">${escapeHtml(item.urgency || 'Normal')}</span>
            <span class="post-time">${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>
        </div>
        <h3 class="item-title">${escapeHtml(item.subject)}</h3>
        <p class="item-description">${escapeHtml(item.message)}</p>
        <div class="feed-footer">
            ${voteButton}
            <button type="button" class="comment-trigger-btn" data-action="comments" data-id="${escapeHtml(item.id)}">
                ${SVG_COMMENT}<span>${Number(item.commentCount) || 0} comments</span>
            </button>
            <span class="feed-author">${item.mine ? 'Submitted by you' : escapeHtml(item.author)}</span>
        </div>`;
    return card;
}

function renderMine() {
    const list = document.getElementById('mineList');
    const empty = document.getElementById('mineEmpty');
    const mine = allFeedback.filter(item => item.mine);
    list.replaceChildren(...mine.map(item => createCard(item, { showVote: false })));
    empty.hidden = mine.length > 0;
}

function renderCommunity() {
    const list = document.getElementById('communityList');
    const empty = document.getElementById('communityEmpty');
    const query = document.getElementById('communitySearch').value.trim().toLowerCase();
    const category = document.getElementById('communityCategory').value;
    const sort = document.getElementById('communitySort').value;

    const items = communityItems().filter(item =>
        (category === 'all' || item.category === category) &&
        (!query || item.subject.toLowerCase().includes(query) || item.message.toLowerCase().includes(query))
    );
    items.sort((a, b) => {
        if (sort === 'votes') return b.votes - a.votes;
        if (sort === 'comments') return b.commentCount - a.commentCount;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    list.replaceChildren(...items.map(item => createCard(item, { showVote: true })));
    empty.hidden = items.length > 0;
}

function initCommunityControls() {
    document.getElementById('communitySearch').addEventListener('input', renderCommunity);
    document.getElementById('communityCategory').addEventListener('change', renderCommunity);
    document.getElementById('communitySort').addEventListener('change', renderCommunity);
}

function initCardActions() {
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const id = button.dataset.id;
        if (button.dataset.action === 'comments') {
            openComments(id);
        } else if (button.dataset.action === 'vote') {
            button.disabled = true;
            try {
                const result = await apiRequest(`/api/feedback/${id}/vote`, { method: 'POST' });
                const item = allFeedback.find(entry => entry.id === id);
                if (item) {
                    item.votes = result.votes;
                    item.voted = result.voted;
                }
                renderCommunity();
            } catch (error) {
                console.error('Unable to update vote:', error);
                showToast(error.message);
                button.disabled = false;
            }
        }
    });
}

/* ---------- Submit ---------- */
function initSubmitForm() {
    const message = document.getElementById('fMessage');
    const counter = document.getElementById('fCharCounter');
    message.addEventListener('input', () => {
        counter.textContent = `${message.value.length} / 800`;
        counter.style.color = message.value.length >= 760 ? '#ef4444' : 'var(--text-muted)';
    });

    const pills = document.querySelectorAll('#facultySubmitForm .urgency-pill');
    pills.forEach(pill => pill.addEventListener('click', () => {
        pills.forEach(item => item.classList.toggle('active', item === pill));
    }));

    const submit = document.getElementById('fSubmitBtn');
    submit.addEventListener('click', async () => {
        const subject = document.getElementById('fSubject').value.trim();
        const text = message.value.trim();
        const category = document.getElementById('fCategory').value;
        const anonymous = document.getElementById('fAnonymous').checked;
        const urgency = document.querySelector('#facultySubmitForm .urgency-pill.active')?.dataset.urgency || 'Normal';
        if (!subject || !text) {
            showToast('Please fill in both the subject and the details.');
            return;
        }
        submit.disabled = true;
        try {
            const { feedback } = await apiRequest('/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ subject, message: text, category, urgency, anonymous })
            });
            allFeedback.unshift(feedback);
            document.getElementById('fSubject').value = '';
            message.value = '';
            counter.textContent = '0 / 800';
            document.getElementById('fAnonymous').checked = false;
            renderAll();
            showToast(`Feedback submitted. Ticket #${feedback.id.slice(0, 8).toUpperCase()}`);
            switchTab('mine');
        } catch (error) {
            console.error('Unable to submit feedback:', error);
            showToast(error.message);
        } finally {
            submit.disabled = false;
        }
    });
}

/* ---------- Comments ---------- */
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
            const item = allFeedback.find(entry => entry.id === activeCommentFeedbackId);
            if (item) item.commentCount = (Number(item.commentCount) || 0) + 1;
            renderMine();
            renderCommunity();
            showToast('Comment posted.');
        } catch (error) {
            console.error('Unable to post comment:', error);
            showToast(error.message);
        } finally {
            post.disabled = false;
        }
    });
}

async function openComments(id) {
    const item = allFeedback.find(entry => entry.id === id);
    document.getElementById('modalPostTitle').textContent = item ? item.subject : 'Discussion Thread';
    const thread = document.getElementById('commentsThreadList');
    thread.replaceChildren();
    activeCommentFeedbackId = id;
    try {
        const { comments } = await apiRequest(`/api/feedback/${id}/comments`);
        comments.forEach(comment => appendComment(thread, comment));
    } catch (error) {
        console.error('Unable to load comments:', error);
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
            showToast('Enter your name, email, and college / department.');
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
            showToast(`Profile updated for ${user.name}.`);
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