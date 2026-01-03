// Game State
const ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const NOTE_TAKER_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_URL = 'http://127.0.0.1:8787/v1/messages';

let currentSuspect = null;
let suspects = [];
let cluesBySuspect = {};
let discoveredClueIds = new Set();
let chatHistories = {}; // Store chat history per suspect (HTML)
let conversationHistories = {}; // Store LLM message history per suspect
let gameEnded = false;

let scenarioConfig = null;
let systemPrompts = {};
let noteTakerPrompts = {};
let toolsBySuspect = {};
let toolNameToClueId = {};
let clueById = {};
let gameIntro = '';
let gameOutro = '';

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
const notesSuspectPhoto = document.getElementById('notes-suspect-photo');
const cluesList = document.getElementById('clues-list');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverMessage = document.getElementById('game-over-message');
const restartBtn = document.getElementById('restart-btn');
const loadingIndicator = document.getElementById('loading-indicator');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadScenario();
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

async function loadScenario() {
    try {
        startBtn.disabled = true;
        scenarioConfig = await fetchYaml('scenario/game_config.yaml');
        const resources = scenarioConfig.prompt_resources;
        const baseDir = 'scenario/';

        gameIntro = await fetchText(baseDir + resources.game_intro);
        gameOutro = resources.game_outro ? await fetchText(baseDir + resources.game_outro) : '';

        const generalInfo = await fetchText(baseDir + resources.general_information);
        const templateText = await fetchText(baseDir + resources.template);
        const noteTakerTemplateText = await fetchText(baseDir + resources.note_taker_template);

        systemPrompts = {};
        noteTakerPrompts = {};
        toolsBySuspect = {};
        toolNameToClueId = {};
        clueById = {};

        for (const suspect of scenarioConfig.suspects) {
            const suspectData = await fetchYaml(baseDir + suspect.file);

            const clueInstructions = formatClueInstructions(suspectData.clues || []);
            const noteTakerClueInstructions = formatClueChecklist(suspectData.clues || []);
            systemPrompts[suspect.id] = renderTemplate(templateText, {
                CHARACTER_NAME: suspectData.character_name,
                GENERAL_INFORMATION: generalInfo,
                CHARACTER_INFORMATION: suspectData.character_information,
                CLUE_INSTRUCTIONS: clueInstructions
            });
            noteTakerPrompts[suspect.id] = renderTemplate(noteTakerTemplateText, {
                CHARACTER_NAME: suspectData.character_name,
                CLUE_INSTRUCTIONS: noteTakerClueInstructions
            });

            toolsBySuspect[suspect.id] = createClueFunctions(suspectData.clues || []);
            toolNameToClueId[suspect.id] = {};
            for (const clue of suspectData.clues || []) {
                toolNameToClueId[suspect.id][clue.tool_name] = clue.id;
                clueById[clue.id] = clue;
            }
        }

        suspects = scenarioConfig.suspects.map((suspect) => ({
            id: suspect.id,
            name: suspect.name,
            age: suspect.age,
            role: suspect.role,
            image: `static/images/portraits/${suspect.id}.png`
        }));
        cluesBySuspect = initClueBuckets(suspects);
        discoveredClueIds = new Set();

        introText.innerHTML = marked.parse(gameIntro);
        startBtn.disabled = false;
    } catch (error) {
        console.error('Error loading scenario:', error);
        introText.textContent = 'Failed to load game. Please refresh the page.';
        startBtn.disabled = true;
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
            <img src="${suspect.image}" alt="${suspect.name}" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='">
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
    if (notesSuspectPhoto) {
        notesSuspectPhoto.src = suspect.image;
        notesSuspectPhoto.alt = suspect.name;
    }

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

    renderClues();
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
        if (ANTHROPIC_API_URL.includes('YOUR_WORKER_SUBDOMAIN')) {
            throw new Error('Set your Worker URL in static/js/app.js.');
        }
        const result = await generateSuspectReply(currentSuspect.id, message);
        if (result.text) {
            addMessage(result.text, 'suspect');
        }

        let noteTakerToolUses = [];
        try {
            noteTakerToolUses = await runNoteTaker(currentSuspect.id, result.text);
        } catch (error) {
            console.error('Error running note taker:', error);
        }
        const newClues = processToolUses(currentSuspect.id, noteTakerToolUses);
        if (newClues.length > 0) {
            newClues.forEach((clueText) => addClueNotification(clueText));
            renderClues();
        }

        if (gameEnded) {
            handleGameOver(gameOutro);
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

async function generateSuspectReply(suspectId, userMessage) {
    const history = conversationHistories[suspectId] || [];
    const messages = history.concat([{ role: 'user', content: userMessage }]);

    const payload = {
        model: ANTHROPIC_MODEL,
        max_tokens: 512,
        system: systemPrompts[suspectId],
        messages: messages
    };

    const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'LLM request failed');
    }

    const data = await response.json();
    const content = data.content || [];

    const textParts = content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');

    // Store message history for this suspect
    if (!conversationHistories[suspectId]) {
        conversationHistories[suspectId] = [];
    }

    conversationHistories[suspectId].push({ role: 'user', content: userMessage });

    conversationHistories[suspectId].push({ role: 'assistant', content: textParts });

    return { text: textParts };
}

async function runNoteTaker(suspectId, suspectResponse) {
    if (!suspectResponse || !suspectResponse.trim()) {
        return [];
    }

    const tools = toolsBySuspect[suspectId] || [];
    if (tools.length === 0) {
        return [];
    }

    const payload = {
        model: NOTE_TAKER_MODEL,
        max_tokens: 256,
        system: noteTakerPrompts[suspectId],
        messages: [
            { role: 'user', content: `Suspect response:\n${suspectResponse}` }
        ],
        tools: tools
    };

    const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Note taker request failed');
    }

    const data = await response.json();
    const content = data.content || [];

    return content.filter(item => item.type === 'tool_use');
}

