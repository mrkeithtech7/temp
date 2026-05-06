
'use strict';

const fs   = require('fs');
const path = require('path');
const chalk = require('chalk');

const MX = chalk.hex('#9B59B6').bold('[ MOON-X ]');

let _commands = null;

function loadCommands(force = false) {
  if (_commands && !force) return _commands;
  _commands = new Map();

  const dir = path.join(__dirname, '..', 'plugins');
  if (!fs.existsSync(dir)) {
    console.warn(`${MX} ⚠️  plugins/ folder not found`);
    return _commands;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  let fileCount = 0, entryCount = 0;

  console.log(`${MX} Loading commands...`);

  for (const file of files) {
    const fp = path.join(dir, file);
    try {
      delete require.cache[require.resolve(fp)];
      const mod = require(fp);
      if (!mod) continue;

      // Multi-command files expose a .commands array
      const list = Array.isArray(mod.commands) ? mod.commands : (mod.name ? [mod] : []);

      for (const cmd of list) {
        if (!cmd?.name || typeof cmd.execute !== 'function') continue;
        const key = cmd.name.toLowerCase();
        _commands.set(key, cmd);
        if (Array.isArray(cmd.aliases)) {
          cmd.aliases.forEach(a => _commands.set(a.toLowerCase(), cmd));
        }
        entryCount++;
      }
      fileCount++;
    } catch (err) {
      console.error(`${MX} ❌ Failed to load ${file}: ${err.message}`);
    }
  }

  console.log(`${MX} ✅ ${entryCount} commands loaded from ${fileCount} files`);
  return _commands;
}

function getCommand(name)    { if (!_commands) loadCommands(); return _commands.get(name.toLowerCase()) || null; }
function getAllCommands()     { if (!_commands) loadCommands(); return _commands; }
function reloadCommands()    { _commands = null; return loadCommands(true); }
function getUniqueCommands() {
  if (!_commands) loadCommands();
  const seen = new Set(), unique = [];
  for (const cmd of _commands.values()) {
    if (!seen.has(cmd.name)) { seen.add(cmd.name); unique.push(cmd); }
  }
  return unique;
}

module.exports = { loadCommands, getCommand, getAllCommands, reloadCommands, getUniqueCommands };
