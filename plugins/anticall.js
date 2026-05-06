const fs = require('fs');
const settings = require('../settings');

const ANTICALL_PATH = './data/anticall.json';

function readState() {
    try {
        if (!fs.existsSync(ANTICALL_PATH)) return { enabled: false };
        const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
        const data = JSON.parse(raw || '{}');
        return { enabled: !!data.enabled };
    } catch {
        return { enabled: false };
    }
}

function writeState(enabled) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    } catch {}
}

async function anticallCommand(sock, chatId, message, args) {
    const state = readState();
    const sub = (args || '').trim().toLowerCase();

    if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'status')) {
        await sock.sendMessage(chatId, { text: `*ANTICALL*\n\n${settings.Prefix}anticall on  - Enable auto-block on incoming calls\n.anticall off - Disable anticall\n${settings.Prefix}anticall status - Show current status` }, { quoted: message });
        return;
    }

    if (sub === 'status') {
        await sock.sendMessage(chatId, { text: `Anticall is currently *${state.enabled ? 'ON' : 'OFF'}*.` }, { quoted: message });
        return;
    }

    const enable = sub === 'on';
    writeState(enable);
    await sock.sendMessage(chatId, { text: `Anticall is now *${enable ? 'ENABLED' : 'DISABLED'}*.` }, { quoted: message });
}

module.exports = { anticallCommand, readState };




const _wrapped_anticall = module.exports;
module.exports = {
  name: 'anticall',
  aliases: [],
  category: 'owner',
  description: 'Toggle anti-call',
  ..._wrapped_anticall,
  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    const message = msg;
    const isOwnerOrSudo = extra.isOwner;
    const isGroup = extra.isGroup;
    const senderId = extra.sender;
    const q = args.join(' ').trim();
    const fn = Object.values(_wrapped_anticall).find(v => typeof v === 'function');
    if (fn) await fn(sock, chatId, message, q, isOwnerOrSudo, isGroup);
    else throw new Error('No execute function found in anticall.js');
  },
};
