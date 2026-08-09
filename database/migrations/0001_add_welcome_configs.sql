-- 0001_add_welcome_configs.sql
-- Create welcome_configs table used by TitanBot's structured DB layer.

CREATE TABLE IF NOT EXISTS welcome_configs (
  guild_id VARCHAR(20) PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
