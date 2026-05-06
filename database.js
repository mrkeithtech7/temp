/**
 * MOON-X Universal Database Adapter

 */

const fs   = require('fs');
const path = require('path');

const settings = (() => { try { return require('./settings'); } catch (_) { return {}; } })();

const DB_URL   = settings.DATABASE_URL || process.env.DATABASE_URL || '';
const LOCAL_DIR = path.join(__dirname, 'database');

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

const localFiles = {
  groups:     path.join(LOCAL_DIR, 'groups.json'),
  users:      path.join(LOCAL_DIR, 'users.json'),
  warnings:   path.join(LOCAL_DIR, 'warnings.json'),
  mods:       path.join(LOCAL_DIR, 'mods.json'),
  customCmds: path.join(LOCAL_DIR, 'custom_commands.json'),
  banned:     path.join(LOCAL_DIR, 'banned.json'),
};

const initLocal = (f, d = {}) => { if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(d, null, 2)); };
Object.values(localFiles).forEach(f => initLocal(f));

const readLocal  = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf-8')); } catch { return {}; } };
const writeLocal = (f, d) => { try { fs.writeFileSync(f, JSON.stringify(d, null, 2)); return true; } catch { return false; } };

const DEFAULT_GROUP = {
  antilink: false, antilinkAction: 'delete',
  antitag: false,  antitagAction: 'delete',
  antibadword: false, antidelete: false, antiedit: false,
  welcome: false, welcomeMessage: '', goodbye: false, goodbyeMessage: '',
  mute: false, chatbot: false, autosticker: false, anticall: false,
  joinapproval: false, warn_limit: 3,
};

function getDbType() {
  if (!DB_URL) return 'json';
  if (DB_URL.startsWith('mongodb'))              return 'mongodb';
  if (DB_URL.startsWith('postgres') || DB_URL.startsWith('postgresql')) return 'postgres';
  if (DB_URL.startsWith('mysql')    || DB_URL.startsWith('mysql2'))     return 'mysql';
  return 'json';
}
const DB_TYPE = getDbType();

