/**
 * MOON-X V1
 * Powered by KEITH TECH
 */

require('./settings');

const { Boom } = require('@hapi/boom');
const fs    = require('fs');
const os    = require('os');
const chalk = require('chalk');
const path  = require('path');
const axios = require('axios');
const readline = require('readline');
const NodeCache = require('node-cache');
const pino  = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  delay,
} = require('@whiskeysockets/baileys');

const { getPrefixes }    = require('./lib/prefixManager');
const { loadCommands }   = require('./lib/commandLoader');
const store = require('./lib/lightweight_store');
const settings = require('./settings');

// ─── Purple [ MOON-X ] tag used in all console output ────────────────────────
const MX = chalk.hex('#9B59B6').bold('[ MOON-X ]');

// ─── Temp folder ──────────────────────────────────────────────────────────────
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp; process.env.TEMP = customTemp; process.env.TMP = customTemp;
setInterval(() => {
  fs.readdir(customTemp, (err, files) => {
    if (err) return;
    for (const f of files) {
      const fp = path.join(customTemp, f);
      fs.stat(fp, (e, s) => { if (!e && Date.now() - s.mtimeMs > 3*60*60*1000) fs.unlink(fp, () => {}); });
    }
  });
}, 3*60*60*1000);

// ─── Session paths ────────────────────────────────────────────────────────────
const sessionDir = path.join(__dirname, 'session');
const credsPath  = path.join(sessionDir, 'creds.json');
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

// ─── Store & Memory ───────────────────────────────────────────────────────────
store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10_000);
setInterval(() => { if (global.gc) global.gc(); }, 60_000);
setInterval(() => {
  const used = process.memoryUsage().rss / 1024 / 1024;
  if (used > 400) { console.log(chalk.yellow(`${MX} ⚠️  RAM > 400MB, restarting...`)); process.exit(1); }
}, 30_000);

// ─── Anti-restart-storm guard ─────────────────────────────────────────────────
let _restartCount = 0, _lastRestartTime = 0;
function canRestart() {
  const now = Date.now();
  if (now - _lastRestartTime > 60_000) _restartCount = 0;
  _restartCount++; _lastRestartTime = now;
  if (_restartCount > 5) {
    console.error(chalk.red(`${MX} ❌ ${_restartCount} restarts in 1 min — cooling down 30s`));
    return false;
  }
  return true;
}

// ─── Session id functions ──────────────────────────────────────
async function downloadSessionData() {
  try {
    if (fs.existsSync(credsPath)) {
      console.log(chalk.green(`${MX} ✅ Using existing creds.json`));
      return true;
    }
    const sessionId = (settings.SESSION_ID || '').trim();
    if (!sessionId) return false;
    if (!sessionId.startsWith('KeithTech~')) {
      console.log(chalk.red(`${MX} ❌ SESSION_ID must start with "KeithTech~"`));
      return false;
    }
    const b64 = sessionId.replace('KeithTech~', '');
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
      console.log(chalk.red(`${MX} ❌ SESSION_ID has invalid base64 characters`));
      return false;
    }
    const decoded = Buffer.from(b64, 'base64');
    try { JSON.parse(decoded.toString('utf-8')); } catch {
      console.log(chalk.red(`${MX} ❌ SESSION_ID decoded to invalid JSON`));
      return false;
    }
    fs.writeFileSync(credsPath, decoded);
    console.log(chalk.green(`${MX} ✅ Session decoded and saved!`));
    return true;
  } catch (err) {
    console.error(chalk.red(`${MX} ❌ Session error:`), err.message);
    return false;
  }
}