function processToolUses(suspectId, toolUses) {
    const newClues = [];
    for (const toolUse of toolUses) {
        const clueId = toolNameToClueId[suspectId]?.[toolUse.name];
        if (!clueId || hasClue(clueId)) {
            continue;
        }
        const clue = clueById[clueId];
        if (!clue) {
            continue;
        }

        discoveredClueIds.add(clueId);
        const aboutSuspects = normalizeAboutSuspects(clue.about_suspects);
        const targets = aboutSuspects.length ? aboutSuspects : ['misc'];
        targets.forEach((suspectKey) => {
            if (!cluesBySuspect[suspectKey]) {
                cluesBySuspect[suspectKey] = [];
            }
            cluesBySuspect[suspectKey].push(clue.clue_text);
        });
        newClues.push(clue.clue_text);

        if (
            scenarioConfig.win_condition &&
            scenarioConfig.win_condition.suspect_id === suspectId &&
            scenarioConfig.win_condition.tool_id === clueId
        ) {
            gameEnded = true;
        }
    }

    return newClues;
}

function hasClue(clueId) {
    return discoveredClueIds.has(clueId);
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
    const totalClues = Object.values(cluesBySuspect)
        .reduce((sum, bucket) => sum + bucket.length, 0);
    if (totalClues === 0) {
        cluesList.innerHTML = '<div class="no-clues">No clues discovered yet.</div>';
        return;
    }

    cluesList.innerHTML = '';

    if (!currentSuspect) {
        cluesList.innerHTML = '<div class="no-clues">Select a suspect to view notes.</div>';
        return;
    }

    const sections = [{
        id: currentSuspect.id,
        title: currentSuspect.name,
        bio: formatSuspectBio(currentSuspect)
    }];

    sections.forEach((section) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'clue-section';
        sectionDiv.innerHTML = `<div class="clue-section-title">${section.title}</div>`;
        if (section.bio) {
            const bioDiv = document.createElement('div');
            bioDiv.className = 'clue-section-bio';
            bioDiv.textContent = section.bio;
            sectionDiv.appendChild(bioDiv);
        }

        const items = cluesBySuspect[section.id] || [];
        if (items.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'no-clues';
            emptyDiv.textContent = 'No clues in this section yet.';
            sectionDiv.appendChild(emptyDiv);
        } else {
            const list = document.createElement('ul');
            list.className = 'clue-list';
            items.forEach((clueText) => {
                const item = document.createElement('li');
                item.className = 'clue-list-item';
                item.innerHTML = `<div class="clue-text">${marked.parse(clueText)}</div>`;
                list.appendChild(item);
            });
            sectionDiv.appendChild(list);
        }

        cluesList.appendChild(sectionDiv);
    });
}

