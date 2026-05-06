// Claude Ai

const axios = require("axios");

 async function claudeCommand( sock, chatId, message ) {
        try {
 await sock.sendMessage(chatId, {
            react: { text: '👨‍💻', key: message.key }
        }); 
            
 const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
       
           if (!text) {
 await sock.sendMessage(chatId, { 
                text: "Please provide a question\n\nExample: .claude give me a code for js"
            });
        }
  const res = await axios.get(`https://apis.xwolf.space/api/ai/claude?q=${encodeURIComponent(text)}`);
 if (!res.data || !res.data.result || !res.data.result.text){
 await sock.sendMessage(chatId, { 
                text: "Error occurred"},{ quoted: message
            });
        }
  
 await sock.sendMessage(chatId, {
                text: res.data.result.text
            },{ quoted: message });
  
  await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });            
            
        } catch (err) {
            console.error(err);
   await sock.sendMessage(chatId, { 
                text: "❎ Error occured"
            },{ quoted: message });
            
        }
    };

module.exports = {
  name: 'claude',
  aliases: ['claudeai'],
  category: 'ai',
  description: 'Chat with Claude AI',
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
    await claudeCommand(sock, chatId, message, q, isOwnerOrSudo, isGroup, senderId, groupMetadata, args);
  },
  _original: claudeCommand,
};
