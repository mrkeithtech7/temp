/**
 * MOON-X lib/handler.js — replaces main.js
 */
const fs    = require('fs');
const chalk = require('chalk');
const database = require('../database');
const { loadCommands, getCommand } = require('./commandLoader');
const { getPrefixes } = require('./prefixManager');
const { isSudo } = require('./index');
const { Antilink } = require('./antilink');
const { addCommandReaction, handleAutoReact } = require('./reactions');
const isAdmin = require('./isAdmin');

const channelInfo = {
  contextInfo: {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageInfo: { newsletterJid: '120363417440480101@newsletter', newsletterName: '𝐊𝐄𝐈𝐓𝐇 𝐓𝐄𝐂𝐇', serverMessageId: -1 },
  },
};

function getPrefix(text) {
  for (const p of getPrefixes()) { if (text.startsWith(p)) return p; }
  return null;
}

function logCmd(cmd, isGroup, prefix) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const bg = isGroup ? chalk.bgBlue : chalk.bgMagenta;
  console.log(chalk.cyan('\n===========================================>'));
  console.log(bg.white.bold(`  📍 ${(isGroup ? 'GROUP' : 'PRIVATE').padEnd(39)}`));
  console.log(chalk.green(`>> Command : ${cmd.substring(0, 30)}`));
  console.log(chalk.blue(`>> Prefix  : ${prefix || 'none'}`));
  console.log(chalk.magenta(`>> Time    : ${ts}`));
  console.log(chalk.cyan('===========================================>'));
}

