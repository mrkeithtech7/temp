// Codes By Keith Tech, give credit!
const settings = require('../settings');
const fs   = require('fs');
const path = require('path');
const { Vcard } = require('../lib/Keith');
const { getUptime } = require('../lib/runtime');
const readMore = String.fromCharCode(8206).repeat(4001);

function getMenuStyle() {
  try {
    const dataPath = path.join(__dirname, '../data/menutype.json');
    if (fs.existsSync(dataPath)) {
      const d = JSON.parse(fs.readFileSync(dataPath, 'utf8').trim() || '{}');
      return (d.type || settings.MenuStyle || 'v1').toLowerCase();
    }
  } catch (_) {}
  return (settings.MenuStyle || 'v1').toLowerCase();
}

module.exports = {
  name: 'menu',
  aliases: ['moon', 'keithx', 'moonx', 'help'],
  category: 'general',
  description: 'Show the bot command menu',
  usage: '.menu',

  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    try {
      const {
        getPrefixes, getRAMUsage,
        getPlatform, getPushname,
      } = global.menuHelpers;

      // ── Dynamic command loader ──────────────────────────────────────────────
      const { getUniqueCommands } = require('../lib/commandLoader');
      const uniqueCmds = getUniqueCommands();

      // Group commands by their .category field (names only, sorted)
      const categoryMap = {};
      for (const cmd of uniqueCmds) {
        const cat = (cmd.category || 'uncategorized').toUpperCase();
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push(cmd.name);
      }
      // Sort names inside each category
      for (const cat of Object.keys(categoryMap)) categoryMap[cat].sort();

      // Total = real unique command count from loader
      const totalCmds = uniqueCmds.length;

      // ── Other helpers ───────────────────────────────────────────────────────
      const pushname = getPushname(msg);
      const uptime = getUptime();
      const ramUsage = getRAMUsage();
      const platform = getPlatform();
      const prefixes = getPrefixes ? getPrefixes() : (Array.isArray(settings.Prefix) ? settings.Prefix : [settings.Prefix]);
      const primaryPrefix = prefixes[0];
      const menuStyle = getMenuStyle();

      delete require.cache[require.resolve('../settings')];
      const s = require('../settings');

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: s.timezone || 'Africa/Harare',
      });

      // fmtCat now takes names array directly — shows each command, no count
      function fmtCat(label, names) {
        if (!names || names.length === 0) return '';
        const lines = names.map(c => `│✧ ${primaryPrefix}${c}`).join('\n');
        return `┌─・▣ \`${label}\` ・▣\n${lines}\n└─・▣`;
      }

      // Build category order: known ones first, then any extra categories after
      const ORDERED_CATS = [
        'OWNER', 'AI', 'DOWNLOADER', 'GENERAL', 'ADMIN',
        'IMAGE_STICKER', 'ANIME', 'GAME', 'FUN',
        'TEXTMAKER', 'MISC', 'GITHUB','BUG',
      ];
      // Labels to display for known categories
      const CAT_LABELS = {
        OWNER: 'OWNER', AI: 'AI', DOWNLOADER: 'DOWNLOAD',
        GENERAL: 'GENERAL', ADMIN: 'ADMIN', IMAGE_STICKER: 'STICKER',
        ANIME: 'ANIME', GAME: 'GAME', FUN: 'FUN',
        TEXTMAKER: 'TEXTMAKER', MISC: 'MISC', GITHUB: 'GITHUB', BUG: 'BUG',
      };

      // Render ordered categories, then any unknown ones appended at the end
      const renderedCats = [];
      const seen = new Set();
      for (const key of ORDERED_CATS) {
        seen.add(key);
        const block = fmtCat(CAT_LABELS[key] || key, categoryMap[key]);
        if (block) renderedCats.push(block);
      }
      // Any extra categories not in ORDERED_CATS (future-proof)
      for (const key of Object.keys(categoryMap).sort()) {
        if (!seen.has(key)) {
          const block = fmtCat(key, categoryMap[key]);
          if (block) renderedCats.push(block);
        }
      }

      const header =
`╭─ ▣ ⋅ *${s.botName || 'MOON-X'}* ⋅ ▣ ──
│✦ *Usᴇʀ* : ${pushname}
│✦ *Oᴡɴᴇʀ* : ${s.botOwner || 'Not Set!'}
│✦ *Pʀᴇғɪx* : [ ${Array.isArray(s.Prefix) ? s.Prefix.join(', ') : s.Prefix} ]
│✦ *Tɪᴍᴇ* : ${timeStr}
│✦ *Cᴏᴍᴍᴀɴᴅs* : ${totalCmds}
│✦ *Vᴇʀsɪᴏɴ* : ${s.version || '2.0.0'}
│✦ *Hᴏsᴛ* : ${platform}
│✦ *Mᴏᴅᴇ* : ${s.commandMode || 'public'}
│✦ *Uᴘᴛɪᴍᴇ* : ${uptime}
│✦ *Rᴀᴍ* : ${ramUsage.bar} ${ramUsage.percentage}%
│✦ *Usage* : ${ramUsage.text}
╰──────────────`;

      const body =
`${readMore}
${renderedCats.join('\n\n')}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋᴇɪᴛʜ ᴛᴇᴄʜ`;

      const fullText = header + '\n' + body;

      await sock.sendMessage(chatId, { text: '_⚡ loading menu..._' }, { quoted: Vcard });

      const imagePath = path.join(__dirname, '../assets/Menu.jpg');
      const imgBuffer = (menuStyle === 'v1' && fs.existsSync(imagePath)) ? fs.readFileSync(imagePath) : null;

      // ── Plain menu only ───────────────────────────────────────────────────────
      if (imgBuffer) {
        await sock.sendMessage(chatId, { image: imgBuffer, caption: fullText }, { quoted: Vcard });
      } else {
        await sock.sendMessage(chatId, { text: fullText }, { quoted: Vcard });
      }

    } catch (error) {
      console.error('Error in menu command:', error);
      await sock.sendMessage(chatId, { text: '❌ Error displaying menu. Try again.' });
    }
  },
};