// ─── Interactive CLI ──────────────────────────────────────────────────────────
async function promptSessionChoice() {
  if (!process.stdin.isTTY) return null;

  // Write options BEFORE creating readline so they appear above the input cursor
  process.stdout.write(chalk.hex('#9B59B6')('\n  No session found. How do you want to connect?\n\n'));
  process.stdout.write(chalk.white('  1. SESSION_ID\n'));
  process.stdout.write(chalk.white('  2. PAIRING CODE\n\n'));

  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(res => rl.question(q, res));

  const choice = (await ask(chalk.hex('#9B59B6')('  Enter 1 or 2: '))).trim();

  if (choice === '1') {
    const sid = (await ask(chalk.white('  Paste SESSION_ID: '))).trim();
    rl.close();
    if (sid.startsWith('KeithTech~')) { settings.SESSION_ID = sid; return 'session'; }
    console.log(chalk.red(`${MX} ❌ Invalid SESSION_ID — must start with KeithTech~`));
    return null;
  }

  if (choice === '2') {
    const num = (await ask(chalk.white('  Enter your WhatsApp number (e.g. 263789xxxxxx): '))).trim().replace(/[^0-9]/g, '');
    rl.close();
    if (num.length >= 7) return { type: 'pairing', number: num };
    console.log(chalk.red(`${MX} ❌ Invalid number`));
    return null;
  }

  rl.close();
  return null;
}

// ─── Globals ──────────────────────────────────────────────────────────────────
global.packname    = settings.packname;
global.author      = settings.author;
global.channelLink = 'https://whatsapp.com/channel/0029VbANWX1DuMRi1VNPlB0y';
global.botname     = settings.botName || 'MOON-X';

// ─── AutoBio ─────────────────────────────────────────────────────────────────
const BIO_TEMPLATES = [
  '🤖 {botName} | ⏰ {time} | 📅 {date}',
  '⚡ Online & Active | {time} | Powered by Keith',
  '🌙 {botName} | Running 24/7 | {time} {date}',
  '🚀 {botName} | {date} | {time} | Always Online',
];
let _autoBioInterval = null, _bioIdx = 0;
function startAutoBio(sock) {
  if (_autoBioInterval) { clearInterval(_autoBioInterval); _autoBioInterval = null; }
  async function updateBio() {
    try {
      delete require.cache[require.resolve('./settings')];
      const s = require('./settings');
      if ((s.autoBio||'off').toLowerCase() !== 'on') return;
      const tz = s.timezone || 'Africa/Harare';
      const now = new Date();
      const ts = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:tz });
      const ds = now.toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'numeric', timeZone:tz });
      const bio = BIO_TEMPLATES[_bioIdx++ % BIO_TEMPLATES.length]
        .replace(/\{botName\}/g, s.botName||'MOON-X')
        .replace(/\{time\}/g, ts).replace(/\{date\}/g, ds);
      await sock.updateProfileStatus(bio);
    } catch (_) {}
  }
  updateBio();
  _autoBioInterval = setInterval(updateBio, 5*60*1000);
}

let _presenceInterval = null;
function startPresenceManager(sock) {
  if (_presenceInterval) { clearInterval(_presenceInterval); _presenceInterval = null; }
  _presenceInterval = setInterval(async () => {
    try {
      delete require.cache[require.resolve('./settings')];
      const s = require('./settings');
      if ((s.alwaysOnline||'off').toLowerCase() === 'on') await sock.sendPresenceUpdate('available').catch(()=>{});
      else if ((s.alwaysOffline||'off').toLowerCase() === 'on') await sock.sendPresenceUpdate('unavailable').catch(()=>{});
    } catch (_) {}
  }, 30_000);
}
global.startAutoBio = startAutoBio;
global.startPresenceManager = startPresenceManager;

// ─── Antiedit cache ───────────────────────────────────────────────────────────
const _antieditCache = new Map();
function cacheOriginalMsg(chatId, msgId, content, sender) {
  if (!content?.trim()) return;
  const key = `${chatId}:${msgId}`;
  _antieditCache.set(key, { content: content.trim(), sender });
  setTimeout(() => _antieditCache.delete(key), 30*60*1000);
}
function getCachedOriginal(chatId, msgId) { return _antieditCache.get(`${chatId}:${msgId}`) || null; }
function extractMsgText(msg) {
  if (!msg) return '';
  return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
}