async function handleMessages(sock, messageUpdate) {
  try {
    const { messages, type } = messageUpdate;
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg?.message) return;

    // Auto features
    try { await require('../plugins/autoread').handleAutoread(sock, msg); } catch (_) {}
    try { await handleAutoReact(sock, msg); } catch (_) {}
    try { require('../plugins/antidelete').storeMessage(sock, msg); } catch (_) {}
    try { require('./antiedit').storeOriginalMessage(msg); } catch (_) {}

    // Message delete event
    if (msg.message?.protocolMessage?.type === 0) {
      try { await require('../plugins/antidelete').handleMessageRevocation(sock, msg); } catch (_) {}
      return;
    }

    const chatId   = msg.key.remoteJid;
    const senderId = msg.key.participant || msg.key.remoteJid;
    const isGroup  = chatId.endsWith('@g.us');
    const senderIsSudo   = await isSudo(senderId).catch(() => false);
    const isOwnerOrSudo  = msg.key.fromMe || senderIsSudo;

    const rawText = (
      msg.message?.conversation?.trim() ||
      msg.message?.extendedTextMessage?.text?.trim() ||
      msg.message?.imageMessage?.caption?.trim() ||
      msg.message?.videoMessage?.caption?.trim() || ''
    );

    // ── &ls — no-prefix list (no prefix required) ─────────────────────────
    if (/^&(ls|list)$/i.test(rawText)) {
      const allCmds = loadCommands();
      const seen = new Set(), names = [];
      for (const [, v] of allCmds.entries()) { if (!seen.has(v.name)) { seen.add(v.name); names.push(v.name); } }
      const pfx = getPrefixes()[0];
      const list = names.sort().map(n => `${pfx}${n}`).join(', ');
      await sock.sendMessage(chatId, { text: ` *✅️ MOON-X Commands (${names.length}):*\n\n${list}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋᴇɪᴛʜ ᴛᴇᴄʜ`, ...channelInfo }, { quoted: msg });
      return;
    }

    const prefix = getPrefix(rawText);
    let userMessage = '';
    if (prefix !== null) {
      userMessage = rawText.slice(prefix.length).trim().toLowerCase().replace(/\.\s+/g, '.').trim();
    }
    if (prefix !== null && userMessage) logCmd(prefix + userMessage, isGroup, prefix);

    // Bot mode
    let isPublic = true;
    try { const d = JSON.parse((fs.readFileSync('./data/messageCount.json', 'utf8').trim()) || '{}'); if (typeof d.isPublic === 'boolean') isPublic = d.isPublic; } catch (_) {}

    // Ban check
    const banned = await database.isUserBanned(senderId).catch(() => false);
    if (banned && !userMessage.startsWith('unban')) {
      if (Math.random() < 0.1) await sock.sendMessage(chatId, { text: '❌ You are banned from using this bot.', ...channelInfo });
      return;
    }

    if (!msg.key.fromMe) { try { require('../plugins/topmembers').incrementMessageCount(chatId, senderId); } catch (_) {} }

    // Group moderation
    if (isGroup) {
      if (userMessage) { try { await require('./antibadword').handleBadwordDetection(sock, chatId, msg, userMessage, senderId); } catch (_) {} }
      try { await Antilink(msg, sock); } catch (_) {}
    }

    // ── No-prefix section ─────────────────────────────────────────────────
    if (prefix === null) {
      try { await require('../plugins/autotyping').handleAutotypingForMessage(sock, chatId, rawText); } catch (_) {}
      if (isGroup) {
        try { await require('../plugins/antitag').handleTagDetection(sock, chatId, msg, senderId); } catch (_) {}
        try { await require('../plugins/mention').handleMentionDetection(sock, chatId, msg); } catch (_) {}
      }

      // ── Moon X AI (replaces old chatbot call) ──────────────────────────
      // Fires in DM always (when enabled), and in groups when public mode is on.
      // Mode is controlled by settings.moonxAI.mode in settings.js:
      //   'private' = DMs only | 'public' = everywhere | 'group' = groups only | 'owner' = owner only
      if (!msg.key.fromMe) {
        const moonxAI = require('../plugins/ai-moonx');
        if (isGroup) {
          // In groups, only fire if public mode or owner/sudo
          if (isPublic || isOwnerOrSudo) {
            await moonxAI.autoHandle(sock, chatId, msg, rawText, senderId).catch(() => {});
          }
        } else {
          // In private chats, always try (moonx-ai checks its own mode setting)
          await moonxAI.autoHandle(sock, chatId, msg, rawText, senderId).catch(() => {});
        }
      }

      // Custom commands (no prefix)
      try {
        const cc = await database.getCustomCommand(rawText.toLowerCase().replace(/^[.!/#]/, ''));
        if (cc) await sock.sendMessage(chatId, { text: cc.response, ...channelInfo }, { quoted: msg });
      } catch (_) {}
      return;
    }

    if (!isPublic && !isOwnerOrSudo) return;

    const parts   = userMessage.trim().split(/\s+/);
    const cmdName = parts[0];
    const cmdArgs = parts.slice(1);
    if (!cmdName) return;

    // Custom command
    try {
      const cc = await database.getCustomCommand(cmdName);
      if (cc) {
        await sock.sendMessage(chatId, { text: cc.response, ...channelInfo }, { quoted: msg });
        await addCommandReaction(sock, msg, null).catch(() => {});
        return;
      }
    } catch (_) {}

    const command = getCommand(cmdName);
    if (!command) {
      // Unknown command — fallback to Moon X AI only in private chats
      if (!isGroup && !msg.key.fromMe) {
        await require('../plugins/moonx-ai').autoHandle(sock, chatId, msg, rawText, senderId).catch(() => {});
      }
      return;
    }

    // Permissions
    if (command.ownerOnly && !isOwnerOrSudo) return sock.sendMessage(chatId, { text: '❌ Owner only!', ...channelInfo }, { quoted: msg });
    if (command.groupOnly && !isGroup)        return sock.sendMessage(chatId, { text: '❌ Groups only!', ...channelInfo }, { quoted: msg });
    if (command.privateOnly && isGroup)       return sock.sendMessage(chatId, { text: '❌ Private chat only!', ...channelInfo }, { quoted: msg });

    let isSenderAdmin = false, isBotAdminFlag = false, groupMetadata = null;
    if (isGroup) { try { groupMetadata = await sock.groupMetadata(chatId); } catch (_) {} }

    if (command.adminOnly || command.botAdminNeeded) {
      try { const s = await isAdmin(sock, chatId, senderId, msg); isSenderAdmin = s.isSenderAdmin; isBotAdminFlag = s.isBotAdmin; } catch (_) {}
      if (command.adminOnly && !isSenderAdmin && !isOwnerOrSudo) return sock.sendMessage(chatId, { text: '❌ Admins only!', ...channelInfo }, { quoted: msg });
      if (command.botAdminNeeded && !isBotAdminFlag) return sock.sendMessage(chatId, { text: '❌ Make me admin first!', ...channelInfo }, { quoted: msg });
    }

    const extra = {
      from: chatId, sender: senderId, isGroup, groupMetadata,
      isOwner: isOwnerOrSudo, isAdmin: isSenderAdmin, isBotAdmin: isBotAdminFlag,
      prefix: prefix || getPrefixes()[0],
      reply: (text) => sock.sendMessage(chatId, { text }, { quoted: msg }),
      react: (emoji) => sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } }),
    };

    try { await sock.sendPresenceUpdate('composing', chatId); } catch (_) {}
    await command.execute(sock, msg, cmdArgs, extra);
    await addCommandReaction(sock, msg, command).catch(() => {});
    try { await require('../plugins/autotyping').showTypingAfterCommand(sock, chatId); } catch (_) {}

  } catch (err) { console.error(chalk.red('❌ Handler error:'), err.message); }
}

async function handleGroupParticipantUpdate(sock, update) {
  try {
    const { id, participants, action } = update;
    if (!id.endsWith('@g.us')) return;
    let isPublic = true;
    try { const d = JSON.parse((fs.readFileSync('./data/messageCount.json', 'utf8').trim()) || '{}'); if (typeof d.isPublic === 'boolean') isPublic = d.isPublic; } catch (_) {}
    if (action === 'promote') { if (isPublic) try { await require('../plugins/promote').handlePromotionEvent(sock, id, participants); } catch (_) {} return; }
    if (action === 'demote')  { if (isPublic) try { await require('../plugins/demote').handleDemotionEvent(sock, id, participants); } catch (_) {} return; }
    if (action === 'add')    { try { await require('../plugins/welcome').handleJoinEvent(sock, id, participants); } catch (_) {} }
    if (action === 'remove') { try { await require('../plugins/goodbye').handleLeaveEvent(sock, id, participants); } catch (_) {} }
    if (action === 'request') { try { await require('../plugins/group-cmds').handleJoinApproval(sock, update); } catch (_) {} }
  } catch (err) { console.error('handleGroupParticipantUpdate error:', err.message); }
}

module.exports = {
  handleMessages,
  handleGroupParticipantUpdate,
  handleStatus: async (sock, status) => { try { await require('../plugins/autostatus').handleStatusUpdate(sock, status); } catch (_) {} },
};
