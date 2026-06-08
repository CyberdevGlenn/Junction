console.log("Junction Loaded");

// Dark Mode Functionality
const darkModeToggle = document.querySelector('.dark-mode-toggle');
const htmlElement = document.documentElement;

// Check for saved dark mode preference or system preference
function initializeDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedMode !== null) {
        // Use saved preference
        if (savedMode === 'true') {
            enableDarkMode();
        }
    } else if (prefersDark) {
        // Use system preference
        enableDarkMode();
    }
}

// Enable dark mode
function enableDarkMode() {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
}

// Disable dark mode
function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
}

// Toggle dark mode
function toggleDarkMode() {
    if (document.body.classList.contains('dark-mode')) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

// Initialize dark mode immediately (script runs at end of body, so DOM is ready)
initializeDarkMode();

// Add click listener to toggle button
if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
}
