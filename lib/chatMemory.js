// ─────────────────────────────────────────────────
//  lib/chatMemory.js
//  Moon-X AI — Persistent Conversation Memory
//  Stores per-user chat history across restarts
//  Keith Tech © 2026
// ─────────────────────────────────────────────────

'use strict';

const fs   = require('fs');
const path = require('path');

const MEMORY_DIR  = path.join(__dirname, '../data/ai_memory');
const MAX_HISTORY = 30; // max messages kept per user

// Ensure memory folder exists
if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });

// In-memory cache so we don't hit disk on every message
const _cache = new Map();

// Sanitise JID to safe filename: strip @s.whatsapp.net / @g.us etc.
function _key(jid) {
  return (jid || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function _filePath(jid) {
  return path.join(MEMORY_DIR, `${_key(jid)}.json`);
}

// ── Load history for a user ───────────────────────
function loadHistory(jid) {
  if (_cache.has(jid)) return _cache.get(jid);
  try {
    const fp = _filePath(jid);
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      _cache.set(jid, data);
      return data;
    }
  } catch (_) {}
  return [];
}

// ── Save history for a user ───────────────────────
function saveHistory(jid, history) {
  const trimmed = history.slice(-MAX_HISTORY);
  _cache.set(jid, trimmed);
  try {
    fs.writeFileSync(_filePath(jid), JSON.stringify(trimmed, null, 2));
  } catch (_) {}
}

// ── Append a message pair (user + bot) ───────────
function appendHistory(jid, userText, botText) {
  const history = loadHistory(jid);
  history.push({ role: 'user', text: userText,  ts: Date.now() });
  history.push({ role: 'bot',  text: botText,   ts: Date.now() });
  saveHistory(jid, history);
}

// ── Clear history for a user ─────────────────────
function clearHistory(jid) {
  _cache.delete(jid);
  try { fs.unlinkSync(_filePath(jid)); } catch (_) {}
}

// ── Format history into readable context string ───
function buildContext(jid) {
  const history = loadHistory(jid);
  if (!history.length) return 'No prior conversation.';
  return history
    .map(h => `${h.role === 'user' ? 'User' : 'Moon X'}: ${h.text}`)
    .join('\n');
}

// ── List all users with saved memory ─────────────
function listUsers() {
  try {
    return fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (_) { return []; }
}

module.exports = { loadHistory, saveHistory, appendHistory, clearHistory, buildContext, listUsers };