// ─── COMMAND CATEGORIES ───────────────────────────────────────────────────────
const COMMAND_CATEGORIES = {
  OWNER:      ['addcmd','delcmd','listcmd','getcmd','getfile','botimg','botname','block','unblock',
                'clearsession','cleartmp','antidelete','antiedit','update','settings','setpp',
                'autoreact','autostatus','autotyping','autoread','anticall','pmblocker',
                'autobio','alwaysonline','alwaysoffline','setowner','setmenustyle',
                'addsudo','delsudo','listsudo','restart','broadcast','prefix'],
  AI:         ['ai','gpt','gemini','imagine','sora','claude','deepseek','qwen','groq','copilot'],
  DOWNLOADER: ['play','song','spotify','apk','instagram','facebook','tiktok','video'],
  GENERAL:    ['menu','ping','uptime','alive','repo','owner','staff','pair','getpp','ss',
                'groupinfo','tourl','send','tiny','hack','tutorial','translate','weather',
                'tts','lyrics','bible','fact','joke','quote','news'],
  ADMIN:      ['ban','unban','promote','demote','mute','unmute','kick','kickall','warn','warnings',
                'antilink','antibadword','antitag','clear','delete','tagall','hidetag',
                'tagnotadmin','tag','chatbot','resetlink','welcome','goodbye',
                'setgdesc','setgname','setgpp','setgstatus','joinapproval'],
  IMAGE_STICKER: ['sticker','simage','removebg','remini','take','attp','emojimix',
                   'igs','gptimage','meme','blur'],
  ANIME:      ['nom','poke','cry','kiss','pat','hug','wink','facepalm','waifu',
                'neko','megumin','maid','anime','dog'],
  GAME:       ['tictactoe','hangman','trivia','truth','dare','8ball'],
  FUN:        ['compliment','insult','flirt','character','wasted','ship','simp','pies',
                'goodnight','roseday','shayari','stupid','gif'],
  TEXTMAKER:  ['metallic','ice','snow','impressive','matrix','neon','devil','fire','glitch'],
  MISC:       ['heart','circle','tweet','ytcomment','gay','glass','jail','triggered','wasted'],
  GITHUB:     ['repo','gitclone','vfc'],
  BUG:       ['crash-gc','group-death','ios-crash','moon-crash','brute-close'],
};

function getRAMUsage() {
  const total = os.totalmem(), free = os.freemem(), used = total - free;
  const pct = ((used/total)*100).toFixed(1);
  const bar = '█'.repeat(Math.round((used/total)*8)) + '░'.repeat(8-Math.round((used/total)*8));
  const fmt = n => parseFloat(n.toFixed(1)).toString();
  return { bar, text: `${fmt(used/1024/1024)} MB / ${fmt(total/1024/1024/1024)} GB`, percentage: pct };
}
function getPlatform() {
  const env = process.env;
  if (env.DYNO) return 'Heroku';
  if (env.RAILWAY_ENVIRONMENT) return 'Railway';
  if (env.RENDER) return 'Render';
  if (env.KOYEB_PUBLIC_DOMAIN) return 'Koyeb';
  if (env.REPL_ID) return 'Replit';
  if (env.TERMUX_VERSION || process.platform==='android') return 'Termux';
  if (os.hostname().toLowerCase().includes('keith')) return 'Keith Host';
  return os.platform() === 'win32' ? 'Windows' : 'Linux';
}
function getTotalCommands() { return Object.values(COMMAND_CATEGORIES).reduce((t,c) => t+c.length, 0); }
function getPushname(msg) { return msg.pushName || msg.key.participant?.split('@')[0] || 'User'; }
function formatCommands(cmds) {
  const pfx = getPrefixes ? getPrefixes()[0] : '.';
  return cmds.map(c => `┃${pfx}${c}`).join('\n');
}
global.menuHelpers = { getPrefixes, COMMAND_CATEGORIES, getRAMUsage, getPlatform, getTotalCommands, getPushname, formatCommands };

