/**
 * CSPC S.A.F.E. - Suggestions And Feedback Engagement
 * Interactive Logic, Inline SVG Integration & Analytics
 */

// Global Chart References
let monthlyVolumeChart = null;
let categoryBreakdownChart = null;
let reportsTrendChart = null;
let reportsStatusChart = null;
let activeCommentFeedbackId = null;
let backendFeedback = [];
let currentUserIsAdmin = false;
const ADMIN_STATUSES = ['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved', 'Rejected'];
const FEEDBACK_CATEGORIES = [
    'Facilities',
    'Academic',
    'Administrative',
    'Student Life',
    'Cafeteria & Dining',
    'Campus Safety',
    'Technical Support',
    'Guidance & Personal'
];
const CATEGORY_COLORS = ['#2563eb', '#f59e0b', '#0d9488', '#334155', '#0284c7', '#8b5cf6', '#64748b', '#db2777'];

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'same-origin'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
}

// Reusable SVG Definitions for Dynamic Injection
const SVGS = {
    user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    upvote: `<svg class="upvote-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>`,
    comment: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    share: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
    sun: `<svg class="theme-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg class="theme-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
    const profileLoaded = initLoggedInProfile();
    loadBackendFeedback();
    initTheme();
    initMobileNav();
    initNavigationRouter();
    initDropdowns();
    initSearchEnhancements();
    initDashboardCharts();
    initUpvotes();
    initFeedbackForms();
    initSuggestionsFilter();
    initCommentsModal();
    initLivePreview();
    initSettingsActions();
    initAdminPanel();
    restoreDrafts();

    profileLoaded.then(isAuthenticated => {
        if (!isAuthenticated) return;
        const initialView = window.location.hash.replace('#', '') || 'dashboard';
        switchView(initialView);
    });
});

async function initLoggedInProfile() {
    try {
        const { user } = await apiRequest('/api/auth/me');
        if (!user) {
            window.location.replace('onboarding.html');
            return false;
        }
        currentUserIsAdmin = user.role === 'admin';
        const adminNavItem = document.getElementById('adminNavItem');
        if (adminNavItem) adminNavItem.hidden = !currentUserIsAdmin;
        updateProfileDisplay(user);
        return true;
    } catch (error) {
        console.error('Unable to load the signed-in account:', error);
        showToast('Unable to connect to S.A.F.E. Please check that the server is running.');
        return false;
    }
}

function updateProfileDisplay(user) {
    const displayName = user.name.trim();
    const displayEmail = user.email.trim();
    const department = user.department || 'College of Computer Studies (CCS) - BSIT';
    ['profileDisplayName', 'sidebarDisplayName'].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = displayName;
    });
    const profileEmail = document.getElementById('profileDisplayEmail');
    const settingName = document.getElementById('settingName');
    const settingEmail = document.getElementById('settingEmail');
    const settingDepartment = document.getElementById('settingDept');
    const profileDepartment = document.getElementById('profileDepartment');
    const sidebarRole = document.getElementById('sidebarDisplayRole');
    if (profileEmail) profileEmail.textContent = displayEmail;
    if (settingName) settingName.value = displayName;
    if (settingEmail) settingEmail.value = displayEmail;
    if (settingDepartment) settingDepartment.value = department;
    if (profileDepartment) profileDepartment.textContent = department;
    if (sidebarRole) {
        sidebarRole.textContent = user.role === 'admin'
            ? 'S.A.F.E. Administrator'
            : `CSPC Student • ${department}`;
    }
}

/* ==========================================================================
   Dark / Light Theme Toggle
   ========================================================================== */
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('safe_cspc_theme') || localStorage.getItem('schoolvoice_theme') || 'light';

    applyTheme(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
            localStorage.setItem('safe_cspc_theme', nextTheme);
            showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.innerHTML = theme === 'dark' ? SVGS.sun : SVGS.moon;
        themeBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    }
    updateChartsTheme(theme);
}

function updateChartsTheme(theme) {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    [monthlyVolumeChart, reportsTrendChart].forEach(chart => {
        if (chart && chart.options.scales) {
            if (chart.options.scales.x) chart.options.scales.x.ticks.color = textColor;
            if (chart.options.scales.y) {
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
            }
            chart.update();
        }
    });
    [categoryBreakdownChart, reportsStatusChart].forEach(chart => {
        if (chart) {
            chart.options.plugins.legend.labels.color = textColor;
            chart.update();
        }
    });
}

/* ==========================================================================
   Navigation Sidebar Drawer Toggle (Desktop & Mobile)
   ========================================================================== */
function initMobileNav() {
    const toggleBtn = document.getElementById('sidebarToggleBtn') || document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!sidebar) return;

    function openSidebar() {
        sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
        if (toggleBtn) {
            toggleBtn.classList.add('active');
            toggleBtn.setAttribute('aria-expanded', 'true');
        }
        document.body.classList.add('sidebar-open');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('sidebar-open');
    }

    function toggleSidebar() {
        if (sidebar.classList.contains('open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeSidebar();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            closeSidebar();
        });
    }

    // Auto-close drawer on navigation link selection
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', () => {
            closeSidebar();
        });
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
}

/* ==========================================================================
   Navigation Router & View Switcher
   ========================================================================== */
function initNavigationRouter() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.getAttribute('data-page');
            switchView(targetPage);
        });
    });

    const linkToSettings = document.getElementById('linkToSettings');
    if (linkToSettings) {
        linkToSettings.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllDropdowns();
            openProfileEditor();
        });
    }

    const linkToSubmit = document.getElementById('linkToSubmit');
    if (linkToSubmit) {
        linkToSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllDropdowns();
            switchView('submit');
        });
    }

    window.addEventListener('hashchange', () => {
        const hashPage = window.location.hash.replace('#', '') || 'dashboard';
        switchView(hashPage, false);
    });
}

function switchView(viewName, updateHash = true) {
    if (viewName === 'admin' && !currentUserIsAdmin) {
        showToast('Administrator access is required.');
        viewName = 'dashboard';
    }
    const validViews = ['dashboard', 'submit', 'suggestions', 'reports', 'admin', 'settings'];
    const activeView = validViews.includes(viewName) ? viewName : 'dashboard';

    const pageTitle = document.getElementById('pageTitle');
    const titleMap = {
        'dashboard': 'Dashboard',
        'submit': 'Submit Feedback',
        'suggestions': 'Community Suggestions',
        'reports': 'Analytics & Reports',
        'admin': 'Admin Panel',
        'settings': 'Account Settings'
    };
    if (pageTitle) pageTitle.textContent = titleMap[activeView] || 'Dashboard';

    if (updateHash) {
        history.replaceState(null, null, `#${activeView}`);
    }

    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.getAttribute('data-page') === activeView);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });

    const currentPanel = document.getElementById(`view-${activeView}`);
    if (currentPanel) {
        currentPanel.style.display = 'block';
        setTimeout(() => currentPanel.classList.add('active'), 10);
    }

    if (activeView === 'reports') {
        initReportsCharts();
        updateFeedbackAnalytics(backendFeedback);
    } else if (activeView === 'admin') {
        loadAdminReports();
    } else if (activeView === 'dashboard') {
        setTimeout(() => {
            if (monthlyVolumeChart) monthlyVolumeChart.resize();
            if (categoryBreakdownChart) categoryBreakdownChart.resize();
        }, 50);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        triggerSearchFilter('');
        toggleClearSearchBtn(false);
    }
}

