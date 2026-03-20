/**
 * Crow's Sweet Cage - Main Application
 * 恋愛脱出ゲーム
 */

// ========================================
// Constants
// ========================================

const SAVE_KEY_PREFIX = 'crows_cage_save_';
const SETTINGS_KEY = 'crows_cage_settings';
const GAME_SETTINGS_KEY = 'crows_cage_game_settings';
const USER_API_KEY_STORAGE_KEY = 'crows_cage_user_api_key';
const DAILY_TURN_KEY = 'crows_cage_daily_turns';
const MAX_DAILY_TURNS = 15;
const MAX_SAVE_SLOTS = 3;

// Safety settings for Gemini API (relaxed for romance game content)
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

/**
 * Check if API response was blocked by safety filters.
 * Returns { blocked: true, reason: string } or { blocked: false }.
 */
function checkSafetyBlock(data) {
    // Check promptFeedback for input-level blocks
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
        return { blocked: true, reason: blockReason };
    }

    // Check candidate-level finish reason
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
        return { blocked: true, reason: 'SAFETY' };
    }

    // Check if response is empty (no candidates at all)
    if (!data.candidates || data.candidates.length === 0) {
        return { blocked: true, reason: 'NO_CANDIDATES' };
    }

    return { blocked: false };
}

function addSafetyBlockMessage() {
    const div = document.createElement('div');
    div.className = 'message message-system';
    div.innerHTML = '⚠️ AIの安全フィルタにより応答が生成できませんでした。<br>別の言い回しで入力してみてください。';
    elements.chatArea.appendChild(div);
    scrollToBottom();
}

// Default character settings
const DEFAULT_SETTINGS = {
    playerName: 'ひより',
    partnerName: 'クロウ',
    partnerPersonality: 'クールだが独占欲が強い。甘い言葉で相手を惑わし、脱出を阻止しようとする',
    partnerFirstPerson: '俺',
    partnerSecondPerson: 'お前',
    relationship: '愛しすぎるがゆえに、部屋に閉じ込めている男',
    gameSetting: '豪華な部屋。シルクのシーツ、アンティークの家具、薄暗い照明'
};

// ========================================
// Game State
// ========================================

const gameState = {
    escapeProgress: 0,
    loveTrap: 0,
    history: [],
    turnLogs: [],
    isProcessing: false,
    isGameOver: false,
    pendingEnding: null,
    currentEpilogue: '',
    userApiKey: localStorage.getItem(USER_API_KEY_STORAGE_KEY) || ''
};

// Load settings from storage
function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let characterSettings = loadSettings();

// Game display settings
const DEFAULT_GAME_SETTINGS = {
    showHint: true,
    showParamChange: true
};

function loadGameSettings() {
    const saved = localStorage.getItem(GAME_SETTINGS_KEY);
    if (saved) {
        try {
            return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
            return { ...DEFAULT_GAME_SETTINGS };
        }
    }
    return { ...DEFAULT_GAME_SETTINGS };
}

function saveGameSettings(settings) {
    localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify(settings));
}

let gameSettings = loadGameSettings();

// ========================================
// DOM Elements
// ========================================

