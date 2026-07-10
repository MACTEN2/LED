// Shared client behavior for every authenticated page: modal open/close,
// mobile sidebar drawer, live clock. No inline <script> blocks in views,
// so this file stays compatible with the app's CSP (script-src 'self').

document.addEventListener('DOMContentLoaded', () => {
    // Modal open/close (data-modal-target / data-modal-close attributes)
    document.querySelectorAll('[data-modal-open]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById(btn.dataset.modalOpen);
            if (modal) modal.classList.add('open');
        });
    });

    document.querySelectorAll('[data-modal-close]').forEach((btn) => {
        btn.addEventListener('click', () => {
            btn.closest('.modal')?.classList.remove('open');
        });
    });

    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.classList.remove('open');
        });
    });

    // Mobile sidebar drawer
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Live clock in the top bar
    const clock = document.getElementById('topbar-clock');
    if (clock) {
        const tick = () => { clock.textContent = new Date().toLocaleString(); };
        tick();
        setInterval(tick, 1000);
    }

    // Print-to-PDF trigger (report view)
    document.querySelectorAll('[data-print]').forEach((btn) => {
        btn.addEventListener('click', () => window.print());
    });

    // Confirm destructive/consequential actions
    document.querySelectorAll('[data-confirm]').forEach((form) => {
        form.addEventListener('submit', (event) => {
            if (!window.confirm(form.dataset.confirm)) event.preventDefault();
        });
    });
});
