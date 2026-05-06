/*==================================
              MOON X V2
  DEVELOPED BY  K E I T H   T E C H
================================*/

const fs = require('fs');
if (fs.existsSync('.env')) require('dotenv').config({ path: __dirname + '/.env' });

const settings = {
  //====== DONT CHANGE =============//
  packname: process.env.PACKAGE_NAME || 'Mr Keith Tech',
  author:   process.env.AUTHOUR     || 'KEITH TECH',

  //======= BOT SETTINGS ============//
  SESSION_ID:      process.env.SESSION_ID    || '',
  botName:         process.env.BOT_NAME      || 'MOON-X',
  commandMode:     process.env.COMMAND_MODE  || 'public',
  MenuStyle:       process.env.MENU_STYLE    || 'v1',
  timezone:        process.env.TIME_ZONE     || 'Africa/Harare',
  botOwner:        process.env.BOT_OWNER     || 'ᴋᴇɪᴛʜ ᴛᴇᴄʜ',
  ownerNumber:     process.env.OWNER_NUMBER  || '',
  autoBio:         process.env.AUTO_BIO      || 'off',
  alwaysOnline:    process.env.ALWAYS_ONLINE  || 'off',
  alwaysOffline:   process.env.ALWAYS_OFFLINE || 'off',
  antieditMode:    process.env.ANTIEDIT_MODE  || 'public',
  antieditEnabled: process.env.ANTIEDIT_ENABLED !== 'false',

  // ── Moon-X AI Auto-Reply ─────────────────────────────────────────────────
  // enabled : true/false  — master on/off switch
  // mode    : 'private' | 'public' | 'group' | 'owner'
  //   private = DMs only (default) | public = everywhere
  //   group   = groups only        | owner  = owner/sudo only
  // replyMode: 'text' | 'audio'
  //   text  = reply as normal text message (default)
  //   audio = convert reply to voice note using TTS
  moonxAI: {
    enabled:   (process.env.MOONX_AI_ENABLED   || 'on').toLowerCase() !== 'off',
    mode:       process.env.MOONX_AI_MODE       || 'private',
    replyMode:  process.env.MOONX_AI_REPLY_MODE || 'text',
  },

  // Supported:
  //   mongodb:// or mongodb+srv://  → MongoDB
  //   postgres:// or postgresql://  → PostgreSQL
  //   mysql:// or mysql2://         → MySQL
  // Leave empty to use local JSON storage (no DB required).
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Buttons feature
  BUTTONS_MODE: process.env.BUTTONS_MODE || 'on',

 
  CHANNEL_URL: process.env.CHANNEL_URL || 'https://whatsapp.com/channel/0029VamFDin4NVi0MoBrRi1p',


  REPO_URL: process.env.REPO_URL || 'https://github.com/mrkeithtech7/Moon-X',

  // Prefix
  Prefix: process.env.PREFIXES
    ? (process.env.PREFIXES.includes(',') ? process.env.PREFIXES.split(',') : process.env.PREFIXES)
    : ['.'],

  //======== DONT CHANGE ===========//
  giphyApiKey:        process.env.GIPHYAPIKEY         || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  maxStoreMessages:   process.env.MAX_STORE_MESSAGES   || 20,
  storeWriteInterval: process.env.STORE_WRITE_INTERVAL || 10000,
  description: process.env.DESCRIPTION || 'ADVANCED W.A BOT DEVELOPED BY KEITH TECH',
  version:     process.env.VERSION      || '2.0.0',
};

module.exports = settings;