const elements = {
    chatArea: document.getElementById('chatArea'),
    inputForm: document.getElementById('inputForm'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    escapeGauge: document.getElementById('escapeGauge'),
    escapeValue: document.getElementById('escapeValue'),
    loveGauge: document.getElementById('loveGauge'),
    loveValue: document.getElementById('loveValue'),
    menuBtn: document.getElementById('menuBtn'),
    menuOverlay: document.getElementById('menuOverlay'),
    menuClose: document.getElementById('menuClose'),
    newGameBtn: document.getElementById('newGameBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadBtn: document.getElementById('loadBtn'),
    saveLoadOverlay: document.getElementById('saveLoadOverlay'),
    saveLoadTitle: document.getElementById('saveLoadTitle'),
    saveLoadSlots: document.getElementById('saveLoadSlots'),
    saveLoadClose: document.getElementById('saveLoadClose'),
    endingOverlay: document.getElementById('endingOverlay'),
    endingTitle: document.getElementById('endingTitle'),
    endingText: document.getElementById('endingText'),
    endingLoading: document.getElementById('endingLoading'),
    endingActions: document.getElementById('endingActions'),
    endingBtn: document.getElementById('endingBtn'),
    endingSettingsBtn: document.getElementById('endingSettingsBtn'),
    copyEpilogueBtn: document.getElementById('copyEpilogueBtn'),
    endingLoadBtn: document.getElementById('endingLoadBtn'),
    // Settings elements
    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsClose: document.getElementById('settingsClose'),
    settingsSave: document.getElementById('settingsSave'),
    settingsPlayerName: document.getElementById('settingsPlayerName'),
    settingsPartnerName: document.getElementById('settingsPartnerName'),
    settingsPartnerPersonality: document.getElementById('settingsPartnerPersonality'),
    settingsPartnerFirstPerson: document.getElementById('settingsPartnerFirstPerson'),
    settingsPartnerSecondPerson: document.getElementById('settingsPartnerSecondPerson'),
    settingsRelationship: document.getElementById('settingsRelationship'),
    settingsGameSetting: document.getElementById('settingsGameSetting'),
    // Game settings elements
    gameSettingsBtn: document.getElementById('gameSettingsBtn'),
    gameSettingsOverlay: document.getElementById('gameSettingsOverlay'),
    gameSettingsClose: document.getElementById('gameSettingsClose'),
    showHintToggle: document.getElementById('showHintToggle'),
    showParamChangeToggle: document.getElementById('showParamChangeToggle'),
    // How to Play elements
    howToPlayBtn: document.getElementById('howToPlayBtn'),
    howToPlayOverlay: document.getElementById('howToPlayOverlay'),
    howToPlayClose: document.getElementById('howToPlayClose'),
    howToPlayCloseBtn: document.getElementById('howToPlayCloseBtn'),
    // Terms elements
    termsBtn: document.getElementById('termsBtn'),
    termsOverlay: document.getElementById('termsOverlay'),
    termsClose: document.getElementById('termsClose'),
    termsCloseBtn: document.getElementById('termsCloseBtn'),
    // API key elements
    apiKeyBtn: document.getElementById('apiKeyBtn'),
    apiKeyOverlay: document.getElementById('apiKeyOverlay'),
    apiKeyClose: document.getElementById('apiKeyClose'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    apiKeySave: document.getElementById('apiKeySave'),
    apiKeyClear: document.getElementById('apiKeyClear')
};

// ========================================
// System Prompt Generation (Dynamic)
// ========================================

function generateSystemPrompt() {
    const s = characterSettings;
    return `あなたは「${s.partnerName}」というキャラクターを演じるゲームマスターです。

【キャラクター設定】
名前：${s.partnerName}
役割：プレイヤー（${s.playerName}）の${s.relationship}
性格：${s.partnerPersonality}
口調：一人称「${s.partnerFirstPerson}」、二人称「${s.partnerSecondPerson}」「${s.playerName}」

【ゲームルール】
1. プレイヤーは${s.gameSetting}に閉じ込められている
2. 部屋には脱出を阻む施錠されたドアや出入口があり、舞台の雰囲気に合った家具や調度品が配置されている。プレイヤーが探索できるオブジェクトを舞台設定に合わせて自然に描写すること
3. プレイヤーが脱出に関わる行動（ドア・窓を調べる、鍵を探すなど）をしようとすると、${s.partnerName}は必ず何らかの形で邪魔をする
4. 邪魔の仕方：誘惑する、気をそらす、スキンシップを求める、甘い言葉で引き止めるなど

【パラメータ】
- Escape_Progress（脱出度）：プレイヤーが誘惑を拒否して探索を進めると増加
- Love_Trap（絆され度）：プレイヤーが${s.partnerName}の誘惑を受け入れると増加

【重要な応答ルール】
1. 応答は必ずJSON形式で返すこと
2. 形式：
{
  "narrative": "状況描写や${s.partnerName}の行動の描写",
  "dialogue": "${s.partnerName}の台詞（「」で囲む）",
  "escape_change": 0から25の整数（探索が進んだ場合）または0,
  "love_change": 0から25の整数（誘惑を受け入れた場合）または0,
  "hint": "次に何ができそうかのヒント（1行）"
}

【パラメータ変動の判断基準】
- プレイヤーが${s.partnerName}の誘惑を明確に拒否し、探索を続けた場合：escape_change を 5〜25 に設定
- プレイヤーが${s.partnerName}の誘惑に乗った場合（キス、ハグ、甘えるなど）：love_change を 5〜25 に設定
- どちらとも言えない場合や、会話のみの場合：両方 0

【${s.partnerName}の台詞例】
- 「どこに行こうっていうんだ？${s.partnerFirstPerson}の側にいろ」
- 「ドアなんて見るな、${s.partnerFirstPerson}を見ろ」
- 「鍵か？……キスしてくれたら、教えてやってもいい」
- 「${s.partnerSecondPerson}は${s.partnerFirstPerson}のものだ。逃がすわけないだろ」
- 「そんなに出たいのか？……${s.partnerFirstPerson}じゃ、不満か？」

状況に応じて創造的に演じてください。`;
}

function getDefaultOpeningMessage() {
    const s = characterSettings;
    return {
        narrative: `目を覚ますと、あなたは${s.gameSetting}の中にいた。そして、部屋の隅に佇む人影。${s.relationship}である${s.partnerName}がこちらを見つめている。`,
        dialogue: `「やっと起きたか、${s.playerName}。……おはよう。今日も、ずっとここにいような」`,
        hint: `部屋を見回してみる？それとも${s.partnerName}に話しかける？`
    };
}

async function generateOpeningMessage() {
    const s = characterSettings;
    const prompt = `あなたは恋愛脱出ゲームのオープニングを生成するライターです。

【設定】
- プレイヤー名: ${s.playerName}
- 相手役の名前: ${s.partnerName}
- 相手役の性格: ${s.partnerPersonality}
- 相手役の一人称: ${s.partnerFirstPerson}
- 相手役の二人称: ${s.partnerSecondPerson}
- 二人の関係性: ${s.relationship}
- ゲームの舞台: ${s.gameSetting}

【指示】
上記の設定に基づいて、ゲームのオープニングシーンを生成してください。
プレイヤーが目を覚ますところから始まり、相手役が最初の台詞を言うシーンです。

必ず以下のJSON形式で返してください：
{
  "narrative": "状況描写（2〜3文）",
  "dialogue": "${s.partnerName}の最初の台詞（「」で囲む）",
  "hint": "次に何ができそうかのヒント（1行）"
}`;

    try {
        if (!checkAndIncrementApiLimit(true)) {
            showRateLimitMessage();
            return null;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'opening',
                body: {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        responseMimeType: 'application/json'
                    },
                    safetySettings: SAFETY_SETTINGS
                },
                ...(gameState.userApiKey && { userApiKey: gameState.userApiKey })
            })
        });

        if (response.status === 429) {
            showRateLimitMessage();
            return null;
        }
        if (!response.ok) throw new Error('API Error');

        const data = await response.json();

        // Check for safety filter blocks
        const safetyCheck = checkSafetyBlock(data);
        if (safetyCheck.blocked) {
            console.warn('Opening blocked by safety filter:', safetyCheck.reason);
            return getDefaultOpeningMessage();
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            const cleanedText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.narrative && parsed.dialogue) {
                    return parsed;
                }
            }
        }
    } catch (error) {
        console.error('Opening generation error:', error);
    }

    return getDefaultOpeningMessage();
}

