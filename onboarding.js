/**
 * CSPC S.A.F.E. - Onboarding Page Interactivity
 * Handles account access and the About dialog
 */

document.addEventListener('DOMContentLoaded', () => {
    initOnboardingModals();
});

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'same-origin'
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || result.message || 'The request could not be completed.');
    }
    return result;
}

function initOnboardingModals() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const getStartedBtn = document.getElementById('getStartedBtn');
    const aboutBtn = document.getElementById('aboutBtn');

    const authModal = document.getElementById('authModal');
    const authTitle = document.getElementById('authModalTitle');
    const closeAuthBtn = document.getElementById('closeAuthModal');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const authFormStatus = document.getElementById('authFormStatus');
    const resetAuthForms = () => {
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();
        if (authFormStatus) authFormStatus.textContent = '';
    };
    const aboutModal = document.getElementById('aboutModal');
    const closeAboutBtn = document.getElementById('closeAboutModal');
    const closeAboutIconBtn = document.getElementById('closeAboutIconBtn');

    const showAuthForm = (mode) => {
        resetAuthForms();
        const isSignup = mode === 'signup';
        loginForm.hidden = isSignup;
        signupForm.hidden = !isSignup;
        authTitle.textContent = isSignup ? 'Create a S.A.F.E. account' : 'Login to S.A.F.E.';
        authFormStatus.textContent = '';
        if (!authModal.classList.contains('active')) {
            openModal(authModal);
        }
        (isSignup ? document.getElementById('signupName') : document.getElementById('loginEmail')).focus();
    };

    if (loginBtn) {
        loginBtn.addEventListener('click', () => showAuthForm('login'));
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', () => showAuthForm('signup'));
    }

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthForm('login');
        });
    }

    const showSignupBtn = document.getElementById('showSignupBtn');
    if (showSignupBtn) showSignupBtn.addEventListener('click', () => showAuthForm('signup'));

    const showLoginBtn = document.getElementById('showLoginBtn');
    if (showLoginBtn) showLoginBtn.addEventListener('click', () => showAuthForm('login'));

    const signupPassword = document.getElementById('signupPassword');
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    const validateSignupPassword = () => {
        if (signupConfirmPassword && signupPassword) {
            signupConfirmPassword.setCustomValidity(
                signupConfirmPassword.value && signupConfirmPassword.value !== signupPassword.value
                    ? 'Passwords do not match.'
                    : ''
            );
        }
    };
    if (signupPassword && signupConfirmPassword) {
        signupPassword.addEventListener('input', validateSignupPassword);
        signupConfirmPassword.addEventListener('input', validateSignupPassword);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = loginForm.querySelector('[type="submit"]');
            submitButton.disabled = true;
            authFormStatus.textContent = 'Checking your account...';

            try {
                const email = loginForm.elements.email.value.trim().toLowerCase();
                const password = loginForm.elements.password.value;
                const { user } = await apiRequest('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                authFormStatus.textContent = 'Login successful. Opening the dashboard...';

                window.location.replace(getRoleHome(user));
            } catch (error) {
                console.error('Login failed:', error);
                authFormStatus.textContent = error instanceof Error
                    ? error.message
                    : 'Unable to log in. Please try again.';
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = signupForm.querySelector('[type="submit"]');
            submitButton.disabled = true;
            authFormStatus.textContent = 'Creating your account...';

            try {
                const name = signupForm.elements.name.value.trim();
                const email = signupForm.elements.email.value.trim().toLowerCase();
                const password = signupForm.elements.password.value;
                if (!name) {
                    authFormStatus.textContent = 'Enter your full name to register.';
                    return;
                }
                await apiRequest('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ name, email, password })
                });
                authFormStatus.textContent = 'Account created. Opening the dashboard...';
                window.location.replace('index.html');
            } catch (error) {
                console.error('Registration failed:', error);
                authFormStatus.textContent = error instanceof Error
                    ? error.message
                    : 'Unable to create an account. Please try again.';
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    // Open About Modal
    if (aboutBtn) {
        aboutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(aboutModal);
        });
    }

    // Modal Close Triggers
    if (closeAuthBtn) {
        closeAuthBtn.addEventListener('click', () => closeModal(authModal));
    }

    if (closeAboutBtn) {
        closeAboutBtn.addEventListener('click', () => closeModal(aboutModal));
    }

    if (closeAboutIconBtn) {
        closeAboutIconBtn.addEventListener('click', () => closeModal(aboutModal));
    }

    // Click outside to close
    [authModal, aboutModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(modal);
                }
            });
        }
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(authModal);
            closeModal(aboutModal);
        }
    });
}

// Role-based redirect router
function getRoleHome(user) {
    if (user && user.role === 'faculty') return 'faculty.html';
    if (user && user.role === 'guidance') return 'guidance.html';
    if (user && user.role === 'admin') return 'admin.html';
    if (user && user.role === 'gsu') return 'gsu.html';
    if (user && user.role === 'mict') return 'stakeholder.html';
    return 'index.html';
}

function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Clear login & signup forms whenever authModal closes
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const authFormStatus = document.getElementById('authFormStatus');
    if (loginForm) loginForm.reset();
    if (signupForm) signupForm.reset();
    if (authFormStatus) authFormStatus.textContent = '';
}