/* ==========================================================================
   Header Dropdowns (Notifications & Profile)
   ========================================================================== */
   function initDropdowns() {
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const profileBtn = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const notifBadge = document.getElementById('notifBadge');

    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown?.classList.remove('show');
            const isOpen = notifDropdown.classList.toggle('show');
            notifBtn.setAttribute('aria-expanded', String(isOpen));
            if (profileBtn) profileBtn.setAttribute('aria-expanded', 'false');
        });
    }

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown?.classList.remove('show');
            const isOpen = profileDropdown.classList.toggle('show');
            profileBtn.setAttribute('aria-expanded', String(isOpen));
            if (notifBtn) notifBtn.setAttribute('aria-expanded', 'false');
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => {
            document.querySelectorAll('.notif-item.unread').forEach(item => item.classList.remove('unread'));
            if (notifBadge) notifBadge.style.display = 'none';
            if (notifBtn) notifBtn.setAttribute('aria-label', 'Notifications');
            markAllReadBtn.style.display = 'none';
            showToast('All notifications marked as read');
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-dropdown-container')) {
            closeAllDropdowns();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllDropdowns();
            closeCommentsModal();
        }
    });
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
    document.getElementById('notifBtn')?.setAttribute('aria-expanded', 'false');
    document.getElementById('userProfileBtn')?.setAttribute('aria-expanded', 'false');
}

/* ==========================================================================
   Search Enhancements
   ========================================================================== */
function initSearchEnhancements() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        toggleClearSearchBtn(query.length > 0);
        triggerSearchFilter(query);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            toggleClearSearchBtn(false);
            triggerSearchFilter('');
            searchInput.focus();
        });
    }
}

function toggleClearSearchBtn(show) {
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) clearBtn.style.display = show ? 'block' : 'none';
}