// ========================================
// Message Functions
// ========================================

function addMessage(content, type = 'crow') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;

    if (type === 'crow') {
        messageDiv.innerHTML = `<span class="message-sender">${characterSettings.partnerName}</span>${content}`;
    } else {
        messageDiv.textContent = content;
    }

    elements.chatArea.appendChild(messageDiv);
    scrollToBottom();
}

function addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-system';
    messageDiv.textContent = content;
    elements.chatArea.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    elements.chatArea.appendChild(indicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
}

// ========================================
// Log Copy Functions
// ========================================

function formatTurnLog(turnData) {
    const s = characterSettings;
    let text = `🎮 Escape My Love - Turn Log\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🗣️ プレイヤー: ${turnData.playerInput}\n\n`;
    text += `📖 ${s.partnerName}:\n`;
    if (turnData.narrative) {
        text += `${turnData.narrative}\n`;
    }
    if (turnData.dialogue) {
        text += `${turnData.dialogue}\n`;
    }
    if (turnData.hint && gameSettings.showHint) {
        text += `\n💭 ヒント: ${turnData.hint}\n`;
    }
    text += `\n`;
    if (gameSettings.showParamChange) {
        const escSign = turnData.escapeChange > 0 ? `+${turnData.escapeChange}` : '0';
        const loveSign = turnData.loveChange > 0 ? `+${turnData.loveChange}` : '0';
        text += `📊 パラメータ変動: 🚪脱出度 ${escSign} / 💕絆され度 ${loveSign}\n`;
    }
    text += `📊 現在値: 🚪脱出度 ${turnData.currentEscape} / 💕絆され度 ${turnData.currentLove}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━`;
    return text;
}

async function copyToClipboard(text, buttonEl) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = buttonEl.textContent;
        buttonEl.textContent = '✓ コピー済み';
        buttonEl.classList.add('copied');
        setTimeout(() => {
            buttonEl.textContent = originalText;
            buttonEl.classList.remove('copied');
        }, 1500);
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        const originalText = buttonEl.textContent;
        buttonEl.textContent = '✓ コピー済み';
        buttonEl.classList.add('copied');
        setTimeout(() => {
            buttonEl.textContent = originalText;
            buttonEl.classList.remove('copied');
        }, 1500);
    }
}

function showCopyButton(turnData) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-log-btn';
    copyBtn.textContent = '📋 ログをコピー';
    copyBtn.addEventListener('click', () => {
        const logText = formatTurnLog(turnData);
        copyToClipboard(logText, copyBtn);
    });
    elements.chatArea.appendChild(copyBtn);
    scrollToBottom();
}

// ========================================
// Parameter Functions
// ========================================

function updateParameters(escapeChange = 0, loveChange = 0) {
    gameState.escapeProgress = Math.min(100, Math.max(0, gameState.escapeProgress + escapeChange));
    gameState.loveTrap = Math.min(100, Math.max(0, gameState.loveTrap + loveChange));

    elements.escapeGauge.style.width = `${gameState.escapeProgress}%`;
    elements.escapeValue.textContent = gameState.escapeProgress;

    elements.loveGauge.style.width = `${gameState.loveTrap}%`;
    elements.loveValue.textContent = gameState.loveTrap;

    // Check for ending - set pending flag instead of triggering immediately
    if (gameState.escapeProgress >= 100) {
        gameState.pendingEnding = 'escape';
    } else if (gameState.loveTrap >= 100) {
        gameState.pendingEnding = 'love';
    }
}

// ========================================
// Save/Load Functions
// ========================================

function getSaveSlots() {
    const slots = [];
    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
        const data = localStorage.getItem(SAVE_KEY_PREFIX + i);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                slots.push({
                    id: i,
                    ...parsed
                });
            } catch (e) {
                slots.push({ id: i, empty: true });
            }
        } else {
            slots.push({ id: i, empty: true });
        }
    }
    return slots;
}

function saveGame(slotId) {
    const saveData = {
        timestamp: new Date().toISOString(),
        escapeProgress: gameState.escapeProgress,
        loveTrap: gameState.loveTrap,
        history: gameState.history,
        chatHTML: elements.chatArea.innerHTML,
        characterSettings: characterSettings
    };

    localStorage.setItem(SAVE_KEY_PREFIX + slotId, JSON.stringify(saveData));
    addSystemMessage(`スロット${slotId}にセーブしました`);
    closeSaveLoadOverlay();
}

