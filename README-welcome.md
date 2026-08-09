Mimu-style Welcome system for Sapphire + discord.js v14

Features added in this update:
- Full embed customization: admins can set an embed JSON template via /welcome set-embed
  - Template can include placeholders: {user}, {user.tag}, {user.username}, {user.avatar}, {server}, {membercount}
  - Template may include a flag `useGeneratedImage: false` to disable the automatic canvas image.
- Safe DB migration to add embed_template column without breaking existing data.
- Robust parsing and fallback to a default embed if the template is invalid.
- Commands: set-channel, set-message, set-embed, get-embed, reset-embed, test

Installation notes:
- Install dependencies: npm install better-sqlite3 canvas
- Restart the bot after merging the branch. Sapphire will load the new command and listener.

Security & stability considerations implemented:
- Template JSON is validated before saving; invalid JSON is rejected and does not crash the bot.
- Database schema migration is done with a guarded ALTER TABLE and logs warnings on failure instead of throwing.
- All major operations are wrapped in try/catch so the listener won't crash the process.

Example embed template (JSON):
{
  "title": "¡Bienvenido, {user.username}!",
  "description": "{user} se ha unido a {server}. Somos {membercount} miembros.",
  "color": "#57F287",
  "thumbnail": { "url": "{user.avatar}" },
  "footer": { "text": "Disfruta tu estadía" },
  "useGeneratedImage": true
}

If you want me to open a PR from feature/mimu-welcome to your default branch, dime y lo hago.
