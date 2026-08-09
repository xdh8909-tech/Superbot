const { ChatInputCommand } = require('@sapphire/framework');
const welcomeStore = require('../../lib/welcomeStore');

module.exports = class WelcomeCommand extends ChatInputCommand {
  constructor(context, options) {
    super(context, {
      ...options,
      description: 'Configura el sistema de bienvenida'
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
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
        .addSubcommand(sc => sc.setName('test').setDescription('Enviar un mensaje de prueba al canal configurado'))
    );
  }

  async chatInputRun(interaction) {
    if (!interaction.memberPermissions.has('ManageGuild')) {
      return interaction.reply({ content: 'Necesitas el permiso Administrar Servidor.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'set-channel') {
      const channel = interaction.options.getChannel('channel');
      welcomeStore.setChannel(guildId, channel.id);
      return interaction.reply({ content: `Canal de bienvenida configurado a ${channel}`, ephemeral: true });
    } else if (sub === 'set-message') {
      const message = interaction.options.getString('message');
      welcomeStore.setMessage(guildId, message);
      return interaction.reply({ content: 'Mensaje de bienvenida guardado. Placeholders: {user}, {user.tag}, {user.username}, {user.avatar}, {server}, {membercount}', ephemeral: true });
    } else if (sub === 'set-embed') {
      const template = interaction.options.getString('template');
      // limit size to avoid too large inputs
      if (template.length > 6000) return interaction.reply({ content: 'Template demasiado largo (máx 6000 caracteres).', ephemeral: true });

      try {
        const parsed = JSON.parse(template);
        // basic validation: try creating an EmbedBuilder-like object
        // Do not import EmbedBuilder here to avoid heavy ops; just check JSON structure
        // Save template
        welcomeStore.setEmbedTemplate(guildId, template);
        return interaction.reply({ content: 'Embed personalizado guardado correctamente.', ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `JSON inválido: ${err.message}`, ephemeral: true });
      }
    } else if (sub === 'get-embed') {
      const config = welcomeStore.getConfig(guildId);
      const tpl = config && config.embed_template ? config.embed_template : null;
      if (!tpl) return interaction.reply({ content: 'No hay embed personalizado configurado.', ephemeral: true });
      // reply with code block (ephemeral)
      const chunk = tpl.length > 1900 ? tpl.slice(0, 1900) + '... (truncated)' : tpl;
      return interaction.reply({ content: `
\`\`\`json\n${chunk}\n\`\`\``, ephemeral: true });
    } else if (sub === 'reset-embed') {
      welcomeStore.resetEmbedTemplate(guildId);
      return interaction.reply({ content: 'Embed personalizado restablecido al predeterminado.', ephemeral: true });
    } else if (sub === 'test') {
      const config = welcomeStore.getConfig(guildId);
      if (!config || !config.channel_id) return interaction.reply({ content: 'No hay canal configurado.', ephemeral: true });
      const channel = await interaction.guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel) return interaction.reply({ content: 'Canal no válido.', ephemeral: true });
      try {
        const fakeMember = interaction.member;
        const listenerPath = '../../listeners/guildMemberAdd';
        const ListenerClass = require(listenerPath);
        const listenerInstance = new ListenerClass(this.context, {});
        await listenerInstance.run(fakeMember);
        return interaction.reply({ content: 'Prueba enviada al canal configurado.', ephemeral: true });
      } catch (e) {
        this.container.logger.error('Error enviando prueba de bienvenida:', e);
        return interaction.reply({ content: 'Error ejecutando prueba.', ephemeral: true });
      }
    }
  }
};