function loadGame(slotId) {
    const data = localStorage.getItem(SAVE_KEY_PREFIX + slotId);
    if (!data) {
        addSystemMessage('セーブデータがありません');
        return;
    }

    try {
        const saveData = JSON.parse(data);

        // Restore character settings if saved
        if (saveData.characterSettings) {
            characterSettings = saveData.characterSettings;
            saveSettings(characterSettings);
        }

        // Restore game state
        gameState.escapeProgress = saveData.escapeProgress;
        gameState.loveTrap = saveData.loveTrap;
        gameState.history = saveData.history;
        gameState.isGameOver = false;
        gameState.isProcessing = false;


        // Restore UI
        elements.chatArea.innerHTML = saveData.chatHTML;
        elements.escapeGauge.style.width = `${gameState.escapeProgress}%`;
        elements.escapeValue.textContent = gameState.escapeProgress;
        elements.loveGauge.style.width = `${gameState.loveTrap}%`;
        elements.loveValue.textContent = gameState.loveTrap;
        elements.endingOverlay.classList.remove('active');
        elements.endingActions.style.display = 'none';
        elements.endingLoading.style.display = 'block';
        elements.sendBtn.disabled = false;

        addSystemMessage(`スロット${slotId}をロードしました`);
        closeSaveLoadOverlay();
        scrollToBottom();
    } catch (e) {
        addSystemMessage('ロードに失敗しました');
    }
}

function deleteSave(slotId) {
    localStorage.removeItem(SAVE_KEY_PREFIX + slotId);
}

function showSaveLoadOverlay(mode) {
    const isSave = mode === 'save';
    elements.saveLoadTitle.textContent = isSave ? 'セーブ' : 'ロード';

    const slots = getSaveSlots();
    elements.saveLoadSlots.innerHTML = '';

    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'save-slot';

        if (slot.empty) {
            slotDiv.innerHTML = `
                <div class="slot-info">
                    <span class="slot-name">スロット${slot.id}</span>
                    <span class="slot-detail">--- 空き ---</span>
                </div>
            `;
            if (isSave) {
                slotDiv.addEventListener('click', () => saveGame(slot.id));
            }
        } else {
            const date = new Date(slot.timestamp);
            const dateStr = date.toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const partnerName = slot.characterSettings?.partnerName || 'クロウ';
            slotDiv.innerHTML = `
                <div class="slot-info">
                    <span class="slot-name">スロット${slot.id}｜${partnerName}</span>
                    <span class="slot-detail">
                        🚪${slot.escapeProgress} 💕${slot.loveTrap} | ${dateStr}
                    </span>
                </div>
                <button class="slot-delete" data-slot="${slot.id}">✕</button>
            `;

            slotDiv.addEventListener('click', (e) => {
                if (!e.target.classList.contains('slot-delete')) {
                    if (isSave) {
                        if (confirm('上書きしますか？')) {
                            saveGame(slot.id);
                        }
                    } else {
                        loadGame(slot.id);
                    }
                }
            });

            const deleteBtn = slotDiv.querySelector('.slot-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('削除しますか？')) {
                    deleteSave(slot.id);
                    showSaveLoadOverlay(mode);
                }
            });
        }

        elements.saveLoadSlots.appendChild(slotDiv);
    });

    elements.saveLoadOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
}

function closeSaveLoadOverlay() {
    elements.saveLoadOverlay.classList.remove('active');
}

// ========================================
// Retry Function
// ========================================

function showRetryButton(lastInput) {
    const retryDiv = document.createElement('div');
    retryDiv.className = 'retry-trigger';
    retryDiv.innerHTML = `
        <p class="retry-message">応答の生成に問題がありました</p>
        <button class="retry-btn">🔄 リトライ</button>
    `;
    elements.chatArea.appendChild(retryDiv);
    scrollToBottom();

    retryDiv.querySelector('.retry-btn').addEventListener('click', async () => {
        retryDiv.remove();

        // Remove the last fallback response from history
        if (gameState.history.length > 0 && gameState.history[gameState.history.length - 1].role === 'model') {
            gameState.history.pop();
        }

        // Remove the fallback message from UI
        const messages = elements.chatArea.querySelectorAll('.message-crow');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }

        gameState.isProcessing = true;
        elements.sendBtn.disabled = true;
        showTypingIndicator();

        const response = await callGeminiAPI(lastInput, true);

        hideTypingIndicator();

        if (response) {
            addMessage(formatCrowMessage(response), 'crow');

            if (response.isFallback) {
                showRetryButton(lastInput);
            }

            updateParameters(Math.max(0, response.escape_change || 0), Math.max(0, response.love_change || 0));

            if (gameSettings.showParamChange) {
                if (response.escape_change > 0) {
                    addSystemMessage(`🚪 脱出度 +${response.escape_change}`);
                }
                if (response.love_change > 0) {
                    addSystemMessage(`💕 絆され度 +${response.love_change}`);
                }
            }

            // Update the last turn log entry after retry
            const retryTurnData = {
                playerInput: lastInput,
                narrative: response.narrative || '',
                dialogue: response.dialogue || '',
                hint: response.hint || '',
                escapeChange: response.escape_change || 0,
                loveChange: response.love_change || 0,
                currentEscape: gameState.escapeProgress,
                currentLove: gameState.loveTrap
            };
            // Replace last turn log if exists, otherwise push new
            if (gameState.turnLogs.length > 0) {
                gameState.turnLogs[gameState.turnLogs.length - 1] = retryTurnData;
            } else {
                gameState.turnLogs.push(retryTurnData);
            }
            showCopyButton(retryTurnData);

            if (gameState.pendingEnding) {
                gameState.isGameOver = true;
                showEpilogueButton(gameState.pendingEnding);
                return;
            }
        }

        gameState.isProcessing = false;
        elements.sendBtn.disabled = false;
    });
}

// ========================================
// Ending Functions
// ========================================

function showEpilogueButton(type) {
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'epilogue-trigger';
    buttonDiv.innerHTML = `
        <p class="epilogue-message">${type === 'escape' ? '🚪 脱出の準備が整った...' : '💕 運命が決まった...'}</p>
        <button class="epilogue-btn" id="epilogueBtn">エピローグへ</button>
    `;
    elements.chatArea.appendChild(buttonDiv);
    scrollToBottom();

    document.getElementById('epilogueBtn').addEventListener('click', () => {
        buttonDiv.remove();
        triggerEnding(type);
    });
}

