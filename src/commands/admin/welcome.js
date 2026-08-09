import { SlashCommandBuilder } from 'discord.js';
import { formatWelcomeMessage } from '../../src/utils/welcome.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configura el sistema de bienvenida')
    .addSubcommand(sc => sc.setName('set-channel').setDescription('Configura el canal de bienvenida')
      .addChannelOption(opt => opt.setName('channel').setDescription('Canal de bienvenida').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-message').setDescription('Mensaje de bienvenida (placeholders)')
      .addStringOption(opt => opt.setName('message').setDescription('Mensaje con placeholders').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-embed').setDescription('Establece un embed JSON personalizado')
      .addStringOption(opt => opt.setName('template').setDescription('Embed JSON (usa placeholders)').setRequired(true)))
    .addSubcommand(sc => sc.setName('get-embed').setDescription('Muestra el embed personalizado actual'))
    .addSubcommand(sc => sc.setName('reset-embed').setDescription('Restablece el embed personalizado'))
    .addSubcommand(sc => sc.setName('test').setDescription('Enviar un mensaje de prueba al canal configurado')),

  async execute(interaction) {
    // permission check
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      return interaction.reply({ content: 'Necesitas el permiso Administrar Servidor.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const client = interaction.client;

    // helper to fetch and persist config via central DB wrapper
    const key = `guild:${guildId}:welcome`;
    const current = await client.db.get(key) || {};

    if (sub === 'set-channel') {
      const channel = interaction.options.getChannel('channel');
      const newConfig = { ...current, channel_id: channel.id };
      await client.db.set(key, newConfig);
      return interaction.reply({ content: `Canal de bienvenida configurado a ${channel}`, ephemeral: true });
    }

    if (sub === 'set-message') {
      const message = interaction.options.getString('message');
      const newConfig = { ...current, message };
      await client.db.set(key, newConfig);
      return interaction.reply({ content: 'Mensaje de bienvenida guardado. Placeholders: {user}, {user.tag}, {user.username}, {user.avatar}, {server}, {membercount}', ephemeral: true });
    }

    if (sub === 'set-embed') {
      const template = interaction.options.getString('template');
      if (template.length > 6000) return interaction.reply({ content: 'Template demasiado largo (máx 6000 caracteres).', ephemeral: true });
      try {
        const parsed = JSON.parse(template);
        const newConfig = { ...current, embed_template: parsed };
        await client.db.set(key, newConfig);
        return interaction.reply({ content: 'Embed personalizado guardado correctamente.', ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `JSON inválido: ${err.message}`, ephemeral: true });
      }
    }

    if (sub === 'get-embed') {
      const cfg = await client.db.get(key);
      const tpl = cfg?.embed_template ?? null;
      if (!tpl) return interaction.reply({ content: 'No hay embed personalizado configurado.', ephemeral: true });
      const json = typeof tpl === 'string' ? tpl : JSON.stringify(tpl, null, 2);
      const chunk = json.length > 1900 ? json.slice(0, 1900) + '... (truncated)' : json;
      return interaction.reply({ content: `\`\`\`json\n${chunk}\n\`\`\``, ephemeral: true });
    }

    if (sub === 'reset-embed') {
      const cfg = await client.db.get(key) || {};
      delete cfg.embed_template;
      await client.db.set(key, cfg);
      return interaction.reply({ content: 'Embed personalizado restablecido al predeterminado.', ephemeral: true });
    }

    if (sub === 'test') {
      const cfg = await client.db.get(key) || {};
      if (!cfg.channel_id) return interaction.reply({ content: 'No hay canal configurado.', ephemeral: true });
      const channel = await interaction.guild.channels.fetch(cfg.channel_id).catch(() => null);
      if (!channel) return interaction.reply({ content: 'Canal no válido.', ephemeral: true });

      try {
        // call the event handler directly
        const module = await import('../../events/guildMemberAdd.js');
        const handler = module.default;
        await handler.execute(interaction.member, client);
        return interaction.reply({ content: 'Prueba enviada al canal configurado.', ephemeral: true });
      } catch (e) {
        console.error('Error enviando prueba de bienvenida:', e);
        return interaction.reply({ content: 'Error ejecutando prueba.', ephemeral: true });
      }
    }
  }
};
