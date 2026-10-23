document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('facultyFeedbackForm');
    const reportList = document.getElementById('facultyReportList');
    const statusFilter = document.getElementById('facultyStatusFilter');
    const emptyState = document.getElementById('facultyEmpty');
    const statusClasses = {
        'Just Submitted': 'status-submitted',
        'Under Review': 'status-in-review',
        'In Progress': 'status-in-progress',
        Approved: 'status-resolved',
        Resolved: 'status-resolved',
        Rejected: 'status-rejected'
    };
    let submissions = [];
    let toastTimer;

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(endpoint, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
        return result;
    }

    function notify(message) {
        const toast = document.getElementById('facultyToast');
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
        const button = document.getElementById('facultyThemeToggle');
        button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        button.setAttribute('aria-pressed', String(theme === 'dark'));
    }

    async function loadSubmissions() {
        try {
            const { feedback } = await apiRequest('/api/stakeholder/feedback');
            submissions = feedback;
            renderSubmissions();
        } catch (error) {
            notify(error.message);
        }
    }

    function renderSubmissions() {
        const filtered = submissions.filter(item =>
            statusFilter.value === 'all' || item.status === statusFilter.value
        );
        document.getElementById('facultyTotal').textContent = String(submissions.length);
        document.getElementById('facultyPending').textContent =
            String(submissions.filter(item => item.status === 'Just Submitted').length);
        document.getElementById('facultyProgress').textContent =
            String(submissions.filter(item => ['Under Review', 'In Progress'].includes(item.status)).length);
        document.getElementById('facultyResolved').textContent =
            String(submissions.filter(item => ['Approved', 'Resolved'].includes(item.status)).length);
        emptyState.hidden = filtered.length > 0;
        reportList.innerHTML = filtered.map(item => `
            <article class="faculty-report">
                <div class="faculty-report-top">
                    <span class="tag-badge">${escapeHtml(item.category)}</span>
                    <time>${escapeHtml(new Date(item.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    }))}</time>
                </div>
                <h3>${escapeHtml(item.subject)}</h3>
                <p>${escapeHtml(item.message)}</p>
                <div class="faculty-report-bottom">
                    <span class="status-pill ${statusClasses[item.status] || ''}">${escapeHtml(item.status)}</span>
                    ${item.commentCount ? `<span>${Number(item.commentCount)} response${Number(item.commentCount) === 1 ? '' : 's'}</span>` : ''}
                </div>
            </article>
        `).join('');
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('facultySubmitBtn');
        button.disabled = true;
        try {
            await apiRequest('/api/feedback', {
                method: 'POST',
                body: JSON.stringify({
                    subject: document.getElementById('facultySubject').value,
                    message: document.getElementById('facultyMessage').value,
                    category: document.getElementById('facultyCategory').value,
                    anonymous: document.getElementById('facultyAnonymous').checked
                })
            });
            form.reset();
            await loadSubmissions();
            notify('Your feedback was submitted.');
        } catch (error) {
            notify(error.message);
        } finally {
            button.disabled = false;
        }
    });

    statusFilter.addEventListener('change', renderSubmissions);
    initTheme();
    document.getElementById('facultyThemeToggle').addEventListener('click', () => {
        const root = document.documentElement;
        const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = theme;
        const button = document.getElementById('facultyThemeToggle');
        button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        button.setAttribute('aria-pressed', String(theme === 'dark'));
        try {
            localStorage.setItem('safe_cspc_theme', theme);
        } catch (error) {
            console.error('Unable to save theme preference:', error);
        }
    });
    document.getElementById('facultyLogout').addEventListener('click', async () => {
        try {
            await apiRequest('/api/auth/logout', { method: 'POST' });
            window.location.assign('onboarding.html');
        } catch (error) {
            notify(error.message || 'Unable to sign out. Please try again.');
        }
    });

    apiRequest('/api/auth/me').then(({ user }) => {
        if (!user || user.role !== 'faculty') {
            window.location.replace('onboarding.html');
            return;
        }
        document.getElementById('facultyName').textContent = user.name;
        document.getElementById('facultyEmail').textContent = user.email;
        return loadSubmissions();
    }).catch(error => notify(error.message));
});