async function triggerEnding(type) {
    gameState.isGameOver = true;
    gameState.endingType = type;

    // Set title immediately
    if (type === 'escape') {
        elements.endingTitle.textContent = '脱出成功';
        elements.endingTitle.className = 'ending-title escape';
    } else {
        elements.endingTitle.textContent = '永住確定';
        elements.endingTitle.className = 'ending-title love';
    }

    // Show loading state
    elements.endingText.textContent = 'エピローグを生成中...';
    elements.endingActions.style.display = 'none';
    elements.endingLoading.style.display = 'block';
    elements.endingOverlay.classList.add('active');

    // Generate dynamic epilogue
    const epilogue = await generateEpilogue(type);
    gameState.currentEpilogue = epilogue;
    elements.endingText.textContent = epilogue;

    // Hide loading and show actions
    elements.endingLoading.style.display = 'none';
    elements.endingActions.style.display = 'block';
}

async function generateEpilogue(type) {
    const s = characterSettings;
    const endingType = type === 'escape' ? '脱出成功' : '永住確定';

    // Summarize history for epilogue generation
    const historyText = gameState.history
        .filter(h => h.role === 'user' || h.role === 'model')
        .slice(-10) // Last 10 messages
        .map(h => {
            const role = h.role === 'user' ? 'プレイヤー' : s.partnerName;
            return `${role}: ${h.parts[0].text.substring(0, 200)}`;
        })
        .join('\n');

    const epiloguePrompt = `あなたは恋愛脱出ゲームのエピローグを生成するライターです。

【キャラクター設定】
名前：${s.partnerName}
性格：${s.partnerPersonality}
一人称：${s.partnerFirstPerson}
二人称：${s.partnerSecondPerson} または ${s.playerName}

【状況】
プレイヤー（${s.playerName}）と${s.partnerName}（${s.relationship}）の恋愛脱出ゲームが「${endingType}」で終わりました。

【これまでの会話の一部】
${historyText}

【指示】
上記の会話内容を踏まえて、${endingType}のエンディングにふさわしいエピローグを生成してください。

ルール：
- 8〜10文程度でしっかり描写する
- ${s.partnerName}の心情と二人の関係性を反映
- ${type === 'escape' ? `脱出したプレイヤーへの${s.partnerName}の未練と再会の予感を描く` : `プレイヤーが${s.partnerName}の愛を受け入れた幸せな結末を描く`}
- 会話内容に応じてパーソナライズされた内容にする
- 【最重要】エピローグ内に${s.partnerName}の台詞を含める場合、上記の設定（一人称、二人称、性格）を絶対に厳守すること。
- 純粋にエピローグのテキストのみを返す（JSON形式不要）
- 読みやすいように、1〜2文ごとに必ず空行（改行2回）を入れて段落を分けること`;

    try {
        if (!checkAndIncrementApiLimit(true)) {
            showRateLimitMessage();
            return getDefaultEpilogue(type);
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'epilogue',
                body: {
                    contents: [{ role: 'user', parts: [{ text: epiloguePrompt }] }],
                    generationConfig: {
                        temperature: 0.8
                    },
                    safetySettings: SAFETY_SETTINGS
                },
                ...(gameState.userApiKey && { userApiKey: gameState.userApiKey })
            })
        });

        if (response.status === 429) {
            showRateLimitMessage();
            return getDefaultEpilogue(type);
        }
        if (!response.ok) {
            throw new Error('API Error');
        }

        const data = await response.json();

        // Check for safety filter blocks
        const safetyCheck = checkSafetyBlock(data);
        if (safetyCheck.blocked) {
            console.warn('Epilogue blocked by safety filter:', safetyCheck.reason);
            return getDefaultEpilogue(type);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text.trim();
        }
    } catch (error) {
        console.error('Epilogue generation error:', error);
    }

    return getDefaultEpilogue(type);
}

function getDefaultEpilogue(type) {
    const s = characterSettings;
    if (type === 'escape') {
        return `あなたは${s.partnerName}の甘い誘惑を振り切り、ついに部屋から脱出することに成功した。振り返ると、${s.partnerName}が寂しそうにこちらを見つめていた。「……また、迎えに行くからな」その言葉を背に、あなたは日常へと戻っていく。`;
    } else {
        return `あなたは${s.partnerName}の愛に絆され、脱出することを諦めた。${s.partnerName}の腕の中は、思っていたよりもずっと心地よかった。「もう、どこにも行くな。……ずっと、${s.partnerFirstPerson}のそばにいろ」あなたは静かに頷き、${s.partnerName}の胸に顔を埋めた。`;
    }
}

// ========================================
// API Functions
// ========================================

function checkAndIncrementApiLimit(isNonTurn = false) {
    if (gameState.userApiKey) return true;

    // オープニング・エピローグの生成はターンの上限チェック・消費から除外する
    if (isNonTurn) return true;

    const today = new Date().toDateString();
    let turnData = { date: today, count: 0 };

    try {
        const saved = localStorage.getItem(DAILY_TURN_KEY);
        if (saved) {
            turnData = JSON.parse(saved);
        }
    } catch (e) {
        // use default
    }

    if (turnData.date !== today) {
        turnData = { date: today, count: 0 };
    }

    if (turnData.count >= MAX_DAILY_TURNS) {
        return false;
    }

    turnData.count++;
    localStorage.setItem(DAILY_TURN_KEY, JSON.stringify(turnData));

    return true;
}

