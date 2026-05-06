const axios = require("axios");

async function copilotCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '👨‍💻', key: message.key }
        });

        // Extract the user's message text
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        // Remove the command prefix (e.g., ".copilot") to get the actual question
        const question = text?.split(' ').slice(1).join(' ').trim();

        if (!question) {
            await sock.sendMessage(chatId, {
                text: "Please provide a question\n\nExample: `.copilot give me a code for js`"
            }, { quoted: message });
            return;
        }

        // Call the Copilot API
        const apiUrl = `https://eliteprotech-apis.zone.id/copilot?q=${encodeURIComponent(question)}`;
        const res = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Validate the response
        if (!res.data || !res.data.success || !res.data.text) {
            throw new Error('Invalid API response');
        }

        // Send the AI-generated text
        await sock.sendMessage(chatId, {
            text: res.data.text
        }, { quoted: message });

        // React with success
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (err) {
        console.error('[COPILOT] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: "❌ An error occurred while processing your request. Please try again later."
        }, { quoted: message });
    }
}

module.exports = {
  name: 'copilot',
  aliases: ['copilotai'],
  category: 'ai',
  description: 'Chat with Copilot AI',
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
    await copilotCommand(sock, chatId, message, q, isOwnerOrSudo, isGroup, senderId, groupMetadata, args);
  },
  _original: copilotCommand,
};
