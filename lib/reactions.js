const fs = require('fs');
const path = require('path');

const AUTOREACT_FILE = path.join(__dirname, '../data/autoreact.json');
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

function loadEmojis() {
    try {
        if (fs.existsSync(AUTOREACT_FILE)) {
            const _r1 = fs.readFileSync(AUTOREACT_FILE, 'utf8').trim(); const data = _r1 ? JSON.parse(_r1) : [];
            if (Array.isArray(data) && data.length > 0) return data;
        }
    } catch (e) {}
    return ['❤️','🔥','😂','👍','🎉','💯','😍','🌟','✅','🙌','💜','🥰','😎','🤩','👀','🫶','💐','🌸'];
}

function loadAutoReactionState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const _r2 = fs.readFileSync(USER_GROUP_DATA, 'utf8').trim(); const data = _r2 ? JSON.parse(_r2) : {};
            return data.autoReaction || false;
        }
    } catch (_) {}
    return false;
}

function saveAutoReactionState(state) {
    try {
        let data = {};
        if (fs.existsSync(USER_GROUP_DATA)) {
            try { const _r3 = fs.readFileSync(USER_GROUP_DATA, 'utf8').trim(); data = _r3 ? JSON.parse(_r3) : {}; } catch (_) {}
        }
        data.autoReaction = state;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) { console.error('Error saving auto-reaction state:', error); }
}

let isAutoReactionEnabled = loadAutoReactionState();

function getRandomEmoji() {
    const emojis = loadEmojis();
    return emojis[Math.floor(Math.random() * emojis.length)];
}

async function reactToMessage(sock, message) {
    try {
        if (!message?.key?.id) return;
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: getRandomEmoji(), key: message.key }
        });
    } catch (_) {}
}

// Called for every incoming message when autoreact is ON
async function handleAutoReact(sock, message) {
    try {
        if (!isAutoReactionEnabled) return;
        await reactToMessage(sock, message);
    } catch (_) {}
}

// Called after command execution.
// If the command has a `react` property (e.g. react: '🤖'), that emoji is used.
// Otherwise falls back to a random emoji IF auto-react is enabled.
async function addCommandReaction(sock, message, command) {
    try {
        if (!message?.key?.id) return;
        const emoji = command?.react || null;
        if (emoji) {
            // Command has its own react emoji — always fire it, ignoring autoreact toggle
            await sock.sendMessage(message.key.remoteJid, {
                react: { text: emoji, key: message.key }
            });
        } else if (isAutoReactionEnabled) {
            // No command-level emoji — use random autoreact if it's on
            await reactToMessage(sock, message);
        }
    } catch (_) {}
}

async function handleAreactCommand(sock, chatId, message, isOwner) {
    const channelInfo = {
        contextInfo: {
            forwardingScore: 1, isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363417440480101@newsletter',
                newsletterName: 'KEITH TECH', serverMessageId: -1
            }
        }
    };
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: '❌ This command is for the owner only!', ...channelInfo }, { quoted: message });
            return;
        }
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const action = rawText.trim().split(/\s+/)[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, {
                text: '✅ *Auto-react enabled!*\n\n_Bot will react to every message with a random emoji._', ...channelInfo
            }, { quoted: message });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, {
                text: '❌ *Auto-react disabled!*', ...channelInfo
            }, { quoted: message });
        } else {
            const state = isAutoReactionEnabled ? '✅ ON' : '❌ OFF';
            await sock.sendMessage(chatId, {
                text: `🎭 *Auto React:* ${state}\n\n• \`autoreact on\` — Enable\n• \`autoreact off\` — Disable\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴏᴏɴ xᴍᴅ`, ...channelInfo
            }, { quoted: message });
        }
    } catch (e) { console.error('Error in areact:', e); }
}

module.exports = { addCommandReaction, handleAreactCommand, handleAutoReact };
