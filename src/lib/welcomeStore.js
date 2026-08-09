const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'welcome.sqlite');
const db = new Database(dbPath);

// Ensure base table exists
db.prepare(`
CREATE TABLE IF NOT EXISTS welcome_config (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  message TEXT
)
`).run();

// Migration: add embed_template column if missing
const cols = db.prepare("PRAGMA table_info('welcome_config')").all();
if (!cols.some(c => c.name === 'embed_template')) {
  try {
    db.prepare('ALTER TABLE welcome_config ADD COLUMN embed_template TEXT').run();
  } catch (e) {
    // If alter fails, log but continue (do not break bot)
    console.warn('Could not add embed_template column:', e);
  }
}

module.exports = {
  getConfig(guildId) {
    return db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId) || null;
  },
  setChannel(guildId, channelId) {
    const exists = this.getConfig(guildId);
    if (exists) {
      db.prepare('UPDATE welcome_config SET channel_id = ? WHERE guild_id = ?').run(channelId, guildId);
    } else {
      db.prepare('INSERT INTO welcome_config (guild_id, channel_id, message, embed_template) VALUES (?, ?, ?, ?)').run(guildId, channelId, null, null);
    }
  },
  setMessage(guildId, message) {
    const exists = this.getConfig(guildId);
    if (exists) {
      db.prepare('UPDATE welcome_config SET message = ? WHERE guild_id = ?').run(message, guildId);
    } else {
      db.prepare('INSERT INTO welcome_config (guild_id, channel_id, message, embed_template) VALUES (?, ?, ?, ?)').run(guildId, null, message, null);
    }
  },
  setEmbedTemplate(guildId, template) {
    const exists = this.getConfig(guildId);
    if (exists) {
      db.prepare('UPDATE welcome_config SET embed_template = ? WHERE guild_id = ?').run(template, guildId);
    } else {
      db.prepare('INSERT INTO welcome_config (guild_id, channel_id, message, embed_template) VALUES (?, ?, ?, ?)').run(guildId, null, null, template);
    }
  },
  resetEmbedTemplate(guildId) {
    const exists = this.getConfig(guildId);
    if (exists) {
      db.prepare('UPDATE welcome_config SET embed_template = NULL WHERE guild_id = ?').run(guildId);
    }
  },
  ensureDefault(guildId) {
    const exists = this.getConfig(guildId);
    if (!exists) db.prepare('INSERT INTO welcome_config (guild_id, channel_id, message, embed_template) VALUES (?, ?, ?, ?)').run(guildId, null, null, null);
  }
};
