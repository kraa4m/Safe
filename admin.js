document.addEventListener('DOMContentLoaded', () => {
    let allFeedback = [];
    let currentActiveFeedbackId = null;
    let activeStatusFilter = 'all';
    let activeCategoryFilter = 'all';
    let searchQuery = '';

    // Charts
    let statusChartInstance = null;
    let categoryChartInstance = null;

    // DOM Elements
    const reportsList = document.getElementById('adminReportsList');
    const reportsEmpty = document.getElementById('adminReportsEmpty');
    const adminSearchInput = document.getElementById('adminSearchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const adminCategoryFilter = document.getElementById('adminCategoryFilter');
    
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    
    const userProfileBtn = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const commentsModal = document.getElementById('commentsModalBackdrop');
    const closeCommentsModalBtn = document.getElementById('closeCommentsModalBtn');
    const commentsThreadList = document.getElementById('commentsThreadList');
    const commentTextInput = document.getElementById('commentTextInput');
    const postCommentBtn = document.getElementById('postCommentBtn');

    // Stats
    const statTotal = document.getElementById('statTotal');
    const statPending = document.getElementById('statPending');
    const statInProgress = document.getElementById('statInProgress');
    const statResolvedRate = document.getElementById('statResolvedRate');

    // Initialize Admin
    init();

    async function init() {
        initTheme();
        setupEventListeners();
        await loadAdminData();
    }

    function initTheme() {
        let theme = 'light';
        try {
            theme = localStorage.getItem('safe_cspc_theme') || 'light';
        } catch (error) {
            console.error('Unable to read theme preference:', error);
        }
        document.documentElement.setAttribute('data-theme', theme);
        themeToggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        themeToggleBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    }

    async function apiRequest(endpoint, options = {}) {
        const res = await fetch(endpoint, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            ...options
        });
        const data = await res.json();
        if (!res.ok) {
            const error = new Error(data.error || 'Request failed');
            error.status = res.status;
            throw error;
        }
        return data;
    }

    async function loadAdminData() {
        try {
            const data = await apiRequest('/api/admin/feedback');
            allFeedback = data.feedback || [];
            updateStats();
            renderReports();
            renderCharts();
        } catch (err) {
            showToast(err.message || 'Failed to load feedback records.');
        }
    }

    async function loadStakeholderAccounts() {
        const accountList = document.getElementById('stakeholderAccountList');
        if (!accountList) return;
        const accountCount = document.getElementById('stakeholderAccountCount');
        accountList.setAttribute('aria-busy', 'true');
        accountList.innerHTML = '<p class="stakeholder-account-empty">Loading accounts...</p>';
        try {
            const { users } = await apiRequest('/api/admin/stakeholders');
            accountList.setAttribute('aria-busy', 'false');
            accountCount.textContent = `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`;
            if (!users.length) {
                accountList.innerHTML = `
                    <div class="stakeholder-account-empty">
                        <strong>No accounts yet</strong>
                        <span>Create the first stakeholder account using the form.</span>
                    </div>`;
                return;
            }
            const roleLabels = {
                faculty: 'Faculty',
                gsu: 'General Service Unit',
                mict: 'MICT & ICTU',
                guidance: 'Guidance Office'
            };
            accountList.innerHTML = users.map(user => `
                <article class="stakeholder-account-row">
                    <div class="stakeholder-account-identity">
                        <span class="stakeholder-account-avatar" aria-hidden="true">${escapeHtml(user.name.trim().charAt(0).toUpperCase())}</span>
                        <div>
                            <strong>${escapeHtml(user.name)}</strong>
                            <span>${escapeHtml(user.email)}</span>
                        </div>
                    </div>
                    <span class="stakeholder-account-role">${roleLabels[user.role] || escapeHtml(user.role)}</span>
                </article>
            `).join('');
        } catch (error) {
            accountList.setAttribute('aria-busy', 'false');
            accountCount.textContent = '';
            const message = error.status === 404
                ? 'Restart the app server to load the stakeholder account API, then refresh this list.'
                : error.message || 'Unable to load stakeholder accounts.';
            accountList.innerHTML = `
                <div class="stakeholder-account-error">
                    <strong>Accounts could not be loaded</strong>
                    <span>${escapeHtml(message)}</span>
                </div>`;
            showToast(message);
        }
    }

    async function createStakeholderAccount(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = document.getElementById('createStakeholderButton');
        const status = document.getElementById('stakeholderAccountStatus');
        button.disabled = true;
        status.textContent = 'Creating account...';
        try {
            const { user } = await apiRequest('/api/admin/stakeholders', {
                method: 'POST',
                body: JSON.stringify({
                    name: form.elements.name.value,
                    email: form.elements.email.value,
                    role: form.elements.role.value,
                    password: form.elements.password.value
                })
            });
            form.reset();
            status.textContent = `Created ${user.name} (${user.email}) as ${user.role}. Share the password securely; it will not be shown again.`;
            await loadStakeholderAccounts();
        } catch (error) {
            status.textContent = error.message || 'Unable to create stakeholder account.';
        } finally {
            button.disabled = false;
        }
    }

    function updateStats() {
        const total = allFeedback.length;
        const pending = allFeedback.filter(f => f.status === 'Just Submitted').length;
        const inProgress = allFeedback.filter(f => f.status === 'In Progress' || f.status === 'Under Review').length;
        const resolved = allFeedback.filter(f => f.status === 'Resolved' || f.status === 'Approved').length;
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        statTotal.textContent = total;
        statPending.textContent = pending;
        statInProgress.textContent = inProgress;
        statResolvedRate.textContent = `${rate}%`;
    }

    function renderReports() {
        const filtered = allFeedback.filter(item => {
            const matchesStatus = activeStatusFilter === 'all' || item.status === activeStatusFilter;
            const matchesCategory = activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
            const query = searchQuery.toLowerCase();
            

            const matchesSearch = !query || 
                item.subject.toLowerCase().includes(query) || 
                item.message.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query) ||
                String(item.author || '').toLowerCase().includes(query);
    
            return matchesStatus && matchesCategory && matchesSearch;
        });
    
        if (filtered.length === 0) {
            reportsList.innerHTML = '';
            reportsEmpty.style.display = 'block';
            return;
        }
    
        reportsEmpty.style.display = 'none';
        reportsList.innerHTML = filtered.map(item => `
            <div class="admin-report-card">
                <div class="admin-report-details">
                    <div class="item-meta-row">
                        <span class="status-pill ${getStatusPillClass(item.status)}">${item.status}</span>
                        <span class="tag-badge">${item.category}</span>
                        <span class="post-time">${formatDate(item.createdAt)}</span>
                    </div>
                    <h3 class="item-title">${escapeHtml(item.subject)}</h3>
                    <p class="item-description">${escapeHtml(item.message)}</p>
                    <div class="admin-report-author">
                        Urgency: <strong>${item.urgency}</strong> • Votes: <strong>${item.votes}</strong>
                    </div>
                </div>
    
                <div class="admin-report-actions">
                    <div>
                        <label class="form-label">Update Status</label>
                        <select class="form-control sort-select status-change-select" data-id="${item.id}" data-previous-status="${escapeHtml(item.status)}">
                            ${['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved', 'Rejected']
                                .map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`)
                                .join('')}
                        </select>
                    </div>
                    <button class="btn btn-secondary open-comments-btn" data-id="${item.id}" data-title="${escapeHtml(item.subject)}">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>Official Reply (${item.commentCount})</span>
                    </button>
                </div>
            </div>
        `).join('');
    
 
        document.querySelectorAll('.status-change-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const statusSelect = e.currentTarget;
                const id = statusSelect.getAttribute('data-id');
                const newStatus = statusSelect.value;
                statusSelect.disabled = true;
                try {
                    await handleStatusUpdate(id, newStatus);
                } catch (error) {
                    statusSelect.value = statusSelect.dataset.previousStatus;
                    showToast(error.message || 'Failed to update report status');
                } finally {
                    statusSelect.disabled = false;
                }
            });
        });
    
        document.querySelectorAll('.open-comments-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const title = btn.getAttribute('data-title');
                openCommentsModal(id, title);
            });
        });
    }

    async function handleStatusUpdate(id, status) {
        await apiRequest(`/api/admin/feedback/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showToast(`Status updated to "${status}"`);
        await loadAdminData();
    }

    async function openCommentsModal(id, title) {
        currentActiveFeedbackId = id;
        document.getElementById('modalPostTitle').textContent = title;
        commentsModal.classList.add('show');
        await loadComments(id);
    }

    async function loadComments(id) {
        commentsThreadList.innerHTML = '<p style="color: var(--text-muted);">Loading comments...</p>';
        try {
            const data = await apiRequest(`/api/feedback/${id}/comments`);
            const comments = data.comments || [];
            if (comments.length === 0) {
                commentsThreadList.innerHTML = '<p style="color: var(--text-muted);">No comments yet. Be the first to reply!</p>';
                return;
            }

            commentsThreadList.innerHTML = comments.map(c => `
                <div class="comment-bubble">
                    <div class="comment-content">
                        <div class="comment-author-row">
                            <span class="author-name">${escapeHtml(c.authorName)}</span>
                            ${c.isAdmin ? '<span class="verified-tag">ADMIN</span>' : ''}
                            <span class="comment-time">${formatDate(c.createdAt)}</span>
                        </div>
                        <p class="comment-text">${escapeHtml(c.message)}</p>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            commentsThreadList.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async function postOfficialReply() {
        const message = commentTextInput.value.trim();
        if (!message || !currentActiveFeedbackId) return;

        postCommentBtn.disabled = true;
        try {
            await apiRequest(`/api/feedback/${currentActiveFeedbackId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            commentTextInput.value = '';
            await loadComments(currentActiveFeedbackId);
            await loadAdminData(); // Refresh list comment counts
            showToast('Official administrative reply posted');
        } catch (err) {
            showToast(err.message || 'Failed to post reply');
        } finally {
            postCommentBtn.disabled = false;
        }
    }

    function setupEventListeners() {
        document.getElementById('stakeholderAccountForm')
            ?.addEventListener('submit', createStakeholderAccount);
        document.getElementById('refreshStakeholdersButton')
            ?.addEventListener('click', loadStakeholderAccounts);
        const roleDescriptions = {
            faculty: 'Faculty accounts can submit academic and administrative feedback.',
            gsu: 'GSU accounts can review facilities, dining, and campus safety reports.',
            mict: 'MICT & ICTU accounts can manage technical support reports.',
            guidance: 'Guidance accounts can access confidential personal submissions.'
        };
        document.getElementById('stakeholderRole')?.addEventListener('change', event => {
            document.getElementById('stakeholderRoleHint').textContent =
                roleDescriptions[event.currentTarget.value];
        });

        // Filters
        document.querySelectorAll('.filter-pill-group .filter-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.filter-pill-group .filter-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeStatusFilter = pill.getAttribute('data-filter');
                renderReports();
            });
        });

        adminCategoryFilter.addEventListener('change', (e) => {
            activeCategoryFilter = e.target.value;
            renderReports();
        });

        adminSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            searchClearBtn.style.display = searchQuery ? 'block' : 'none';
            if (searchQuery) navigateToView('manage');
            renderReports();
        });

        searchClearBtn.addEventListener('click', () => {
            adminSearchInput.value = '';
            searchQuery = '';
            searchClearBtn.style.display = 'none';
            navigateToView('manage');
            renderReports();
        });

        // Sidebar Navigation
        document.querySelectorAll('.sidebar-nav .nav-item[data-page]').forEach(item => {
            item.addEventListener('click', event => {
                event.preventDefault();
                navigateToView(item.dataset.page);
                closeSidebar();
            });
        });
        document.getElementById('homeNavLink').addEventListener('click', event => {
            event.preventDefault();
            navigateToView('manage');
        });
        window.addEventListener('hashchange', () => navigateToView(window.location.hash.slice(1), false));
        window.addEventListener('popstate', () => navigateToView(window.location.hash.slice(1), false));
        navigateToView(window.location.hash.slice(1) || 'manage', false);

        // Sidebar Toggles
        sidebarToggleBtn.addEventListener('click', () => {
            const isOpen = sidebar.classList.toggle('open');
            sidebarBackdrop.classList.toggle('active', isOpen);
            sidebarToggleBtn.setAttribute('aria-expanded', String(isOpen));
        });

        sidebarCloseBtn.addEventListener('click', closeSidebar);
        sidebarBackdrop.addEventListener('click', closeSidebar);

        function closeSidebar() {
            sidebar.classList.remove('open');
            sidebarBackdrop.classList.remove('active');
            sidebarToggleBtn.setAttribute('aria-expanded', 'false');
        }

        // Dropdowns & Theme Toggle
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => profileDropdown.classList.remove('show'));

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            themeToggleBtn.setAttribute('aria-label', `Switch to ${newTheme === 'dark' ? 'light' : 'dark'} mode`);
            themeToggleBtn.setAttribute('aria-pressed', String(newTheme === 'dark'));
            try {
                localStorage.setItem('safe_cspc_theme', newTheme);
            } catch (error) {
                console.error('Unable to save theme preference:', error);
            }
        });

        logoutBtn.addEventListener('click', async () => {
            try {
                await apiRequest('/api/auth/logout', { method: 'POST' });
                window.location.assign('onboarding.html');
            } catch (err) {
                showToast(err.message || 'Unable to sign out. Please try again.');
            }
        });

        // Comments Modal
        closeCommentsModalBtn.addEventListener('click', () => commentsModal.classList.remove('show'));
        postCommentBtn.addEventListener('click', postOfficialReply);
        commentTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') postOfficialReply();
        });
    }

    function navigateToView(targetPage, addHistory = true) {
        const navItems = [...document.querySelectorAll('.sidebar-nav .nav-item[data-page]')];
        const page = navItems.some(item => item.dataset.page === targetPage) ? targetPage : 'manage';
        const currentPage = document.querySelector('.sidebar-nav .nav-item[data-page].active')?.dataset.page;
        if (addHistory && window.location.hash !== `#${page}`) {
            window.history.pushState({ page }, '', `#${page}`);
        } else if (window.location.hash !== `#${page}`) {
            window.history.replaceState({ page }, '', `#${page}`);
        }
        navItems.forEach(item => {
            const active = item.dataset.page === page;
            item.classList.toggle('active', active);
            if (active) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `view-${page}`);
        });
        document.getElementById('adminReportSummary').hidden = page === 'accounts';
        if (page === 'accounts' && currentPage !== page) loadStakeholderAccounts();
        if (page === 'analytics') renderCharts();
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') return;

        // Status Chart
        const statusCounts = {
            'Submitted': allFeedback.filter(f => f.status === 'Just Submitted').length,
            'In Review': allFeedback.filter(f => f.status === 'Under Review').length,
            'In Progress': allFeedback.filter(f => f.status === 'In Progress').length,
            'Resolved': allFeedback.filter(f => f.status === 'Resolved' || f.status === 'Approved').length
        };

        const ctxStatus = document.getElementById('adminStatusChart').getContext('2d');
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(ctxStatus, {
            type: 'bar',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    label: 'Reports',
                    data: Object.values(statusCounts),
                    backgroundColor: ['#f59e0b', '#3b82f6', '#0d9488', '#10b981'],
                    borderRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Category Chart
        const categories = [
            'Facilities',
            'Academic',
            'Administrative',
            'Student Life',
            'Cafeteria & Dining',
            'Campus Safety',
            'Technical Support'
        ];
        const categoryCounts = categories.map(cat => allFeedback.filter(f => f.category === cat).length);

        const ctxCategory = document.getElementById('adminCategoryChart').getContext('2d');
        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(ctxCategory, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: categoryCounts,
                    backgroundColor: ['#2563eb', '#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#64748b']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function getStatusPillClass(status) {
        switch (status) {
            case 'Just Submitted': return 'status-submitted';
            case 'Under Review': return 'status-in-review';
            case 'In Progress': return 'status-in-progress';
            case 'Approved': case 'Resolved': return 'status-resolved';
            case 'Rejected': return 'status-rejected';
            default: return 'status-submitted';
        }
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showToast(msg) {
        const toast = document.getElementById('toastNotification');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});