function triggerSearchFilter(query) {
    const dashCards = document.querySelectorAll('#suggestionsContainer .suggestion-card');
    let dashVisibleCount = 0;
    dashCards.forEach(card => {
        const title = card.querySelector('.suggestion-title')?.textContent.toLowerCase() || '';
        const snippet = card.querySelector('.suggestion-snippet')?.textContent.toLowerCase() || '';
        if (!query || title.includes(query) || snippet.includes(query)) {
            card.style.display = 'flex';
            dashVisibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const dashEmpty = document.getElementById('dashEmptyState');
    if (dashEmpty) {
        dashEmpty.style.display = dashVisibleCount === 0 ? 'block' : 'none';
        dashEmpty.querySelector('h4').textContent = query ? 'No feedback found' : 'No submissions yet';
        dashEmpty.querySelector('p').textContent = query
            ? 'No suggestions match your search. Try different keywords!'
            : 'New feedback and suggestions will appear here.';
    }

    const communityCards = document.querySelectorAll('.suggestion-card-full');
    let commVisibleCount = 0;
    communityCards.forEach(card => {
        const title = card.querySelector('.item-title')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.item-description')?.textContent.toLowerCase() || '';
        if (!query || title.includes(query) || desc.includes(query)) {
            card.style.display = 'flex';
            commVisibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const commEmpty = document.getElementById('feedEmptyState');
    if (commEmpty) {
        commEmpty.style.display = commVisibleCount === 0 ? 'block' : 'none';
        commEmpty.querySelector('h4').textContent = query ? 'No suggestions found' : 'No suggestions yet';
        commEmpty.querySelector('p').textContent = query
            ? 'No suggestions match your search. Try another topic.'
            : 'Submit feedback to start the campus community feed.';
    }
}

/* ==========================================================================
   Dashboard Charts (Chart.js)
   ========================================================================== */
function initDashboardCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';
    const months = getLastSixMonths();

    const barCtx = document.getElementById('monthlyVolumeChart');
    if (barCtx && !monthlyVolumeChart) {
        monthlyVolumeChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: months.map(month => month.label),
                datasets: [{
                    label: 'Submissions',
                    data: months.map(() => 0),
                    backgroundColor: '#2563eb',
                    borderRadius: 4,
                    barPercentage: 0.65
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: { family: 'Inter', size: 12 },
                        bodyFont: { family: 'Inter', size: 12 }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 11 }, color: textColor }
                    },
                    y: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { font: { family: 'Inter', size: 11 }, color: textColor, precision: 0 },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    const pieCtx = document.getElementById('categoryBreakdownChart');
    if (pieCtx && !categoryBreakdownChart) {
        categoryBreakdownChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: FEEDBACK_CATEGORIES,
                datasets: [{
                    data: FEEDBACK_CATEGORIES.map(() => 0),
                    backgroundColor: CATEGORY_COLORS,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: { family: 'Inter', size: 12 },
                            usePointStyle: true,
                            color: textColor,
                            filter: (item, chart) => chart.datasets[0].data[item.index] > 0
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: { family: 'Inter', size: 12 },
                        bodyFont: { family: 'Inter', size: 12 }
                    }
                }
            }
        });
    }
}

function getLastSixMonths() {
    const current = new Date();
    return Array.from({ length: 6 }, (_, index) => {
        const date = new Date(current.getFullYear(), current.getMonth() - 5 + index, 1);
        return {
            year: date.getFullYear(),
            month: date.getMonth(),
            label: date.toLocaleString(undefined, { month: 'short', year: '2-digit' })
        };
    });
}

function updateFeedbackAnalytics(feedback) {
    backendFeedback = feedback;
    const months = getLastSixMonths();
    const receivedByMonth = months.map(month => feedback.filter(item => {
        const createdAt = new Date(item.createdAt);
        return createdAt.getFullYear() === month.year && createdAt.getMonth() === month.month;
    }).length);
    const resolvedByMonth = months.map(month => feedback.filter(item => {
        const createdAt = new Date(item.createdAt);
        return createdAt.getFullYear() === month.year &&
            createdAt.getMonth() === month.month &&
            item.status.toLowerCase() === 'resolved';
    }).length);
    const categoryCounts = FEEDBACK_CATEGORIES.map(category =>
        feedback.filter(item => item.category === category).length
    );
    const statuses = ['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved'];
    const statusCounts = statuses.map(status =>
        feedback.filter(item => item.status.toLowerCase() === status.toLowerCase()).length
    );
    const resolvedCount = feedback.filter(item => item.status.toLowerCase() === 'resolved').length;
    const totalVotes = feedback.reduce((total, item) => total + Number(item.votes || 0), 0);

    if (monthlyVolumeChart) {
        monthlyVolumeChart.data.labels = months.map(month => month.label);
        monthlyVolumeChart.data.datasets[0].data = receivedByMonth;
        monthlyVolumeChart.update();
    }
    if (categoryBreakdownChart) {
        categoryBreakdownChart.data.datasets[0].data = categoryCounts;
        categoryBreakdownChart.update();
    }
    if (reportsTrendChart) {
        reportsTrendChart.data.labels = months.map(month => month.label);
        reportsTrendChart.data.datasets[0].data = receivedByMonth;
        reportsTrendChart.data.datasets[1].data = resolvedByMonth;
        reportsTrendChart.update();
    }
    if (reportsStatusChart) {
        reportsStatusChart.data.datasets[0].data = statusCounts;
        reportsStatusChart.update();
    }

    const values = {
        reportTotalSubmissions: feedback.length.toLocaleString(),
        reportResolutionRate: `${feedback.length ? Math.round((resolvedCount / feedback.length) * 100) : 0}%`,
        reportResponseTime: '—',
        reportActiveIdeas: feedback.filter(item => item.status.toLowerCase() !== 'resolved').length.toLocaleString(),
        reportTotalVotes: totalVotes.toLocaleString()
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

/* ==========================================================================
   Reports Page Charts
   ========================================================================== */
function initReportsCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';

    const trendCtx = document.getElementById('reportsTrendChart');
    if (trendCtx && !reportsTrendChart) {
        const months = getLastSixMonths();
        reportsTrendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: months.map(month => month.label),
                datasets: [
                    {
                        label: 'Received',
                        data: months.map(() => 0),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointBackgroundColor: '#2563eb'
                    },
                    {
                        label: 'Resolved',
                        data: months.map(() => 0),
                        borderColor: '#0d9488',
                        backgroundColor: 'rgba(13, 148, 136, 0.08)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointBackgroundColor: '#0d9488'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { font: { family: 'Inter', size: 12 }, usePointStyle: true, color: textColor }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    const statusCtx = document.getElementById('reportsStatusChart');
    if (statusCtx && !reportsStatusChart) {
        reportsStatusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Just Submitted', 'Under Review', 'In Progress', 'Approved', 'Resolved'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: ['#64748b', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Inter', size: 11 },
                            usePointStyle: true,
                            color: textColor,
                            filter: (item, chart) => chart.datasets[0].data[item.index] > 0
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }
}

/* ==========================================================================
   Upvote Handling
   ========================================================================== */
function initUpvotes() {
    document.addEventListener('click', async (e) => {
        const upvoteBtn = e.target.closest('.upvote-btn, .upvote-btn-vertical');
        if (!upvoteBtn) return;

        const feedbackId = upvoteBtn.dataset.feedbackId;
        const isVoted = upvoteBtn.getAttribute('data-voted') === 'true';
        const countSpan = upvoteBtn.querySelector('.upvote-count');
        let currentCount = parseInt(countSpan.textContent, 10) || 0;

        if (feedbackId) {
            upvoteBtn.disabled = true;
            try {
                const result = await apiRequest(`/api/feedback/${feedbackId}/vote`, { method: 'POST' });
                document.querySelectorAll(`[data-feedback-id="${feedbackId}"] .upvote-count, button[data-feedback-id="${feedbackId}"] .upvote-count`)
                    .forEach(count => { count.textContent = String(result.votes); });
                document.querySelectorAll(`button[data-feedback-id="${feedbackId}"]`).forEach(button => {
                    button.setAttribute('data-voted', String(result.voted));
                    button.classList.toggle('voted', result.voted);
                });
                const feedback = backendFeedback.find(item => item.id === feedbackId);
                if (feedback) feedback.votes = result.votes;
                updateFeedbackAnalytics(backendFeedback);
            } catch (error) {
                console.error('Unable to update vote:', error);
                showToast(error.message);
            } finally {
                upvoteBtn.disabled = false;
            }
            return;
        }

        if (isVoted) {
            upvoteBtn.setAttribute('data-voted', 'false');
            upvoteBtn.classList.remove('voted');
            countSpan.textContent = currentCount - 1;
        } else {
            upvoteBtn.setAttribute('data-voted', 'true');
            upvoteBtn.classList.add('voted');
            countSpan.textContent = currentCount + 1;
        }
    });
}

/* ==========================================================================
   Feedback Forms Handling
   ========================================================================== */
function initFeedbackForms() {
    const submitBtn = document.getElementById('submitBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');
    const subjectInput = document.getElementById('subjectInput');
    const feedbackText = document.getElementById('feedbackText');
    const categorySelect = document.getElementById('categorySelect');
    const dashboardAnonymous = document.getElementById('dashboardAnonymous');
    const dashCharCounter = document.getElementById('dashCharCounter');

    if (feedbackText && dashCharCounter) {
        feedbackText.addEventListener('input', () => {
            const len = feedbackText.value.length;
            dashCharCounter.textContent = `${len} / 400`;
            if (len >= 380) dashCharCounter.style.color = '#ef4444';
            else dashCharCounter.style.color = 'var(--text-muted)';
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const subject = subjectInput.value.trim();
            const text = feedbackText.value.trim();
            const category = categorySelect.value;

            if (!subject || !text) {
                showToast('Please provide both a subject and feedback message.');
                return;
            }

            submitBtn.disabled = true;
            try {
                const { feedback } = await apiRequest('/api/feedback', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject,
                        message: text,
                        category,
                        anonymous: dashboardAnonymous.checked
                    })
                });
                addNewFeedback(feedback);
                subjectInput.value = '';
                feedbackText.value = '';
                dashCharCounter.textContent = '0 / 400';
                categorySelect.value = 'Facilities';
                dashboardAnonymous.checked = false;
                localStorage.removeItem('safe_cspc_draft');
                localStorage.removeItem('schoolvoice_draft');
                triggerConfetti();
                showToast('Feedback submitted to CSPC S.A.F.E.!');
            } catch (error) {
                console.error('Unable to submit feedback:', error);
                showToast(error.message);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            const draft = {
                subject: subjectInput.value.trim(),
                feedback: feedbackText.value.trim(),
                category: categorySelect.value
            };
            if (!draft.subject && !draft.feedback) {
                showToast('Nothing to save. Write something first.');
                return;
            }
            localStorage.setItem('safe_cspc_draft', JSON.stringify(draft));
            showToast('Draft saved successfully!');
        });
    }

    const dedSubmitBtn = document.getElementById('dedSubmitBtn');
    const dedSaveDraftBtn = document.getElementById('dedSaveDraftBtn');
    const dedSubject = document.getElementById('dedSubject');
    const dedCategory = document.getElementById('dedCategory');
    const dedMessage = document.getElementById('dedMessage');
    const dedAnonymous = document.getElementById('dedAnonymous');
    const dedCharCounter = document.getElementById('dedCharCounter');

    if (dedMessage && dedCharCounter) {
        dedMessage.addEventListener('input', () => {
            const len = dedMessage.value.length;
            dedCharCounter.textContent = `${len} / 800`;
            if (len >= 760) dedCharCounter.style.color = '#ef4444';
            else dedCharCounter.style.color = 'var(--text-muted)';
        });
    }

    const urgencyPills = document.querySelectorAll('.urgency-pill');
    urgencyPills.forEach(pill => {
        pill.addEventListener('click', () => {
            urgencyPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    if (dedSubmitBtn) {
        dedSubmitBtn.addEventListener('click', async () => {
            const subject = dedSubject.value.trim();
            const text = dedMessage.value.trim();
            const category = dedCategory.value;
            const isAnon = dedAnonymous.checked;
            const activeUrgency = document.querySelector('.urgency-pill.active');
            const urgency = activeUrgency?.getAttribute('data-urgency') || 'Normal';

            if (!subject || !text) {
                showToast('Please fill in both the subject and feedback details.');
                return;
            }

            dedSubmitBtn.disabled = true;
            try {
                const { feedback } = await apiRequest('/api/feedback', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject,
                        message: text,
                        category,
                        anonymous: isAnon,
                        urgency
                    })
                });
                addNewFeedback(feedback);
                dedSubject.value = '';
                dedMessage.value = '';
                dedCharCounter.textContent = '0 / 800';
                dedAnonymous.checked = false;
                localStorage.removeItem('safe_cspc_ded_draft');
                localStorage.removeItem('schoolvoice_ded_draft');
                triggerConfetti();
                showToast(`Feedback submitted successfully! Ticket #${feedback.id.slice(0, 8).toUpperCase()}`);
                setTimeout(() => switchView('suggestions'), 900);
            } catch (error) {
                console.error('Unable to submit feedback:', error);
                showToast(error.message);
            } finally {
                dedSubmitBtn.disabled = false;
            }
        });
    }

    if (dedSaveDraftBtn) {
        dedSaveDraftBtn.addEventListener('click', () => {
            const draft = {
                subject: dedSubject.value.trim(),
                message: dedMessage.value.trim(),
                category: dedCategory.value
            };
            if (!draft.subject && !draft.message) {
                showToast('Nothing to save.');
                return;
            }
            localStorage.setItem('safe_cspc_ded_draft', JSON.stringify(draft));
            showToast('Draft saved successfully!');
        });
    }
}

async function loadBackendFeedback() {
    try {
        const { feedback } = await apiRequest('/api/feedback');
        backendFeedback = feedback;
        feedback.reverse().forEach(item => addNewFeedback(item, true));
        updateFeedbackAnalytics(backendFeedback);
        triggerSearchFilter(document.getElementById('searchInput')?.value.trim() || '');
    } catch (error) {
        console.error('Unable to load submitted feedback:', error);
    }
}

function addNewFeedback(feedback, renderOnly = false) {
    const { id, subject, message, category, author, status, votes, voted, commentCount } = feedback;
    if (document.querySelector(`.suggestion-card[data-feedback-id="${id}"]`)) return;
    const existingIndex = backendFeedback.findIndex(item => item.id === id);
    if (existingIndex === -1) backendFeedback.push(feedback);
    else backendFeedback[existingIndex] = feedback;
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);
    const safeCategory = escapeHtml(category);
    const safeAuthor = escapeHtml(author);
    const privateBadge = feedback.confidential
        ? '<span class="stakeholder-private-badge">Private to you and Guidance</span>'
        : '';
    const voteState = voted ? 'voted' : '';
    const voteCount = Number(votes) || 0;
    const comments = Number(commentCount) || 0;
    const dashContainer = document.getElementById('suggestionsContainer');
    if (dashContainer) {
        const newDashCard = document.createElement('div');
        newDashCard.className = 'card suggestion-card';
        newDashCard.dataset.feedbackId = id;
        newDashCard.innerHTML = `
            <div class="avatar-circle">
                ${SVGS.user}
            </div>
            <div class="suggestion-content">
                <div class="badge-row">
                    <span class="tag-badge">${safeCategory}</span>
                    ${privateBadge}
                </div>
                <h3 class="suggestion-title">${safeSubject}</h3>
                <p class="suggestion-snippet">${safeMessage}</p>
                <div class="card-action-bar">
                    <div class="upvote-row">
                        <button class="upvote-btn ${voteState}" data-voted="${voted}" data-feedback-id="${id}">
                            ${SVGS.upvote}
                            <span class="upvote-count">${voteCount}</span>
                        </button>
                    </div>
                    <button class="action-link-btn open-comments-btn" data-feedback-id="${id}">
                        ${SVGS.comment}
                        <span>${comments} comments</span>
                    </button>
                </div>
            </div>
        `;
        dashContainer.insertBefore(newDashCard, dashContainer.firstChild);
    }

    const communityList = document.getElementById('communitySuggestionsList');
    if (communityList) {
        const fullCard = document.createElement('div');
        fullCard.className = 'card suggestion-card-full';
        fullCard.dataset.feedbackId = id;
        fullCard.setAttribute('data-category', category);
        fullCard.setAttribute('data-votes', String(voteCount));
        fullCard.innerHTML = `
            <div class="card-left-col">
                <div class="avatar-circle">
                    ${SVGS.user}
                </div>
                <button class="upvote-btn-vertical ${voteState}" data-voted="${voted}" data-feedback-id="${id}">
                    ${SVGS.upvote}
                    <span class="upvote-count">${voteCount}</span>
                </button>
            </div>
            <div class="card-main-col">
                <div class="item-meta-row">
                    <span class="tag-badge">${safeCategory}</span>
                    ${privateBadge}
                    <span class="status-pill ${getFeedbackStatusClass(status)}">${escapeHtml(status)}</span>
                    <span class="post-time">${new Date(feedback.createdAt).toLocaleString()}</span>
                </div>
                <h3 class="item-title">${safeSubject}</h3>
                <p class="item-description">${safeMessage}</p>
                <div class="item-footer">
                    <button class="comment-trigger-btn open-comments-btn" data-feedback-id="${id}">
                        ${SVGS.comment}
                        <span>${comments} comments</span>
                    </button>
                    <span class="author-tag">
                        ${SVGS.shield}
                        <span>${safeAuthor}</span>
                    </span>
                    <button class="share-btn" title="Share link">
                        ${SVGS.share}
                        <span>Share</span>
                    </button>
                </div>
            </div>
        `;
        communityList.insertBefore(fullCard, communityList.firstChild);
    }
    triggerSearchFilter(document.getElementById('searchInput')?.value.trim() || '');
    if (!renderOnly) updateFeedbackAnalytics(backendFeedback);
}

function getFeedbackStatusClass(status) {
    const classes = {
        'Just Submitted': 'status-submitted',
        'Under Review': 'status-in-review',
        'In Progress': 'status-in-progress',
        Approved: 'status-approved',
        Resolved: 'status-resolved',
        Rejected: 'status-rejected'
    };
    return classes[status] || 'status-submitted';
}

function initAdminPanel() {
    const reportsList = document.getElementById('adminReportsList');
    if (!reportsList) return;
    reportsList.addEventListener('change', async event => {
        const statusSelect = event.target.closest('[data-admin-feedback-id]');
        if (!statusSelect) return;
        const feedbackId = statusSelect.dataset.adminFeedbackId;
        const previousStatus = statusSelect.dataset.previousStatus;
        statusSelect.disabled = true;
        try {
            const result = await apiRequest(`/api/admin/feedback/${feedbackId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: statusSelect.value })
            });
            statusSelect.dataset.previousStatus = result.status;
            const feedbackItem = backendFeedback.find(item => item.id === feedbackId);
            if (feedbackItem) feedbackItem.status = result.status;
            document.querySelectorAll(`.suggestion-card-full[data-feedback-id="${feedbackId}"] .status-pill`)
                .forEach(pill => {
                    pill.textContent = result.status;
                    pill.className = `status-pill ${getFeedbackStatusClass(result.status)}`;
                });
            updateFeedbackAnalytics(backendFeedback);
            showToast('Report status updated.');
        } catch (error) {
            console.error('Unable to update report status:', error);
            statusSelect.value = previousStatus;
            showToast(error.message);
        } finally {
            statusSelect.disabled = false;
        }
    });
}

async function loadAdminReports() {
    if (!currentUserIsAdmin) return;
    const reportsList = document.getElementById('adminReportsList');
    const emptyState = document.getElementById('adminReportsEmpty');
    if (!reportsList || !emptyState) return;
    reportsList.replaceChildren();
    try {
        const { feedback } = await apiRequest('/api/admin/feedback');
        backendFeedback = feedback;
        feedback.forEach(item => reportsList.appendChild(createAdminReportCard(item)));
        emptyState.hidden = feedback.length > 0;
        updateFeedbackAnalytics(backendFeedback);
    } catch (error) {
        console.error('Unable to load admin reports:', error);
        showToast(error.message);
    }
}

function createAdminReportCard(feedback) {
    const card = document.createElement('article');
    card.className = 'admin-report-card';
    card.dataset.feedbackId = feedback.id;
    const statusOptions = ADMIN_STATUSES.map(status =>
        `<option value="${status}"${status === feedback.status ? ' selected' : ''}>${status}</option>`
    ).join('');
    card.innerHTML = `
        <div class="admin-report-details">
            <div class="item-meta-row">
                <span class="tag-badge">${escapeHtml(feedback.category)}</span>
                <span class="post-time">${new Date(feedback.createdAt).toLocaleString()}</span>
            </div>
            <h3 class="item-title">${escapeHtml(feedback.subject)}</h3>
            <p class="item-description">${escapeHtml(feedback.message)}</p>
            <p class="admin-report-author">Submitted by ${escapeHtml(feedback.author)}</p>
        </div>
        <div class="admin-report-actions">
            <label>
                <span class="form-label">Status</span>
                <select class="form-control form-select" data-admin-feedback-id="${feedback.id}" data-previous-status="${escapeHtml(feedback.status)}">
                    ${statusOptions}
                </select>
            </label>
            <button type="button" class="btn btn-secondary open-comments-btn" data-feedback-id="${feedback.id}">
                Official reply <span class="admin-comment-count">${feedback.commentCount}</span>
            </button>
        </div>
    `;
    return card;
}

/* ==========================================================================
   Live Preview Card (Submit View)
   ========================================================================== */
function initLivePreview() {
    const dedSubject = document.getElementById('dedSubject');
    const dedMessage = document.getElementById('dedMessage');
    const dedCategory = document.getElementById('dedCategory');

    const previewTitle = document.getElementById('previewTitle');
    const previewSnippet = document.getElementById('previewSnippet');
    const previewMeta = document.getElementById('previewMeta');

    function updatePreview() {
        if (previewTitle) {
            previewTitle.textContent = dedSubject?.value.trim() || 'Your Subject Title';
        }
        if (previewSnippet) {
            previewSnippet.textContent = dedMessage?.value.trim() || 'Your feedback snippet will appear here dynamically...';
        }
        if (previewMeta) {
            const cat = dedCategory?.value || 'Facilities';
            previewMeta.textContent = `${cat} • Just now`;
        }
    }

    if (dedSubject) dedSubject.addEventListener('input', updatePreview);
    if (dedMessage) dedMessage.addEventListener('input', updatePreview);
    if (dedCategory) dedCategory.addEventListener('change', updatePreview);
}

/* ==========================================================================
   Suggestions Filter & Sort
   ========================================================================== */
function initSuggestionsFilter() {
    const filterPills = document.querySelectorAll('.filter-pill');
    const sortSelect = document.getElementById('sortSuggestionsSelect');

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const filterValue = pill.getAttribute('data-filter');
            const items = document.querySelectorAll('.suggestion-card-full');
            let visibleCount = 0;

            items.forEach(item => {
                const category = item.getAttribute('data-category') || '';
                if (filterValue === 'all' || category === filterValue) {
                    item.style.display = 'flex';
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });

            const commEmpty = document.getElementById('feedEmptyState');
            if (commEmpty) commEmpty.style.display = visibleCount === 0 ? 'block' : 'none';
        });
    });

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            const mode = sortSelect.value;
            const container = document.getElementById('communitySuggestionsList');
            if (!container) return;

            const cards = Array.from(container.querySelectorAll('.suggestion-card-full'));

            if (mode === 'upvotes') {
                cards.sort((a, b) => {
                    const votesA = parseInt(a.querySelector('.upvote-count')?.textContent || '0', 10);
                    const votesB = parseInt(b.querySelector('.upvote-count')?.textContent || '0', 10);
                    return votesB - votesA;
                });
            }

            cards.forEach(card => container.appendChild(card));
            showToast(`Sorted by ${sortSelect.options[sortSelect.selectedIndex].text}`);
        });
    }

    document.addEventListener('click', (e) => {
        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            navigator.clipboard?.writeText(window.location.href);
            showToast('Feedback link copied to clipboard!');
        }
    });
}

/* ==========================================================================
   Interactive Comments Modal
   ========================================================================== */
function initCommentsModal() {
    const backdrop = document.getElementById('commentsModalBackdrop');
    const closeBtn = document.getElementById('closeCommentsModalBtn');
    const postBtn = document.getElementById('postCommentBtn');
    const commentInput = document.getElementById('commentTextInput');
    const threadList = document.getElementById('commentsThreadList');
    const modalTitle = document.getElementById('modalPostTitle');

    document.addEventListener('click', async (e) => {
        const trigger = e.target.closest('.open-comments-btn');
        if (trigger) {
            const card = trigger.closest('.suggestion-card, .suggestion-card-full, .admin-report-card');
            const title = card?.querySelector('.suggestion-title, .item-title')?.textContent || 'Discussion Thread';
            if (modalTitle) modalTitle.textContent = title;
            activeCommentFeedbackId = trigger.dataset.feedbackId || card?.dataset.feedbackId || null;
            if (activeCommentFeedbackId) {
                try {
                    const { comments } = await apiRequest(`/api/feedback/${activeCommentFeedbackId}/comments`);
                    threadList.replaceChildren();
                    comments.forEach(comment => appendComment(threadList, comment));
                } catch (error) {
                    console.error('Unable to load comments:', error);
                    showToast(error.message);
                }
            }
            backdrop.classList.add('show');
            commentInput?.focus();
        }
    });

    function closeModal() {
        backdrop.classList.remove('show');
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });
    }

    if (postBtn && commentInput && threadList) {
        postBtn.addEventListener('click', async () => {
            const comment = commentInput.value.trim();
            if (!comment) return;

            postBtn.disabled = true;
            try {
                let newComment;
                if (activeCommentFeedbackId) {
                    const { comment: created } = await apiRequest(
                        `/api/feedback/${activeCommentFeedbackId}/comments`,
                        { method: 'POST', body: JSON.stringify({ message: comment }) }
                    );
                    newComment = created;
                    document.querySelectorAll(
                        `.suggestion-card[data-feedback-id="${activeCommentFeedbackId}"], ` +
                        `.suggestion-card-full[data-feedback-id="${activeCommentFeedbackId}"], ` +
                        `.admin-report-card[data-feedback-id="${activeCommentFeedbackId}"]`
                    ).forEach(card => card.querySelectorAll('.open-comments-btn').forEach(button => {
                        const count = Number(backendFeedback.find(item => item.id === activeCommentFeedbackId)?.commentCount) || 0;
                        const nextCount = count + 1;
                        const countLabel = button.querySelector('span');
                        if (countLabel) {
                            countLabel.textContent = button.classList.contains('comment-trigger-btn')
                                || button.classList.contains('action-link-btn')
                                ? `${nextCount} comments`
                                : String(nextCount);
                        }
                    }));
                    const feedbackItem = backendFeedback.find(item => item.id === activeCommentFeedbackId);
                    if (feedbackItem) feedbackItem.commentCount = (Number(feedbackItem.commentCount) || 0) + 1;
                } else {
                    newComment = {
                        authorName: document.getElementById('profileDisplayName')?.textContent || 'Student',
                        message: comment,
                        createdAt: new Date().toISOString()
                    };
                }
                appendComment(threadList, newComment);
                commentInput.value = '';
                showToast('Comment posted!');
                threadList.scrollTop = threadList.scrollHeight;
            } catch (error) {
                console.error('Unable to post comment:', error);
                showToast(error.message);
            } finally {
                postBtn.disabled = false;
            }
        });
    }
}

function appendComment(threadList, comment) {
    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble';
    const avatar = document.createElement('div');
    avatar.className = 'avatar-circle mini';
    avatar.innerHTML = SVGS.user;
    const content = document.createElement('div');
    content.className = 'comment-content';
    const authorRow = document.createElement('div');
    authorRow.className = 'comment-author-row';
    const author = document.createElement('span');
    author.className = 'author-name';
    author.textContent = comment.authorName;
    if (comment.isAdmin) {
        const badge = document.createElement('span');
        badge.className = 'verified-tag';
        badge.textContent = 'Admin';
        authorRow.append(author, badge);
    } else {
        authorRow.append(author);
    }
    const time = document.createElement('span');
    time.className = 'comment-time';
    time.textContent = new Date(comment.createdAt).toLocaleString();
    const message = document.createElement('p');
    message.className = 'comment-text';
    message.textContent = comment.message;
    authorRow.append(time);
    content.append(authorRow, message);
    bubble.append(avatar, content);
    threadList.appendChild(bubble);
}

function closeCommentsModal() {
    const backdrop = document.getElementById('commentsModalBackdrop');
    if (backdrop) backdrop.classList.remove('show');
}

/* ==========================================================================
   Drafts Persistence
   ========================================================================== */
function restoreDrafts() {
    const saved = localStorage.getItem('safe_cspc_draft') || localStorage.getItem('schoolvoice_draft');
    if (saved) {
        try {
            const draft = JSON.parse(saved);
            if (draft.subject) document.getElementById('subjectInput').value = draft.subject;
            if (draft.feedback) {
                document.getElementById('feedbackText').value = draft.feedback;
                const counter = document.getElementById('dashCharCounter');
                if (counter) counter.textContent = `${draft.feedback.length} / 400`;
            }
            if (draft.category) document.getElementById('categorySelect').value = draft.category;
        } catch (e) {
            console.error(e);
        }
    }

    const dedSaved = localStorage.getItem('safe_cspc_ded_draft') || localStorage.getItem('schoolvoice_ded_draft');
    if (dedSaved) {
        try {
            const draft = JSON.parse(dedSaved);
            if (draft.subject) document.getElementById('dedSubject').value = draft.subject;
            if (draft.message) {
                document.getElementById('dedMessage').value = draft.message;
                const counter = document.getElementById('dedCharCounter');
                if (counter) counter.textContent = `${draft.message.length} / 800`;
            }
            if (draft.category) document.getElementById('dedCategory').value = draft.category;
        } catch (e) {
            console.error(e);
        }
    }
}

/* ==========================================================================
   Settings Actions & Export
   ========================================================================== */
function initSettingsActions() {
    const profileEditor = document.getElementById('profileEditorModal');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const closeProfileEditorBtn = document.getElementById('closeProfileEditorBtn');

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', openProfileEditor);
    }
    if (closeProfileEditorBtn) {
        closeProfileEditorBtn.addEventListener('click', closeProfileEditor);
    }
    if (profileEditor) {
        profileEditor.addEventListener('click', (event) => {
            if (event.target === profileEditor) closeProfileEditor();
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && profileEditor?.classList.contains('show')) {
            closeProfileEditor();
        }
    });

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('settingName');
            const emailInput = document.getElementById('settingEmail');
            const departmentInput = document.getElementById('settingDept');
            const name = nameInput.value.trim();
            const email = emailInput.value.trim().toLowerCase();
            const department = departmentInput.value.trim();

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
                updateProfileDisplay(user);
            } catch (error) {
                console.error('Unable to save profile changes:', error);
                showToast(error.message);
                return;
            }

            closeProfileEditor();
            showToast(`Profile updated for ${name}!`);
        });
    }

    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            localStorage.removeItem('safe_cspc_draft');
            localStorage.removeItem('safe_cspc_ded_draft');
            localStorage.removeItem('schoolvoice_draft');
            localStorage.removeItem('schoolvoice_ded_draft');
            showToast('CSPC S.A.F.E. drafts and cached data cleared!');
        });
    }

    const exportBtn = document.getElementById('exportReportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const rows = [
                ['Tracking ID', 'Category', 'Subject', 'Status', 'Date', 'Upvotes'],
                ...backendFeedback.map(item => [
                    item.id,
                    item.category,
                    item.subject,
                    item.status,
                    new Date(item.createdAt).toISOString(),
                    item.votes
                ])
            ];
            const csvContent = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
            const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "CSPC_SAFE_Analytics_Report.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('CSPC S.A.F.E. Report exported successfully (CSV download started)!');
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await apiRequest('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                console.error('Unable to sign out:', error);
            } finally {
                window.location.replace('onboarding.html');
            }
        });
    }
}

function openProfileEditor() {
    const profileEditor = document.getElementById('profileEditorModal');
    if (!profileEditor) return;
    profileEditor.classList.add('show');
    profileEditor.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('settingName')?.focus();
}

function closeProfileEditor() {
    const profileEditor = document.getElementById('profileEditorModal');
    if (!profileEditor) return;
    profileEditor.classList.remove('show');
    profileEditor.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

/* ==========================================================================
   Confetti Particle Burst Effect (Pure Vanilla JS Canvas)
   ========================================================================== */
function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#00897b', '#2563eb', '#f59e0b', '#10b981', '#0ea5e9'];
    const particles = [];
    const count = 70;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.5) * 16 - 3,
            alpha: 1,
            decay: Math.random() * 0.02 + 0.015
        });
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = 0;

        particles.forEach(p => {
            if (p.alpha > 0) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35;
                p.alpha -= p.decay;

                ctx.save();
                ctx.globalAlpha = Math.max(p.alpha, 0);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                active++;
            }
        });

        if (active > 0) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    render();
}

/* ==========================================================================
   Toast Notification Helper
   ========================================================================== */
let toastTimeout = null;
function showToast(message, duration = 3200) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;

    toast.innerHTML = `${SVGS.check} <span>${escapeHtml(message)}</span>`;
    toast.classList.add('show');

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
