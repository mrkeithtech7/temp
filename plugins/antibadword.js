const { handleAntiBadwordCommand } = require('../lib/antibadword');
const isAdminHelper = require('../lib/isAdmin');

async function antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

       
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        const match = text.split(' ').slice(1).join(' ');

        await handleAntiBadwordCommand(sock, chatId, message, match);
    } catch (error) {
        console.error('Error in antibadword command:', error);
        await sock.sendMessage(chatId, { text: '*Error processing antibadword command*' }, { quoted: message });
    }
}

module.exports = {
  name: 'antibadword',
  aliases: ['badword'],
  category: 'admin',
  description: 'Toggle anti-badword',
  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    const from   = extra.from;
    const message = msg;
    const isOwnerOrSudo = extra.isOwner;
    const isGroup = extra.isGroup;
    const senderId = extra.sender;
    const senderIsSudo = extra.isOwner;
    const groupMetadata = extra.groupMetadata;
    const q = args.join(' ').trim();
    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    await antibadwordCommand(sock, chatId, message, q, isOwnerOrSudo, isGroup, senderId, groupMetadata, args);
  },
  _original: antibadwordCommand,
};
 