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
        setupEventListeners();
        await loadAdminData();
    }

    async function apiRequest(endpoint, options = {}) {
        const res = await fetch(endpoint, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            ...options
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
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
                item.category.toLowerCase().includes(query);
    
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
                        <select class="form-control sort-select status-change-select" data-id="${item.id}">
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
                const id = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                await handleStatusUpdate(id, newStatus);
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
        try {
            await apiRequest(`/api/admin/feedback/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            showToast(`Status updated to "${status}"`);
            await loadAdminData();
        } catch (err) {
            showToast(err.message || 'Failed to update report status');
        }
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
            renderReports();
        });

        searchClearBtn.addEventListener('click', () => {
            adminSearchInput.value = '';
            searchQuery = '';
            searchClearBtn.style.display = 'none';
            renderReports();
        });

        // Sidebar Navigation
        document.querySelectorAll('.sidebar-nav .nav-item[data-page]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = item.getAttribute('data-page');
                
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
                const activePanel = document.getElementById(`view-${targetPage}`);
                if (activePanel) activePanel.classList.add('active');

                closeSidebar();
            });
        });

        // Sidebar Toggles
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarBackdrop.classList.toggle('active');
        });

        sidebarCloseBtn.addEventListener('click', closeSidebar);
        sidebarBackdrop.addEventListener('click', closeSidebar);

        function closeSidebar() {
            sidebar.classList.remove('open');
            sidebarBackdrop.classList.remove('active');
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
        });

        logoutBtn.addEventListener('click', async () => {
            try {
                await apiRequest('/api/auth/logout', { method: 'POST' });
                window.location.assign('onboarding.html');
            } catch (err) {
                window.location.assign('onboarding.html');
            }
        });

        // Comments Modal
        closeCommentsModalBtn.addEventListener('click', () => commentsModal.classList.remove('show'));
        postCommentBtn.addEventListener('click', postOfficialReply);
        commentTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') postOfficialReply();
        });
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
        const categories = ['Facilities', 'Academic', 'Administrative', 'Student Life', 'Cafeteria & Dining', 'Campus Safety'];
        const categoryCounts = categories.map(cat => allFeedback.filter(f => f.category === cat).length);

        const ctxCategory = document.getElementById('adminCategoryChart').getContext('2d');
        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(ctxCategory, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: categoryCounts,
                    backgroundColor: ['#2563eb', '#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981']
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