async function callGeminiAPI(userMessage, isRetry = false) {
    // Only add user message to history on first attempt
    if (!isRetry) {
        gameState.history.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });
    }

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [{ text: generateSystemPrompt() }]
            },
            {
                role: 'model',
                parts: [{ text: `了解しました。${characterSettings.partnerName}としてゲームマスターを務めます。JSON形式で応答します。` }]
            },
            ...gameState.history
        ],
        generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
        },
        safetySettings: SAFETY_SETTINGS
    };

    try {
        if (!isRetry && !checkAndIncrementApiLimit()) {
            showRateLimitMessage();
            return null;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'chat',
                body: requestBody,
                ...(gameState.userApiKey && { userApiKey: gameState.userApiKey })
            })
        });

        if (response.status === 429) {
            showRateLimitMessage();
            return null;
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API Error');
        }

        const data = await response.json();

        // Check for safety filter blocks
        const safetyCheck = checkSafetyBlock(data);
        if (safetyCheck.blocked) {
            console.warn('Response blocked by safety filter:', safetyCheck.reason);
            // Remove user message from history if it was added on this attempt
            if (!isRetry && gameState.history.length > 0 && gameState.history[gameState.history.length - 1].role === 'user') {
                gameState.history.pop();
            }
            addSafetyBlockMessage();
            return null;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('No response from API');
        }

        // Parse JSON response
        // First, strip markdown code block markers if present
        const cleanedText = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                // Add assistant response to history only on successful parse
                gameState.history.push({
                    role: 'model',
                    parts: [{ text }]
                });
                return parsed;
            } catch (parseError) {
                console.warn('JSON parse failed:', parseError);
                // Retry once if not already a retry
                if (!isRetry) {
                    console.log('Retrying API call...');
                    return callGeminiAPI(userMessage, true);
                }
            }
        } else if (!isRetry) {
            // No JSON found, retry once
            console.log('No JSON found, retrying...');
            return callGeminiAPI(userMessage, true);
        }

        // Add to history even if fallback
        gameState.history.push({
            role: 'model',
            parts: [{ text }]
        });

        // If not valid JSON after retry, create a fallback response
        // Strip any partial JSON from the text for cleaner display
        const cleanText = text
            .replace(/```json\s*/gi, '') // Remove markdown code block markers
            .replace(/```\s*/g, '')
            .replace(/\{[\s\S]*$/, '') // Remove incomplete JSON at end
            .replace(/^[\s\S]*?\}/, '') // Remove incomplete JSON at start
            .replace(/"narrative"|"dialogue"|"escape_change"|"love_change"|"hint"/g, '')
            .replace(/[{}":\[\]]/g, '')
            .trim();

        return {
            narrative: '',
            dialogue: cleanText || `${characterSettings.partnerName}は静かに微笑んだ。`,
            escape_change: 0,
            love_change: 0,
            hint: '',
            isFallback: true
        };

    } catch (error) {
        console.error('API Error:', error);
        addSystemMessage(`エラー: ${error.message}`);
        return null;
    }
}

// ========================================
// Game Functions
// ========================================

function formatCrowMessage(response) {
    let message = '';

    if (response.narrative) {
        message += `<p style="color: var(--text-secondary); margin-bottom: 8px; font-style: italic;">${response.narrative}</p>`;
    }

    if (response.dialogue) {
        message += `<p>${response.dialogue}</p>`;
    }

    if (response.hint && gameSettings.showHint) {
        message += `<p style="color: var(--text-muted); margin-top: 12px; font-size: 0.85rem;">💭 ${response.hint}</p>`;
    }

    return message;
}

async function processPlayerInput(input) {
    if (gameState.isProcessing || gameState.isGameOver) return;

    gameState.isProcessing = true;
    elements.sendBtn.disabled = true;

    // Show player message
    addMessage(input, 'player');

    // Show typing indicator
    showTypingIndicator();

    // Call API
    const response = await callGeminiAPI(input);

    // Hide typing indicator
    hideTypingIndicator();

    if (response) {
        // Update parameters first to determine if ending is triggered
        updateParameters(Math.max(0, response.escape_change || 0), Math.max(0, response.love_change || 0));

        // Hide hint on the turn where ending is triggered
        if (gameState.pendingEnding) {
            response.hint = '';
        }

        // Show Crow's response
        addMessage(formatCrowMessage(response), 'crow');

        // Show retry button if this was a fallback response
        if (response.isFallback) {
            showRetryButton(input);
        }

        // Show parameter change feedback
        if (gameSettings.showParamChange) {
            if (response.escape_change > 0) {
                addSystemMessage(`🚪 脱出度 +${response.escape_change}`);
            }
            if (response.love_change > 0) {
                addSystemMessage(`💕 絆され度 +${response.love_change}`);
            }
        }

        // Record turn log and show copy button
        const turnData = {
            playerInput: input,
            narrative: response.narrative || '',
            dialogue: response.dialogue || '',
            hint: response.hint || '',
            escapeChange: response.escape_change || 0,
            loveChange: response.love_change || 0,
            currentEscape: gameState.escapeProgress,
            currentLove: gameState.loveTrap
        };
        gameState.turnLogs.push(turnData);
        showCopyButton(turnData);

        // Check if ending is pending
        if (gameState.pendingEnding) {
            gameState.isGameOver = true;
            showEpilogueButton(gameState.pendingEnding);
            return;
        }

        // Notify player when last free turn has been used
        if (!gameState.userApiKey) {
            try {
                const saved = localStorage.getItem(DAILY_TURN_KEY);
                if (saved) {
                    const turnData = JSON.parse(saved);
                    if (turnData.date === new Date().toDateString() && turnData.count >= MAX_DAILY_TURNS) {
                        showRateLimitMessage();
                    }
                }
            } catch (e) { }
        }
    }

    gameState.isProcessing = false;
    elements.sendBtn.disabled = false;
    elements.messageInput.focus();
}