function formatSuspectBio(suspect) {
    const parts = [];
    if (suspect.age) {
        parts.push(`${suspect.age}`);
    }
    if (suspect.role) {
        parts.push(suspect.role);
    }
    if (parts.length === 0) {
        return '';
    }
    return `${parts.join(' - ')}.`;
}

function revealAllCluesPreview() {
    cluesBySuspect = initClueBuckets(suspects);
    discoveredClueIds = new Set();

    Object.values(clueById).forEach((clue) => {
        if (!clue || !clue.id) {
            return;
        }
        discoveredClueIds.add(clue.id);
        const aboutSuspects = normalizeAboutSuspects(clue.about_suspects);
        const targets = aboutSuspects.length ? aboutSuspects : ['misc'];
        targets.forEach((suspectKey) => {
            if (!cluesBySuspect[suspectKey]) {
                cluesBySuspect[suspectKey] = [];
            }
            cluesBySuspect[suspectKey].push(clue.clue_text);
        });
    });

    renderClues();
}

window.revealAllCluesPreview = revealAllCluesPreview;

function initClueBuckets(suspectList) {
    const buckets = { misc: [] };
    suspectList.forEach((suspect) => {
        buckets[suspect.id] = [];
    });
    return buckets;
}

function normalizeAboutSuspects(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        const cleaned = trimmed.replace(/^\[/, '').replace(/\]$/, '');
        return cleaned
            .split(',')
            .map((item) => item.replace(/^['"]|['"]$/g, '').trim())
            .filter(Boolean);
    }
    return [];
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

async function fetchText(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }
    return response.text();
}

async function fetchYaml(path) {
    const text = await fetchText(path);
    return window.jsyaml.load(text);
}

function renderTemplate(template, values) {
    let output = template;
    for (const [key, value] of Object.entries(values)) {
        const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        output = output.replace(pattern, value);
    }
    return output;
}

function formatClueInstructions(clues) {
    if (!clues.length) {
        return 'You have no specific clues to reveal.';
    }

    const lines = [];
    lines.push('You have the following clues available:\n');

    for (const clue of clues) {
        lines.push(`### Tool: \`${clue.tool_name}\``);
        lines.push(`**Clue ID**: ${clue.id}`);
        lines.push(`**Difficulty**: ${clue.difficulty}`);
        lines.push(`**Description**: ${clue.description}`);
        lines.push(`\n**When to reveal**:\n${clue.trigger_guidance}`);
        lines.push(`\n**What will be added to detective's notes**:\n${clue.clue_text}\n`);
        lines.push('---\n');
    }

    return lines.join('\n');
}

function formatClueChecklist(clues) {
    if (!clues.length) {
        return 'No clue tools are available for this suspect.';
    }

    const lines = [];
    lines.push('Match the response to these tools and clue texts:\n');

    for (const clue of clues) {
        lines.push(`### Tool: \`${clue.tool_name}\``);
        lines.push(`**Clue ID**: ${clue.id}`);
        lines.push(`**Description**: ${clue.description}`);
        lines.push(`**Trigger guidance**: ${clue.trigger_guidance}`);
        lines.push(`**Clue text**: ${clue.clue_text}\n`);
        lines.push('---\n');
    }

    return lines.join('\n');
}

function createClueFunctions(clues) {
    return clues.map((clue) => ({
        name: clue.tool_name,
        description: `${clue.description} (Difficulty: ${clue.difficulty})`,
        input_schema: {
            type: 'object',
            properties: {},
            required: []
        }
    }));
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
