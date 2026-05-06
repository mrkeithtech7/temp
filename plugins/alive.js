// ─────────────────────────────────────────────────
//  name    : alive
//  aliases : isalive
//  category: general
//  desc    : Check if bot is online
// ─────────────────────────────────────────────────

'use strict';
const fs       = require('fs');
const path     = require('path');
const settings = require('../settings');
const { getUptime } = require('../lib/runtime');

module.exports = {
  name:     'alive',
  aliases:  ['isalive', 'online'],
  category: 'general',
  description: 'Check if bot is alive/online',
  usage:    '.alive',

  async execute(sock, msg, args, extra) {
    const chatId   = extra.from;
    const pushname = msg.pushName || extra.sender?.split('@')[0] || 'User';
    const uptime   = getUptime();

    try {
      await sock.sendMessage(chatId, { react: { text: '⚡', key: msg.key } });
    } catch (_) {}

    const caption =
`     ☆ \`${settings.botName}\` ☆

 Hi 👋 @${pushname}

 *🔋 Uᴘᴛɪᴍᴇ:* ${uptime}
 *⚡ Vᴇʀsɪᴏɴ:* ${settings.version || '2.0.0'}
 \`Sᴛᴀᴛᴜs\`: *ONLINE* 🚀

🔗 ${settings.REPO_URL || 'https://github.com/mrkeithtech7/Moon-X'}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋᴇɪᴛʜ ᴛᴇᴄʜ`.trim();

    const mentions = [extra.sender];

    // Try to send with image
    const imgPaths = [
      path.join(__dirname, '../assets/Menu.jpg'),
      path.join(__dirname, '../assets/Repo-img.png'),
    ];
    let imgBuffer = null;
    for (const p of imgPaths) {
      try { if (fs.existsSync(p)) { imgBuffer = fs.readFileSync(p); break; } } catch (_) {}
    }

    if (imgBuffer) {
      await sock.sendMessage(chatId, { image: imgBuffer, caption, mentions }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, { text: caption, mentions }, { quoted: msg });
    }
  },
};
