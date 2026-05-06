const fs = require('fs');

function isBanned(userId) {
    try {
        const _raw = fs.readFileSync('./data/banned.json', 'utf8').trim();
        const bannedUsers = _raw ? JSON.parse(_raw) : [];
        return bannedUsers.includes(userId);
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

module.exports = { isBanned }; 