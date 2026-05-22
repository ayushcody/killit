document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Show Code Toggles
    const showCodeBtns = document.querySelectorAll('.show-code');

    showCodeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-code');
            const codeSnippet = document.getElementById(targetId);

            if (codeSnippet.classList.contains('hidden')) {
                codeSnippet.classList.remove('hidden');
                btn.textContent = 'Hide code';
                btn.style.background = 'var(--primary)';
                btn.style.color = '#fff';
            } else {
                codeSnippet.classList.add('hidden');
                btn.textContent = 'Show me the code';
                btn.style.background = 'var(--surface)';
                btn.style.color = 'var(--primary)';
            }
        });
    });
});
