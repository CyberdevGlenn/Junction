console.log("Junction Loaded");

// Dark Mode Functionality (robust across pages)
const togglesSelector = '.dark-mode-toggle';

function applyDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
    }
    updateToggleStates();
}

function updateToggleStates() {
    const toggles = document.querySelectorAll(togglesSelector);
    toggles.forEach(btn => {
        // keep accessibility state in sync
        btn.setAttribute('aria-pressed', document.body.classList.contains('dark-mode') ? 'true' : 'false');
    });
}

function initializeDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedMode !== null) {
        applyDarkMode(savedMode === 'true');
    } else {
        applyDarkMode(!!prefersDark);
    }
}

function setupToggleListeners() {
    const toggles = document.querySelectorAll(togglesSelector);
    if (!toggles || toggles.length === 0) return;

    toggles.forEach(btn => {
        // ensure button is keyboard accessible and has role
        if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
        if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            applyDarkMode(!document.body.classList.contains('dark-mode'));
        });

        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });
}

function watchSystemPreference() {
    if (!window.matchMedia) return;
    try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => {
            // only follow system changes if user has not explicitly set a preference
            if (localStorage.getItem('darkMode') === null) {
                applyDarkMode(e.matches);
            }
        };

        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', handler);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(handler);
        }
    } catch (err) {
        // ignore
    }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDarkMode();
        setupToggleListeners();
        watchSystemPreference();
    });
} else {
    initializeDarkMode();
    setupToggleListeners();
    watchSystemPreference();
}


// ===== LIVE CHAT FUNCTIONALITY =====

class LiveChat {
    constructor() {
        this.username = localStorage.getItem('chatUsername') || null;
        this.userId = localStorage.getItem('chatUserId') || this.generateUserId();
        this.messages = [];
        // start minimized by default
        this.isMinimized = true;
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
        // avoid duplicate widget
        if (document.getElementById('chat-widget')) return;

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
                    <button class="chat-minimize-btn" id="chat-minimize" aria-label="Minimize chat">−</button>
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
                    <button class="chat-send-btn" id="chat-send-btn" aria-label="Send message">➤</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);

        // reflect initial minimized state and update button/icon
        const widget = document.getElementById('chat-widget');
        const minimizeBtn = document.getElementById('chat-minimize');
        if (minimizeBtn) {
            minimizeBtn.setAttribute('aria-label', this.isMinimized ? 'Open chat' : 'Minimize chat');
            minimizeBtn.textContent = this.isMinimized ? '💬' : '−';
        }
        if (this.isMinimized && widget) {
            widget.classList.add('minimized');
        }
    }

    attachEventListeners() {
        const minimizeBtn = document.getElementById('chat-minimize');
        const sendBtn = document.getElementById('chat-send-btn');
        const input = document.getElementById('chat-input');
        const header = document.querySelector('.chat-header');

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
        }

        if (header) {
            header.addEventListener('click', () => {
                if (this.isMinimized) {
                    this.toggleMinimize();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    toggleMinimize() {
        const widget = document.getElementById('chat-widget');
        this.isMinimized = !this.isMinimized;
        if (widget) widget.classList.toggle('minimized');

        const minimizeBtn = document.getElementById('chat-minimize');
        if (minimizeBtn) {
            minimizeBtn.setAttribute('aria-label', this.isMinimized ? 'Open chat' : 'Minimize chat');
            // use emoji when closed to make it obvious and easier to tap
            minimizeBtn.textContent = this.isMinimized ? '💬' : '−';
        }
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
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'message') {
                        this.addMessage(data.username, data.message, data.userId, data.timestamp);
                    }
                } catch (e) {
                    console.log('Invalid WS message', e);
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
            if (statusDot) {
                statusDot.style.background = connected ? '#4ade80' : '#ef4444';
            }
        }
    }

    sendMessage() {
        const input = document.getElementById('chat-input');
        if (!input) return;
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
        if (!messagesDiv) return;

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

        usernameInput && usernameInput.focus();

        usernameSubmit && usernameSubmit.addEventListener('click', () => {
            const username = (usernameInput && usernameInput.value.trim()) || '';
            if (username) {
                this.setUsername(username);
                messagesDiv.innerHTML = '';
                this.loadMessagesFromStorage();
                if (firstMessage) {
                    // put firstMessage into input then send
                    const input = document.getElementById('chat-input');
                    if (input) {
                        input.value = firstMessage;
                        this.sendMessage();
                    }
                }
            }
        });

        usernameInput && usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                usernameSubmit && usernameSubmit.click();
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
        if (!messagesDiv) return;
        const isOwn = userId === this.userId;

        const timeObj = new Date(timestamp);
        const time = timeObj.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });

        const initials = (username || '').substring(0, 2).toUpperCase();

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
        if (!messagesDiv) return;
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 0);
    }

    saveMessagesToStorage() {
        localStorage.setItem('chatMessages', JSON.stringify(this.messages.slice(-50))); // Keep last 50
    }

    loadMessagesFromStorage() {
        const stored = localStorage.getItem('chatMessages');
        const messagesDiv = document.getElementById('chat-messages');
        if (!messagesDiv) return;

        if (stored) {
            try {
                this.messages = JSON.parse(stored);
                messagesDiv.innerHTML = '';

                this.messages.forEach(msg => {
                    // reuse addMessage but avoid double-saving
                    const time = msg.timestamp || new Date().toISOString();
                    const username = msg.username || 'Guest';
                    const message = msg.message || '';
                    const userId = msg.userId || 'unknown';

                    const isOwn = userId === this.userId;
                    const initials = (username || '').substring(0,2).toUpperCase();

                    const messageHTML = `
                        <div class="message ${isOwn ? 'own' : ''}">
                            ${!isOwn ? `<div class="message-avatar">${initials}</div>` : ''}
                            <div>
                                <div class="message-bubble">${this.escapeHtml(message)}</div>
                                <div class="message-time">${new Date(time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true})}</div>
                            </div>
                        </div>
                    `;

                    messagesDiv.insertAdjacentHTML('beforeend', messageHTML);
                });

                this.scrollToBottom();
            } catch (e) {
                console.log('Error loading stored messages:', e);
            }
        } else {
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