// ─── MAIN BOT FUNCTION ────────────────────────────────────────────────────────
async function startMoonX() {
  try {
    loadCommands();

    const sessionOk = await downloadSessionData();
    let pairingNumber = null;

    if (!sessionOk) {
      const choice = await promptSessionChoice();
      if (choice === 'session') {
        await downloadSessionData();
      } else if (choice?.type === 'pairing') {
        pairingNumber = choice.number;
      }
    }

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const msgRetryCounterCache = new NodeCache();

    const usePairing = !!pairingNumber || (!!settings.ownerNumber && !fs.existsSync(credsPath));

    const KeithTech = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level:'fatal' }).child({ level:'fatal' })),
      },
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      retryRequestDelayMs: 10_000,
      transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
      maxMsgRetryCount: 15,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      emitOwnEvents: true,
      getMessage: async (key) => {
        const jid = jidNormalizedUser(key.remoteJid);
        const msg = await store.loadMessage(jid, key.id);
        return msg?.message || '';
      },
      msgRetryCounterCache,
      defaultQueryTimeoutMs: 60_000,
    });

    KeithTech.ev.on('creds.update', saveCreds);
    store.bind(KeithTech.ev);

    // ── Lazy-load  ─────────────
    const getHandler = () => require('./lib/handler');

    KeithTech.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;
          if (msg.key.id?.startsWith('BAE5') && msg.key.id.length === 16) continue;
          const inner = msg.message?.ephemeralMessage?.message || msg.message;
          const text = extractMsgText(inner);
          if (text) cacheOriginalMsg(msg.key.remoteJid, msg.key.id, text, msg.key.participant || msg.key.remoteJid);
        } catch (_) {}
      }
    });

    // ── Antiedit detection ────────────────────────────────────────────────
    KeithTech.ev.on('messages.update', async (updates) => {
      try {
        delete require.cache[require.resolve('./settings')];
        const _s = require('./settings');
        if (String(_s.antieditEnabled ?? true).toLowerCase() === 'false') return;
        try { const { isAntieditEnabled } = require('./lib/antiedit'); if (!isAntieditEnabled()) return; } catch (_) {}
        for (const update of updates) {
          try {
            if (!update.update?.message) continue;
            const chatId = update.key.remoteJid, msgId = update.key.id;
            const sender = update.key.participant || update.key.remoteJid;
            if (!chatId || !msgId) continue;
            const u = update.update.message;
            let edited = u?.protocolMessage?.editedMessage?.conversation
              || u?.protocolMessage?.editedMessage?.extendedTextMessage?.text
              || u?.editedMessage?.message?.conversation
              || u?.editedMessage?.message?.extendedTextMessage?.text
              || (u?.conversation || '');
            if (!edited?.trim()) continue;
            edited = edited.trim();
            const original = getCachedOriginal(chatId, msgId);
            let origContent = original?.content || null;
            if (!origContent) { try { origContent = require('./lib/antiedit').getOriginalMessage(chatId, msgId)?.content; } catch (_) {} }
            if (!origContent || edited === origContent) continue;
            const isGroup = chatId.endsWith('@g.us');
            const mode = (() => { try { return require('./lib/antiedit').getAntieditMode(); } catch { return _s.antieditMode || 'public'; } })();
            const alertText = `
⚠️ *ANTI-EDIT ALERT!*

👤 *Sender:* @${sender.split('@')[0]}${isGroup ? `
🏠 *Group:* ${chatId.split('@')[0]}` : ''}

📝 *Original:*\n${origContent}

✏️ *Edited To:*\n${edited}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴏᴏɴ x`;
            if (mode === 'private') {
              const ownerJid = (settings.ownerNumber||'').replace(/[^0-9]/g,'') + '@s.whatsapp.net';
              if (ownerJid !== '@s.whatsapp.net') await KeithTech.sendMessage(ownerJid, { text: alertText, mentions: [sender] }).catch(()=>{});
            } else {
              await KeithTech.sendMessage(chatId, { text: alertText, mentions: [sender] }).catch(()=>{});
            }
            cacheOriginalMsg(chatId, msgId, edited, sender);
          } catch (_) {}
        }
      } catch (_) {}
    });

    // ── Main message handler ──────────────────────────────────────────────
    KeithTech.ev.on('messages.upsert', async chatUpdate => {
      try {
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;
        mek.message = Object.keys(mek.message)[0] === 'ephemeralMessage'
          ? mek.message.ephemeralMessage.message : mek.message;
        if (mek.key?.remoteJid === 'status@broadcast') { await getHandler().handleStatus(KeithTech, chatUpdate); return; }
        if (!KeithTech.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
          if (!mek.key.remoteJid?.endsWith('@g.us')) return;
        }
        if (mek.key.id?.startsWith('BAE5') && mek.key.id.length === 16) return;
        if (KeithTech?.msgRetryCounterCache) KeithTech.msgRetryCounterCache.clear();
        await getHandler().handleMessages(KeithTech, chatUpdate);
      } catch (err) { console.error(chalk.red('messages.upsert error:'), err.message); }
    });

    // ── Pairing code ──────────────────────────────────────────────────────
    if (usePairing && !KeithTech.authState.creds.registered) {
      const phone = (pairingNumber || settings.ownerNumber?.toString() || '').replace(/[^0-9]/g, '');
      if (phone.length >= 7) {
        setTimeout(async () => {
          try {
            let code = await KeithTech.requestPairingCode(phone, 'MRKEITHX');
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(chalk.hex('#9B59B6')('\n  ┌─────────────────────────────┐'));
            console.log(chalk.hex('#9B59B6')('  │      PAIRING CODE           │'));
            console.log(chalk.hex('#9B59B6')('  └─────────────────────────────┘'));
            console.log(chalk.white.bold(`\n  Code: `) + chalk.greenBright.bold(code));
            console.log(chalk.white('\n  WhatsApp → Settings → Linked Devices → Link Device\n'));
          } catch (_) {
            // Silent — retry handled by connection.update
          }
        }, 3000);
      }
    }

    KeithTech.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) { const d = jidDecode(jid)||{}; return d.user && d.server ? d.user+'@'+d.server : jid; }
      return jid;
    };
    KeithTech.ev.on('contacts.update', update => {
      for (const c of update) { const id = KeithTech.decodeJid(c.id); if (store?.contacts) store.contacts[id] = { id, name: c.notify }; }
    });
    KeithTech.public = true;

    // ── Anti-call ────────────────────────────────────────────────────────
    const antiCallNotified = new Set();
    KeithTech.ev.on('call', async (calls) => {
      try {
        const { readState } = require('./plugins/anticall');
        if (!readState().enabled) return;
        for (const call of calls) {
          const callerJid = call.from || call.peerJid || call.chatId;
          if (!callerJid) continue;
          try { if (typeof KeithTech.rejectCall === 'function' && call.id) await KeithTech.rejectCall(call.id, callerJid); } catch (_) {}
          if (!antiCallNotified.has(callerJid)) {
            antiCallNotified.add(callerJid);
            setTimeout(() => antiCallNotified.delete(callerJid), 60_000);
            await KeithTech.sendMessage(callerJid, { text: '📵 *Calls are not allowed at the moment!*' });
          }
          setTimeout(async () => { try { await KeithTech.updateBlockStatus(callerJid, 'block'); } catch (_) {} }, 800);
        }
      } catch (_) {}
    });

    // ── Group & Status ────────────────────────────────────────────────────
    KeithTech.ev.on('group-participants.update', async (update) => { await getHandler().handleGroupParticipantUpdate(KeithTech, update); });
    KeithTech.ev.on('messages.upsert', async (m) => { if (m.messages[0]?.key?.remoteJid === 'status@broadcast') await getHandler().handleStatus(KeithTech, m); });
    KeithTech.ev.on('status.update', async (s) => await getHandler().handleStatus(KeithTech, s));
    KeithTech.ev.on('messages.reaction', async (s) => await getHandler().handleStatus(KeithTech, s));

    // ── Connection update ─────────────────────────────────────────────────
    KeithTech.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(chalk.yellow(`\n[ MOON-X ] ⚠️ Connection closed (reason: ${reason})`));
        if (reason === DisconnectReason.badSession) { console.log(chalk.red('❌ Bad Session — delete session/ folder')); process.exit(0); }
        if (reason === DisconnectReason.loggedOut) { console.log(chalk.red('❌ Logged out')); try { require('fs').rmSync('./session',{recursive:true,force:true}); } catch (_) {} process.exit(1); }
        if (reason === DisconnectReason.connectionReplaced) { console.log(chalk.red('❌ Connection replaced')); process.exit(1); }
        if (canRestart()) { await delay(3000); startMoonX(); }
        else { await delay(30_000); _restartCount = 0; startMoonX(); }
      } else if (connection === 'open') {
        console.log(chalk.green('\n[ MOON-X ] ✅ Connected!\n'));
        console.log(chalk.cyan('===========================================>'));
        console.log(chalk.yellow(`>> Bot: ${settings.botName || 'MOON-X'}`));
        console.log(chalk.green(`>> Date: ${new Date().toLocaleDateString()}`));
        console.log(chalk.blue(`>> Time: ${new Date().toLocaleTimeString()}`));
        console.log(chalk.magenta(`>> Version: ${settings.version}`));
        console.log(chalk.cyan('===========================================>'));
        try {
          const botNum = KeithTech.user.id.split(':')[0] + '@s.whatsapp.net';
          delete require.cache[require.resolve('./settings')];
          const _s = require('./settings');
          const onOff = v => String(v||'off').toLowerCase() === 'on' ? '✅ ON' : '❌ OFF';
          const text = `✅ *Moon-X V2 Connected!*
         
🤖 *Bot:* ${_s.botName||'MOON-X'}\n👑 *

Owner:* ${KeithTech.user.id.split(':')[0]}

🔧 *Mode:* ${_s.commandMode||'public'}

🗄️ *DB:* ${require('./database').DB_TYPE.toUpperCase()}

🛠️ *Prefix:* [ ${Array.isArray(_s.Prefix)?_s.Prefix.join(', '):_s.Prefix} ]


📅 *Date:* ${new Date().toLocaleDateString()}

⚙️ AutoBio: ${onOff(_s.autoBio)} | Online: ${onOff(_s.alwaysOnline)}

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋᴇɪᴛʜ ᴛᴇᴄʜ`;
          let imgBuf = null;
          try { const r = await axios.get('https://mrfrankk-cdn.hf.space/keithtech/moonx.png',{responseType:'arraybuffer',timeout:8000}); imgBuf = Buffer.from(r.data); } catch (_) {}
          if (imgBuf) await KeithTech.sendMessage(botNum, { image: imgBuf, caption: text });
          else await KeithTech.sendMessage(botNum, { text });
        } catch (_) {}
        startAutoBio(KeithTech);
        startPresenceManager(KeithTech);
      }
    });

    return KeithTech;
  } catch (err) {
    console.error(chalk.red('❌ startMoonX error:'), err.message);
    if (canRestart()) { await delay(5000); return startMoonX(); }
    await delay(30_000); _restartCount = 0; return startMoonX();
  }
}

process.on('uncaughtException',  err => console.error(chalk.red('Uncaught Exception:'), err.message));
process.on('unhandledRejection', err => console.error(chalk.red('Unhandled Rejection:'), err?.message || err));

startMoonX().catch(err => { console.error(chalk.red('❌ Fatal:'), err); process.exit(1); });

const _file = require.resolve(__filename);
fs.watchFile(_file, () => { fs.unwatchFile(_file); delete require.cache[_file]; require(_file); });
