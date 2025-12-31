// Game State
let currentSuspect = null;
let suspects = [];
let clues = [];
let chatHistories = {}; // Store chat history per suspect
let gameEnded = false;

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const introText = document.getElementById('intro-text');
const suspectsList = document.getElementById('suspects-list');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const currentSuspectName = document.getElementById('current-suspect-name');
const cluesList = document.getElementById('clues-list');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverMessage = document.getElementById('game-over-message');
const restartBtn = document.getElementById('restart-btn');
const loadingIndicator = document.getElementById('loading-indicator');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadIntro();
    setupEventListeners();
});

function setupEventListeners() {
    startBtn.addEventListener('click', startGame);
    sendBtn.addEventListener('click', sendMessage);
    restartBtn.addEventListener('click', restartGame);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !sendBtn.disabled) {
            sendMessage();
        }
    });
}

// API Calls
async function loadIntro() {
    try {
        const response = await fetch('/api/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            introText.innerHTML = marked.parse(data.intro);
            suspects = data.suspects;
        }
    } catch (error) {
        console.error('Error loading intro:', error);
        introText.textContent = 'Failed to load game. Please refresh the page.';
    }
}

function startGame() {
    welcomeScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    // Render suspects
    renderSuspects();
}

function renderSuspects() {
    suspectsList.innerHTML = '';
    
    suspects.forEach(suspect => {
        const card = document.createElement('div');
        card.className = 'suspect-card';
        card.dataset.suspectId = suspect.id;
        
        card.innerHTML = `
            <img src="${suspect.image}" alt="${suspect.name}" onerror="this.src='/static/images/portraits/placeholder.jpg'">
            <div class="suspect-name">${suspect.name}</div>
        `;
        
        card.addEventListener('click', () => selectSuspect(suspect));
        suspectsList.appendChild(card);
    });
}

function selectSuspect(suspect) {
    // If clicking the same suspect, just focus input and return
    if (currentSuspect && currentSuspect.id === suspect.id) {
        chatInput.focus();
        return;
    }
    
    // Save current chat history if switching suspects
    if (currentSuspect) {
        chatHistories[currentSuspect.id] = chatMessages.innerHTML;
    }
    
    currentSuspect = suspect;
    
    // Update UI
    document.querySelectorAll('.suspect-card').forEach(card => {
        card.classList.remove('active');
    });
    
    document.querySelector(`[data-suspect-id="${suspect.id}"]`).classList.add('active');
    currentSuspectName.textContent = suspect.name;
    
    // Enable chat
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
    
    // Restore chat history or show intro message
    if (chatHistories[suspect.id]) {
        // Restore previous conversation
        chatMessages.innerHTML = chatHistories[suspect.id];
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
        // First time talking to this suspect
        chatMessages.innerHTML = `
            <div class="message system-message">
                You are now interrogating ${suspect.name}. Ask your questions carefully.
            </div>
        `;
        // Initialize empty history
        chatHistories[suspect.id] = chatMessages.innerHTML;
    }
}

async function sendMessage() {
    if (gameEnded || !currentSuspect || !chatInput.value.trim()) return;
    
    const message = chatInput.value.trim();
    chatInput.value = '';
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Disable input while waiting for response
    chatInput.disabled = true;
    sendBtn.disabled = true;
    showLoading();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                suspect_id: currentSuspect.id,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Add suspect response
            addMessage(data.response, 'suspect');
            
            // Update clues if any new ones
            if (data.clues && data.clues.length > clues.length) {
                const newClues = data.clues.slice(clues.length);
                newClues.forEach(clue => {
                    addClueNotification(clue);
                });
                clues = data.clues;
                renderClues();
            }
            
            // Check if game is over
            if (data.game_over) {
                gameEnded = true;
                handleGameOver(data.ending);
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addMessage('Error: Could not send message. Please try again.', 'system-message');
    } finally {
        hideLoading();
        if (!gameEnded) {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }
}

function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    // Render markdown for all message types
    if (type === 'system-message') {
        messageDiv.innerHTML = text; // System messages are already formatted
    } else {
        messageDiv.innerHTML = marked.parse(text);
    }
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Save updated chat history
    if (currentSuspect) {
        chatHistories[currentSuspect.id] = chatMessages.innerHTML;
    }
}

function addClueNotification(clue) {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'message clue-revealed';
    notificationDiv.innerHTML = `
        <div class="clue-title">New Clue Discovered</div>
        <div class="clue-body">${marked.parse(clue)}</div>
    `;
    chatMessages.appendChild(notificationDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Save updated chat history
    if (currentSuspect) {
        chatHistories[currentSuspect.id] = chatMessages.innerHTML;
    }
}

function handleGameOver(endingText) {
    // Prevent new messages immediately
    chatInput.disabled = true;
    sendBtn.disabled = true;

    // Highlight the last suspect message
    const suspectMessages = chatMessages.querySelectorAll('.message.suspect');
    const lastSuspectMessage = suspectMessages[suspectMessages.length - 1];
    if (lastSuspectMessage) {
        lastSuspectMessage.classList.add('pulse-highlight');
    }

    // Show outro after a brief pause
    setTimeout(() => {
        showGameOver(endingText);
    }, 5000);
}

function renderClues() {
    if (clues.length === 0) {
        cluesList.innerHTML = '<div class="no-clues">No clues discovered yet.</div>';
        return;
    }
    
    cluesList.innerHTML = '';
    
    clues.forEach((clue, index) => {
        const clueDiv = document.createElement('div');
        clueDiv.className = 'clue-item';
        clueDiv.innerHTML = `
            <div class="clue-text">${marked.parse(clue)}</div>
        `;
        cluesList.appendChild(clueDiv);
    });
}

function showGameOver(endingText) {
    if (endingText) {
        gameOverMessage.innerHTML = marked.parse(endingText);
    } else {
        gameOverMessage.textContent = 'Congratulations! The suspect has confessed. The case is solved!';
    }
    gameOverModal.classList.add('active');
}

function restartGame() {
    window.location.reload();
}

function showLoading() {
    loadingIndicator.classList.add('active');
}

function hideLoading() {
    loadingIndicator.classList.remove('active');
}

// Markdown parser
const marked = {
    parse: function(text) {
        if (!text) return '';
        
        // Split into paragraphs first
        let html = text
            // Headers (must be at start of line)
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Code blocks (triple backticks)
            .replace(/```[\s\S]*?```/g, function(match) {
                return '<pre><code>' + match.slice(3, -3).trim() + '</code></pre>';
            })
            // Inline code
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // Unordered lists
            .replace(/^\- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Line breaks and paragraphs
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap in paragraph if not already wrapped
        if (!html.startsWith('<h') && !html.startsWith('<p') && !html.startsWith('<ul')) {
            html = '<p>' + html + '</p>';
        }
        
        return html;
    }
};