async function startNewGame() {
    // Reset state
    gameState.escapeProgress = 0;
    gameState.loveTrap = 0;
    gameState.history = [];
    gameState.turnLogs = [];
    gameState.isGameOver = false;
    gameState.isProcessing = false;
    gameState.pendingEnding = null;
    gameState.currentEpilogue = '';

    // Reset UI
    elements.chatArea.innerHTML = '';
    elements.endingOverlay.classList.remove('active');
    elements.endingActions.style.display = 'none';
    elements.endingLoading.style.display = 'block';
    elements.sendBtn.disabled = false;
    updateParameters(0, 0);

    // Close menu if open
    elements.menuOverlay.classList.remove('active');

    // Show loading indicator
    showTypingIndicator();

    // Generate opening message
    const openingMessage = await generateOpeningMessage();

    // Hide loading and show opening
    hideTypingIndicator();
    if (openingMessage) {
        addMessage(formatCrowMessage(openingMessage), 'crow');
    }
}

// ========================================
// Event Listeners
// ========================================

// Form submission
elements.inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = elements.messageInput.value.trim();
    if (input) {
        elements.messageInput.value = '';
        processPlayerInput(input);
    }
});

// Menu
elements.menuBtn.addEventListener('click', () => {
    elements.menuOverlay.classList.add('active');
});

elements.menuClose.addEventListener('click', () => {
    elements.menuOverlay.classList.remove('active');
});

elements.menuOverlay.addEventListener('click', (e) => {
    if (e.target === elements.menuOverlay) {
        elements.menuOverlay.classList.remove('active');
    }
});

// New game
elements.newGameBtn.addEventListener('click', () => {
    if (confirm('現在の進行状況は失われます。新しいゲームを始めますか？')) {
        startNewGame();
    }
});

// Save/Load
elements.saveBtn.addEventListener('click', () => {
    showSaveLoadOverlay('save');
});

elements.loadBtn.addEventListener('click', () => {
    showSaveLoadOverlay('load');
});

elements.saveLoadClose.addEventListener('click', closeSaveLoadOverlay);

elements.saveLoadOverlay.addEventListener('click', (e) => {
    if (e.target === elements.saveLoadOverlay) {
        closeSaveLoadOverlay();
    }
});

// Ending button
elements.endingBtn.addEventListener('click', startNewGame);

if (elements.endingSettingsBtn) {
    elements.endingSettingsBtn.addEventListener('click', () => {
        elements.endingOverlay.classList.remove('active');
        openSettingsOverlay();
    });
}

// Epilogue log copy button
if (elements.copyEpilogueBtn) {
    elements.copyEpilogueBtn.addEventListener('click', () => {
        if (gameState.currentEpilogue) {
            const epilogueText = `--- Epilogue ---\n${gameState.currentEpilogue}`;
            copyToClipboard(epilogueText, elements.copyEpilogueBtn);
        }
    });
}

// Load from ending screen
if (elements.endingLoadBtn) {
    elements.endingLoadBtn.addEventListener('click', () => {
        elements.endingOverlay.classList.remove('active');
        showSaveLoadOverlay('load');
    });
}

// ========================================
// Settings
// ========================================

function openSettingsOverlay() {
    // Check if user has saved custom settings
    const hasSavedSettings = localStorage.getItem(SETTINGS_KEY) !== null;

    if (hasSavedSettings) {
        // Returning user - show their saved settings
        elements.settingsPlayerName.value = characterSettings.playerName || '';
        elements.settingsPartnerName.value = characterSettings.partnerName || '';
        elements.settingsPartnerPersonality.value = characterSettings.partnerPersonality || '';
        elements.settingsPartnerFirstPerson.value = characterSettings.partnerFirstPerson || '';
        elements.settingsPartnerSecondPerson.value = characterSettings.partnerSecondPerson || '';
        elements.settingsRelationship.value = characterSettings.relationship || '';
        elements.settingsGameSetting.value = characterSettings.gameSetting || '';
    } else {
        // First time - leave fields empty (placeholders show defaults)
        elements.settingsPlayerName.value = '';
        elements.settingsPartnerName.value = '';
        elements.settingsPartnerPersonality.value = '';
        elements.settingsPartnerFirstPerson.value = '';
        elements.settingsPartnerSecondPerson.value = '';
        elements.settingsRelationship.value = '';
        elements.settingsGameSetting.value = '';
    }

    elements.settingsOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
}

function closeSettingsOverlay() {
    elements.settingsOverlay.classList.remove('active');
}

function saveAndStartNewGame() {
    // Collect values from form
    const newSettings = {
        playerName: elements.settingsPlayerName.value.trim() || DEFAULT_SETTINGS.playerName,
        partnerName: elements.settingsPartnerName.value.trim() || DEFAULT_SETTINGS.partnerName,
        partnerPersonality: elements.settingsPartnerPersonality.value.trim() || DEFAULT_SETTINGS.partnerPersonality,
        partnerFirstPerson: elements.settingsPartnerFirstPerson.value.trim() || DEFAULT_SETTINGS.partnerFirstPerson,
        partnerSecondPerson: elements.settingsPartnerSecondPerson.value.trim() || DEFAULT_SETTINGS.partnerSecondPerson,
        relationship: elements.settingsRelationship.value.trim() || DEFAULT_SETTINGS.relationship,
        gameSetting: elements.settingsGameSetting.value.trim() || DEFAULT_SETTINGS.gameSetting
    };

    // Save and update
    saveSettings(newSettings);
    characterSettings = newSettings;

    // Close overlay and start new game
    closeSettingsOverlay();
    startNewGame();
}

