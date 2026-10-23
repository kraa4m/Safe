document.addEventListener('DOMContentLoaded', () => {
    const statusOptions = ['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved', 'Rejected'];
    const feedbackList = document.getElementById('feedbackList');
    const statusFilter = document.getElementById('statusFilter');
    const emptyState = document.getElementById('emptyState');
    const replyDialog = document.getElementById('replyDialog');
    const replyForm = document.getElementById('replyForm');
    const replyList = document.getElementById('replyList');
    let currentUser;
    let feedbackItems = [];
    let activeFeedbackId;
    let toastTimer;

    const portalConfig = {
        mict: {
            label: 'MICT & ICTU',
            title: 'Technology support work queue',
            description: 'Review and resolve reports about campus technology, systems, and technical support.',
            listTitle: 'Technical support reports',
            listEyebrow: 'MICT & ICTU WORK QUEUE',
            totalLabel: 'Technical reports',
            empty: 'Technical Support reports will appear here.'
        },
        guidance: {
            label: 'GUIDANCE OFFICE',
            title: 'Confidential support portal',
            description: 'Review private personal concerns submitted for the Guidance Office. These reports are not shown in the public feed.',
            listTitle: 'Confidential submissions',
            listEyebrow: 'RESTRICTED GUIDANCE QUEUE',
            totalLabel: 'Private submissions',
            empty: 'Confidential Guidance & Personal submissions will appear here.'
        }
    };

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);
    }

    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(endpoint, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
        return data;
    }

    function notify(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }

    function initTheme() {
        let theme = 'light';
        try {
            theme = localStorage.getItem('safe_cspc_theme') || 'light';
        } catch (error) {
            console.error('Unable to read theme preference:', error);
        }
        document.documentElement.dataset.theme = theme;
        document.getElementById('themeToggleBtn').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        document.getElementById('themeToggleBtn').setAttribute('aria-pressed', String(theme === 'dark'));
    }

    function formatDate(value) {
        return new Date(value).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function configurePortal() {
        const config = portalConfig[currentUser.role];
        document.title = `S.A.F.E. - ${config.label}`;
        document.getElementById('roleLabel').textContent = config.label;
        document.getElementById('welcomeTitle').textContent = config.title;
        document.getElementById('welcomeDescription').textContent = config.description;
        document.getElementById('portalSubtitle').textContent = config.label;
        document.getElementById('listTitle').textContent = config.listTitle;
        document.getElementById('listEyebrow').textContent = config.listEyebrow;
        document.getElementById('totalLabel').textContent = config.totalLabel;
        document.getElementById('emptyDescription').textContent = config.empty;
        document.getElementById('accountName').textContent = currentUser.name;
        document.getElementById('accountEmail').textContent = currentUser.email;
        document.getElementById('statusFilter').closest('label').hidden = false;
    }

    async function loadFeedback() {
        try {
            const { feedback } = await apiRequest('/api/stakeholder/feedback');
            feedbackItems = feedback;
            renderFeedback();
        } catch (error) {
            notify(error.message);
        }
    }

    function renderFeedback() {
        const filtered = feedbackItems.filter(item =>
            statusFilter.value === 'all' || item.status === statusFilter.value
        );
        const total = feedbackItems.length;
        document.getElementById('totalCount').textContent = String(total);
        document.getElementById('pendingCount').textContent =
            String(feedbackItems.filter(item => item.status === 'Just Submitted').length);
        document.getElementById('progressCount').textContent =
            String(feedbackItems.filter(item => ['Under Review', 'In Progress'].includes(item.status)).length);
        document.getElementById('resolvedCount').textContent =
            String(feedbackItems.filter(item => ['Approved', 'Resolved'].includes(item.status)).length);
        emptyState.hidden = filtered.length > 0;
        feedbackList.innerHTML = filtered.map(renderFeedbackCard).join('');
    }

    function renderFeedbackCard(item) {
        const statusControl = `<label class="stakeholder-status-control">Update status
            <select class="form-control form-select status-select" data-id="${escapeHtml(item.id)}">
              ${statusOptions.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
        </label>`;
        const author = item.author;
        return `<article class="stakeholder-report">
            <div class="stakeholder-report-top">
                <div class="stakeholder-report-tags">
                    <span class="status-pill">${escapeHtml(item.status)}</span>
                    <span class="tag-badge">${escapeHtml(item.category)}</span>
                    ${item.confidential ? '<span class="stakeholder-private-badge">Private</span>' : ''}
                </div>
                <time>${escapeHtml(formatDate(item.createdAt))}</time>
            </div>
            <h3>${escapeHtml(item.subject)}</h3>
            <p class="stakeholder-report-message">${escapeHtml(item.message)}</p>
            <div class="stakeholder-report-footer">
                <span>${escapeHtml(author)} · ${escapeHtml(item.urgency)} urgency</span>
                <div class="stakeholder-report-actions">
                    ${statusControl}
                    <button type="button" class="btn btn-secondary replies-button" data-id="${escapeHtml(item.id)}" data-subject="${escapeHtml(item.subject)}">Replies (${Number(item.commentCount)})</button>
                </div>
            </div>
        </article>`;
    }

    async function loadReplies(id) {
        replyList.innerHTML = '<p class="stakeholder-muted">Loading replies…</p>';
        try {
            const { comments } = await apiRequest(`/api/feedback/${encodeURIComponent(id)}/comments`);
            replyList.innerHTML = comments.length
                ? comments.map(comment => `<article class="stakeholder-reply">
                    <div><strong>${escapeHtml(comment.authorName)}</strong><time>${escapeHtml(formatDate(comment.createdAt))}</time></div>
                    <p>${escapeHtml(comment.message)}</p>
                  </article>`).join('')
                : '<p class="stakeholder-muted">No replies yet.</p>';
        } catch (error) {
            replyList.innerHTML = `<p class="stakeholder-error">${escapeHtml(error.message)}</p>`;
        }
    }

    feedbackList.addEventListener('change', async event => {
        if (!event.target.matches('.status-select')) return;
        const select = event.target;
        try {
            await apiRequest(`/api/stakeholder/feedback/${encodeURIComponent(select.dataset.id)}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: select.value })
            });
            notify('Report status updated.');
            await loadFeedback();
        } catch (error) {
            notify(error.message);
            await loadFeedback();
        }
    });

    feedbackList.addEventListener('click', async event => {
        const button = event.target.closest('.replies-button');
        if (!button) return;
        activeFeedbackId = button.dataset.id;
        document.getElementById('replyTitle').textContent = button.dataset.subject;
        replyDialog.showModal();
        await loadReplies(activeFeedbackId);
    });

    replyForm.addEventListener('submit', async event => {
        event.preventDefault();
        const message = document.getElementById('replyMessage').value.trim();
        if (!message || !activeFeedbackId) return;
        const submitButton = replyForm.querySelector('[type="submit"]');
        submitButton.disabled = true;
        try {
            await apiRequest(`/api/feedback/${encodeURIComponent(activeFeedbackId)}/comments`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            document.getElementById('replyMessage').value = '';
            await loadReplies(activeFeedbackId);
            await loadFeedback();
            notify('Official reply posted.');
        } catch (error) {
            notify(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    document.getElementById('refreshBtn').addEventListener('click', loadFeedback);
    statusFilter.addEventListener('change', renderFeedback);
    initTheme();
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        const root = document.documentElement;
        const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = theme;
        document.getElementById('themeToggleBtn').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        document.getElementById('themeToggleBtn').setAttribute('aria-pressed', String(theme === 'dark'));
        try {
            localStorage.setItem('safe_cspc_theme', theme);
        } catch (error) {
            console.error('Unable to save theme preference:', error);
        }
    });
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await apiRequest('/api/auth/logout', { method: 'POST' });
            window.location.assign('onboarding.html');
        } catch (error) {
            notify(error.message || 'Unable to sign out. Please try again.');
        }
    });

    apiRequest('/api/auth/me').then(({ user }) => {
        if (!user || !['mict', 'guidance'].includes(user.role)) {
            window.location.replace('onboarding.html');
            return;
        }
        currentUser = user;
        configurePortal();
        return loadFeedback();
    }).catch(error => notify(error.message));
});
