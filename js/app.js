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

// ===== LIVE CHAT FUNCTIONALITY =====

class LiveChat {
    constructor() {
        this.username = localStorage.getItem('chatUsername') || null;
        this.userId = localStorage.getItem('chatUserId') || this.generateUserId();
        this.messages = [];
        this.isMinimized = false;
        this.wsConnection = null;
        this.init();
    }

    generateUserId() {
        const id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('chatUserId', id);
        return id;
    }

    init() {
        // Create chat widget HTML
        this.createChatWidget();
        this.attachEventListeners();
        
        // Try to connect to WebSocket (will connect when backend is ready)
        this.connectWebSocket();
        
        // Load messages from localStorage (for offline functionality)
        this.loadMessagesFromStorage();
    }

    createChatWidget() {
        const chatHTML = `
            <div class="chat-widget" id="chat-widget">
                <div class="chat-header">
                    <div>
                        <h3>💬 Live Chat</h3>
                        <div class="chat-header-status">
                            <div class="status-dot"></div>
                            <span id="chat-status">Connecting...</span>
                        </div>
                    </div>
                    <button class="chat-minimize-btn" id="chat-minimize">−</button>
                </div>

                <div id="chat-content" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                    <div class="chat-messages" id="chat-messages"></div>
                </div>

                <div class="chat-input-area" id="chat-input-area">
                    <input 
                        type="text" 
                        class="chat-input" 
                        id="chat-input" 
                        placeholder="Type a message..."
                        autocomplete="off"
                    />
                    <button class="chat-send-btn" id="chat-send-btn">➤</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    attachEventListeners() {
        const minimizeBtn = document.getElementById('chat-minimize');
        const sendBtn = document.getElementById('chat-send-btn');
        const input = document.getElementById('chat-input');
        const header = document.querySelector('.chat-header');

        // Minimize/Maximize
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });

        header.addEventListener('click', () => {
            if (this.isMinimized) {
                this.toggleMinimize();
            }
        });

        // Send message
        sendBtn.addEventListener('click', () => this.sendMessage());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    toggleMinimize() {
        const widget = document.getElementById('chat-widget');
        this.isMinimized = !this.isMinimized;
        widget.classList.toggle('minimized');
    }

    connectWebSocket() {
        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            this.wsConnection = new WebSocket(wsUrl);

            this.wsConnection.onopen = () => {
                console.log('WebSocket connected');
                this.updateStatus('Connected', true);
                this.wsConnection.send(JSON.stringify({
                    type: 'join',
                    userId: this.userId,
                    username: this.username
                }));
            };

            this.wsConnection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'message') {
                    this.addMessage(data.username, data.message, data.userId, data.timestamp);
                }
            };

            this.wsConnection.onerror = (error) => {
                console.log('WebSocket error:', error);
                this.updateStatus('Offline', false);
            };

            this.wsConnection.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateStatus('Offline', false);
                // Attempt reconnect after 3 seconds
                setTimeout(() => this.connectWebSocket(), 3000);
            };
        } catch (error) {
            console.log('WebSocket connection failed:', error);
            this.updateStatus('Offline', false);
        }
    }

    updateStatus(status, connected) {
        const statusEl = document.getElementById('chat-status');
        const statusDot = document.querySelector('.status-dot');
        
        if (statusEl) {
            statusEl.textContent = status;
            if (connected) {
                statusDot.style.background = '#4ade80';
            } else {
                statusDot.style.background = '#ef4444';
            }
        }
    }

    sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        // If username not set, show setup dialog
        if (!this.username) {
            this.showUsernameSetup(message);
            return;
        }

        // Send via WebSocket if connected
        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify({
                type: 'message',
                message: message,
                userId: this.userId,
                username: this.username
            }));
        } else {
            // Fallback: Add to local messages and save
            this.addMessage(this.username, message, this.userId, new Date().toISOString());
        }

        input.value = '';
        this.scrollToBottom();
    }

    showUsernameSetup(firstMessage = '') {
        const messagesDiv = document.getElementById('chat-messages');
        messagesDiv.innerHTML = `
            <div class="chat-username-setup">
                <h4>What's your name?</h4>
                <input 
                    type="text" 
                    id="username-input" 
                    placeholder="Enter your username..."
                    maxlength="20"
                />
                <button id="username-submit">Start Chatting!</button>
            </div>
        `;

        const usernameInput = document.getElementById('username-input');
        const usernameSubmit = document.getElementById('username-submit');

        usernameInput.focus();

        usernameSubmit.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            if (username) {
                this.setUsername(username);
                messagesDiv.innerHTML = '';
                this.loadMessagesFromStorage();
                if (firstMessage) {
                    this.sendMessage();
                }
            }
        });

        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                usernameSubmit.click();
            }
        });
    }

    setUsername(username) {
        this.username = username;
        localStorage.setItem('chatUsername', username);

        // Notify server of username
        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify({
                type: 'username_set',
                userId: this.userId,
                username: username
            }));
        }
    }

    addMessage(username, message, userId, timestamp) {
        const messagesDiv = document.getElementById('chat-messages');
        const isOwn = userId === this.userId;

        const timeObj = new Date(timestamp);
        const time = timeObj.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });

        const initials = username.substring(0, 2).toUpperCase();

        const messageHTML = `
            <div class="message ${isOwn ? 'own' : ''}">
                ${!isOwn ? `<div class="message-avatar">${initials}</div>` : ''}
                <div>
                    <div class="message-bubble">${this.escapeHtml(message)}</div>
                    <div class="message-time">${time}</div>
                </div>
            </div>
        `;

        messagesDiv.insertAdjacentHTML('beforeend', messageHTML);
        this.messages.push({ username, message, userId, timestamp });
        this.saveMessagesToStorage();
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messagesDiv = document.getElementById('chat-messages');
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 0);
    }

    saveMessagesToStorage() {
        localStorage.setItem('chatMessages', JSON.stringify(this.messages.slice(-50))); // Keep last 50
    }

    loadMessagesFromStorage() {
        const stored = localStorage.getItem('chatMessages');
        if (stored) {
            try {
                this.messages = JSON.parse(stored);
                const messagesDiv = document.getElementById('chat-messages');
                messagesDiv.innerHTML = '';

                this.messages.forEach(msg => {
                    this.addMessage(msg.username, msg.message, msg.userId, msg.timestamp);
                });
            } catch (e) {
                console.log('Error loading stored messages:', e);
            }
        } else {
            const messagesDiv = document.getElementById('chat-messages');
            messagesDiv.innerHTML = '<div class="empty-state">👋 Be the first to say hello!</div>';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize chat when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LiveChat();
    });
} else {
    new LiveChat();
}
