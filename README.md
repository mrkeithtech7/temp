# 🌙 MOON-X V2 — by KEITH TECH

Advanced WhatsApp Bot | Node.js + Baileys | Plugin-Based Architecture

---

## ✨ What's New in V2

| Feature | Details |
|---------|---------|
| 🧩 Plugin System | All commands in /plugins/ — drop a file, it auto-loads |
| 🗄️ Universal DB | MongoDB / PostgreSQL / MySQL / Local JSON (auto-detect) |
| 🔘 Buttons | Menu & Repo use gifted-btns (toggle BUTTONS_MODE=on/off) |
| 🔐 Interactive CLI | No session = console asks SESSION_ID or pairing code |
| 🛡️ Strong Uptime | Anti-restart-storm, RAM watchdog, auto-reconnect |
| 📦 Dynamic Commands | .addcmd / .delcmd / .listcmd at runtime |
| 🗂️ &ls No-Prefix | &ls with NO prefix — list all commands |
| 💀 Hack Command | Fun fake hack with loading bars |
| 🔑 GetFile | .getfile plugins/menu.js — pull any file from repo |

---

## 🚀 Setup

```bash
git clone https://github.com/mrkeithtech7/Moon-X
cd Moon-X
npm install
cp .env.example .env
# Edit .env — set SESSION_ID and OWNER_NUMBER
npm start
```

If no SESSION_ID set, console asks:
```
1. Enter SESSION_ID (starts with KeithTech~)
2. Enter number to get pairing code
Reply with 1 or 2:
```

---

## 🗄️ Database

Set DATABASE_URL in .env:
- MongoDB:    mongodb+srv://user:pass@cluster/moonx
- PostgreSQL: postgresql://user:pass@host:5432/moonx
- MySQL:      mysql://user:pass@host:3306/moonx
- (empty)     Local JSON files — no setup needed

---

## 🧩 Adding Plugin Commands

Create /plugins/mycommand.js:
```js
module.exports = {
  name: 'mycommand',
  aliases: ['mc'],
  category: 'general',
  description: 'My command',
  async execute(sock, msg, args, extra) {
    await extra.reply('Hello from my command!');
  },
};
```

---

## 📋 New Commands

| Command | Description | Who |
|---------|-------------|-----|
| &ls | List all commands (no prefix!) | Everyone |
| .hack | Fake hack animation | Everyone |
| .addcmd name \| response | Add custom command | Owner |
| .delcmd name | Delete custom command | Owner |
| .listcmd | List custom commands | Owner |
| .getcmd name | Get plugin source file | Creator |
| .getfile path | Get file from repo | Owner |
| .pair number | Get pairing code | Everyone |
| .vfc | Export group as VCF | Owner |

---

## 👑 Credits

Developed by Keith Tech | https://github.com/mrkeithtech7