// ─── LAZY DB CLIENTS ────────────────────────────────────────────────────────
let _mongoDB = null, _pgClient = null, _mysqlClient = null;
let _dbConnectLogged = false; 
async function getMongoDb() {
  if (_mongoDB) return _mongoDB;
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(DB_URL, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  _mongoDB = client.db();
  if (!_dbConnectLogged) { console.log('✅ [DB] MongoDB connected'); _dbConnectLogged = true; }
  return _mongoDB;
}

async function getPgClient() {
  if (_pgClient) return _pgClient;
  const { Client } = require('pg');
  _pgClient = new Client({ connectionString: DB_URL });
  await _pgClient.connect();
  await _pgClient.query('CREATE TABLE IF NOT EXISTS moonx_kv (k TEXT PRIMARY KEY, v TEXT)');
  if (!_dbConnectLogged) { console.log('✅ [DB] PostgreSQL connected'); _dbConnectLogged = true; }
  return _pgClient;
}

async function getMysqlClient() {
  if (_mysqlClient) return _mysqlClient;
  const mysql = require('mysql2/promise');
  _mysqlClient = await mysql.createConnection(DB_URL);
  await _mysqlClient.execute('CREATE TABLE IF NOT EXISTS moonx_kv (k VARCHAR(255) PRIMARY KEY, v LONGTEXT)');
  if (!_dbConnectLogged) { console.log('✅ [DB] MySQL connected'); _dbConnectLogged = true; }
  return _mysqlClient;
}

// ─── GENERIC GET / SET ──────────────────────────────────────────────────────
async function dbGet(collection, key) {
  try {
    if (DB_TYPE === 'mongodb') {
      const db  = await getMongoDb();
      const doc = await db.collection(collection).findOne({ _id: key });
      return doc ? doc.data : null;
    }
    if (DB_TYPE === 'postgres') {
      const pg  = await getPgClient();
      const res = await pg.query('SELECT v FROM moonx_kv WHERE k=$1', [`${collection}:${key}`]);
      return res.rows[0] ? JSON.parse(res.rows[0].v) : null;
    }
    if (DB_TYPE === 'mysql') {
      const sql    = await getMysqlClient();
      const [rows] = await sql.execute('SELECT v FROM moonx_kv WHERE k=?', [`${collection}:${key}`]);
      return rows[0] ? JSON.parse(rows[0].v) : null;
    }
    const db = readLocal(localFiles[collection] || localFiles.groups);
    return db[key] ?? null;
  } catch (_) { return null; }
}

async function dbSet(collection, key, value) {
  try {
    if (DB_TYPE === 'mongodb') {
      const db = await getMongoDb();
      await db.collection(collection).updateOne({ _id: key }, { $set: { data: value } }, { upsert: true });
      return true;
    }
    if (DB_TYPE === 'postgres') {
      const pg = await getPgClient();
      await pg.query(
        'INSERT INTO moonx_kv(k,v) VALUES($1,$2) ON CONFLICT(k) DO UPDATE SET v=$2',
        [`${collection}:${key}`, JSON.stringify(value)]
      );
      return true;
    }
    if (DB_TYPE === 'mysql') {
      const sql = await getMysqlClient();
      await sql.execute(
        'INSERT INTO moonx_kv(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=?',
        [`${collection}:${key}`, JSON.stringify(value), JSON.stringify(value)]
      );
      return true;
    }
    const file = localFiles[collection] || localFiles.groups;
    const db   = readLocal(file);
    db[key]    = value;
    return writeLocal(file, db);
  } catch (_) { return false; }
}

async function dbDelete(collection, key) {
  try {
    if (DB_TYPE === 'mongodb') { const db = await getMongoDb(); await db.collection(collection).deleteOne({ _id: key }); return true; }
    if (DB_TYPE === 'postgres') { const pg = await getPgClient(); await pg.query('DELETE FROM moonx_kv WHERE k=$1', [`${collection}:${key}`]); return true; }
    if (DB_TYPE === 'mysql')    { const sql = await getMysqlClient(); await sql.execute('DELETE FROM moonx_kv WHERE k=?', [`${collection}:${key}`]); return true; }
    const file = localFiles[collection] || localFiles.groups;
    const db   = readLocal(file);
    delete db[key];
    return writeLocal(file, db);
  } catch (_) { return false; }
}

// ─── GROUP SETTINGS ─────────────────────────────────────────────────────────
async function getGroupSettings(groupId) {
  const data = await dbGet('groups', groupId);
  return data ? { ...DEFAULT_GROUP, ...data } : { ...DEFAULT_GROUP };
}
async function updateGroupSettings(groupId, update) {
  const current = await getGroupSettings(groupId);
  return dbSet('groups', groupId, { ...current, ...update });
}

// ─── USER DATA ───────────────────────────────────────────────────────────────
async function getUser(userId) {
  const data = await dbGet('users', userId);
  return data || { registered: Date.now(), premium: false, banned: false };
}
async function updateUser(userId, update) {
  const current = await getUser(userId);
  return dbSet('users', userId, { ...current, ...update });
}

// ─── WARNINGS ────────────────────────────────────────────────────────────────
async function getWarnings(groupId, userId) {
  const data = await dbGet('warnings', `${groupId}_${userId}`);
  return data || { count: 0, warnings: [] };
}
async function addWarning(groupId, userId, reason) {
  const key     = `${groupId}_${userId}`;
  const current = await getWarnings(groupId, userId);
  current.count++;
  current.warnings.push({ reason, date: Date.now() });
  await dbSet('warnings', key, current);
  return current;
}
async function clearWarnings(groupId, userId) {
  return dbDelete('warnings', `${groupId}_${userId}`);
}

// ─── MODERATORS (SUDO) ───────────────────────────────────────────────────────
async function getModerators()         { const data = await dbGet('mods', 'list'); return Array.isArray(data) ? data : []; }
async function addModerator(userId)    { const mods = await getModerators(); if (!mods.includes(userId)) { mods.push(userId); await dbSet('mods', 'list', mods); } }
async function removeModerator(userId) { const mods = await getModerators(); await dbSet('mods', 'list', mods.filter(m => m !== userId)); }
async function isModerator(userId)     { return (await getModerators()).includes(userId); }

// ─── BANNED USERS ────────────────────────────────────────────────────────────
async function getBanned()          { const data = await dbGet('banned', 'list'); return Array.isArray(data) ? data : []; }
async function banUser(userId)      { const b = await getBanned(); if (!b.includes(userId)) { b.push(userId); await dbSet('banned', 'list', b); } }
async function unbanUser(userId)    { await dbSet('banned', 'list', (await getBanned()).filter(u => u !== userId)); }
async function isUserBanned(userId) { return (await getBanned()).includes(userId); }

// ─── CUSTOM COMMANDS ─────────────────────────────────────────────────────────
async function getCustomCommands()              { return (await dbGet('customCmds', 'all')) || {}; }
async function addCustomCommand(name, response) { const c = await getCustomCommands(); c[name.toLowerCase()] = { response, addedAt: Date.now() }; return dbSet('customCmds', 'all', c); }
async function removeCustomCommand(name)        { const c = await getCustomCommands(); delete c[name.toLowerCase()]; return dbSet('customCmds', 'all', c); }
async function getCustomCommand(name)           { return ((await getCustomCommands())[name.toLowerCase()]) || null; }

module.exports = {
  DB_TYPE,
  getGroupSettings, updateGroupSettings,
  getUser, updateUser,
  getWarnings, addWarning, clearWarnings,
  getModerators, addModerator, removeModerator, isModerator,
  getBanned, banUser, unbanUser, isUserBanned,
  getCustomCommands, addCustomCommand, removeCustomCommand, getCustomCommand,
};