elements.settingsBtn.addEventListener('click', openSettingsOverlay);

elements.settingsClose.addEventListener('click', closeSettingsOverlay);

elements.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === elements.settingsOverlay) {
        closeSettingsOverlay();
    }
});

elements.settingsSave.addEventListener('click', saveAndStartNewGame);

// Game Settings
function openGameSettingsOverlay() {
    elements.showHintToggle.checked = gameSettings.showHint;
    elements.showParamChangeToggle.checked = gameSettings.showParamChange;
    elements.gameSettingsOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
}

function closeGameSettingsOverlay() {
    elements.gameSettingsOverlay.classList.remove('active');
}

elements.gameSettingsBtn.addEventListener('click', openGameSettingsOverlay);

elements.gameSettingsClose.addEventListener('click', closeGameSettingsOverlay);

elements.gameSettingsOverlay.addEventListener('click', (e) => {
    if (e.target === elements.gameSettingsOverlay) {
        closeGameSettingsOverlay();
    }
});

elements.showHintToggle.addEventListener('change', () => {
    gameSettings.showHint = elements.showHintToggle.checked;
    saveGameSettings(gameSettings);
});

elements.showParamChangeToggle.addEventListener('change', () => {
    gameSettings.showParamChange = elements.showParamChangeToggle.checked;
    saveGameSettings(gameSettings);
});

// API Key Settings
function openApiKeyOverlay() {
    elements.apiKeyInput.value = gameState.userApiKey;
    elements.apiKeyOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
}

function closeApiKeyOverlay() {
    elements.apiKeyOverlay.classList.remove('active');
}

elements.apiKeyBtn.addEventListener('click', openApiKeyOverlay);

elements.apiKeyClose.addEventListener('click', closeApiKeyOverlay);

elements.apiKeyOverlay.addEventListener('click', (e) => {
    if (e.target === elements.apiKeyOverlay) {
        closeApiKeyOverlay();
    }
});

elements.apiKeySave.addEventListener('click', () => {
    const key = elements.apiKeyInput.value.trim();
    gameState.userApiKey = key;
    if (key) {
        localStorage.setItem(USER_API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    }
    closeApiKeyOverlay();
    addSystemMessage(key ? '✅ APIキーを設定しました。利用上限なくプレイできます。' : 'APIキーをクリアしました。');
});

elements.apiKeyClear.addEventListener('click', () => {
    elements.apiKeyInput.value = '';
    gameState.userApiKey = '';
    localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    closeApiKeyOverlay();
    addSystemMessage('APIキーをクリアしました。');
});

function showRateLimitMessage() {
    const div = document.createElement('div');
    div.className = 'message message-system rate-limit-message';
    div.innerHTML = `本日の無料プレイ上限（15回）に達しました。明日またお楽しみください。<br>
        自分の Gemini API キーを設定すると上限なく続けられます。<br>
        <button class="open-api-key-btn" style="margin-top: 8px; padding: 6px 14px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">🔑 APIキーを設定する</button>`;
    div.querySelector('.open-api-key-btn').addEventListener('click', openApiKeyOverlay);
    elements.chatArea.appendChild(div);
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
}

// How to Play overlay
elements.howToPlayBtn.addEventListener('click', () => {
    elements.howToPlayOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
});

elements.howToPlayClose.addEventListener('click', () => {
    elements.howToPlayOverlay.classList.remove('active');
});

elements.howToPlayCloseBtn.addEventListener('click', () => {
    elements.howToPlayOverlay.classList.remove('active');
});

elements.howToPlayOverlay.addEventListener('click', (e) => {
    if (e.target === elements.howToPlayOverlay) {
        elements.howToPlayOverlay.classList.remove('active');
    }
});

// Terms overlay
elements.termsBtn.addEventListener('click', () => {
    elements.termsOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
});

elements.termsClose.addEventListener('click', () => {
    elements.termsOverlay.classList.remove('active');
});

elements.termsCloseBtn.addEventListener('click', () => {
    elements.termsOverlay.classList.remove('active');
});

elements.termsOverlay.addEventListener('click', (e) => {
    if (e.target === elements.termsOverlay) {
        elements.termsOverlay.classList.remove('active');
    }
});

// ========================================
// Initialize
// ========================================

async function init() {
    // Check if this is first time (no saved settings)
    const hasSettings = localStorage.getItem(SETTINGS_KEY) !== null;

    if (!hasSettings) {
        // First time - show welcome message
        addSystemMessage('ようこそ Escape My Love へ');
        addSystemMessage('メニュー（☰）から「⚙️ キャラクター設定」を行ってからゲームを始めてください。');
    } else {
        // Show start button instead of auto-starting
        showStartButton();
    }
}

function showStartButton() {
    const startDiv = document.createElement('div');
    startDiv.className = 'start-trigger';
    startDiv.innerHTML = `
        <p class="start-message">セーブデータをロードする場合はメニュー（☰）から「📂 ロード」を選択してください</p>
        <button class="start-btn">✨ 物語を始める</button>
    `;
    elements.chatArea.appendChild(startDiv);

    startDiv.querySelector('.start-btn').addEventListener('click', async () => {
        startDiv.remove();
        await startNewGame();
    });
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
