import { SlashCommandBuilder } from 'discord.js';
import { formatWelcomeMessage } from '../../src/utils/welcome.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configura el sistema de bienvenida')

    // existing subcommands
    .addSubcommand(sc => sc.setName('set-channel').setDescription('Configura el canal de bienvenida')
      .addChannelOption(opt => opt.setName('channel').setDescription('Canal de bienvenida').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-message').setDescription('Mensaje de bienvenida (placeholders)')
      .addStringOption(opt => opt.setName('message').setDescription('Mensaje con placeholders').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-embed').setDescription('Establece un embed JSON personalizado')
      .addStringOption(opt => opt.setName('template').setDescription('Embed JSON (usa placeholders)').setRequired(true)))
    .addSubcommand(sc => sc.setName('get-embed').setDescription('Muestra el embed personalizado actual'))
    .addSubcommand(sc => sc.setName('reset-embed').setDescription('Restablece el embed personalizado'))
    .addSubcommand(sc => sc.setName('test').setDescription('Enviar un mensaje de prueba al canal configurado'))

    // granular embed customization (merged from greatsetup)
    .addSubcommand(sc => sc.setName('set-title').setDescription('Establece el título del embed').addStringOption(o => o.setName('title').setDescription('Título (usa placeholders)').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-description').setDescription('Establece la descripción del embed').addStringOption(o => o.setName('description').setDescription('Descripción (usa placeholders)').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-color').setDescription('Establece el color del embed (hex)').addStringOption(o => o.setName('color').setDescription('#57F287 o 0x57F287').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-thumbnail').setDescription('Establece la thumbnail (URL)').addStringOption(o => o.setName('url').setDescription('URL de la thumbnail').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-image').setDescription('Establece la imagen grande del embed (URL)').addStringOption(o => o.setName('url').setDescription('URL de la imagen').setRequired(true)))
    .addSubcommand(sc => sc.setName('set-footer').setDescription('Establece el footer').addStringOption(o => o.setName('text').setDescription('Texto del footer').setRequired(true)).addStringOption(o => o.setName('icon').setDescription('Icon URL').setRequired(false)))

    .addSubcommand(sc => sc.setName('add-field').setDescription('Añade un campo al embed').addStringOption(o => o.setName('name').setDescription('Nombre del campo').setRequired(true)).addStringOption(o => o.setName('value').setDescription('Valor del campo').setRequired(true)).addBooleanOption(o => o.setName('inline').setDescription('Mostrar inline').setRequired(false)))
    .addSubcommand(sc => sc.setName('remove-field').setDescription('Elimina un campo por índice (0-based)').addIntegerOption(o => o.setName('index').setDescription('Índice del campo').setRequired(true)))
    .addSubcommand(sc => sc.setName('clear-fields').setDescription('Elimina todos los campos'))

    .addSubcommand(sc => sc.setName('add-button').setDescription('Añade un botón (row será único)').addStringOption(o => o.setName('label').setDescription('Texto del botón').setRequired(true)).addStringOption(o => o.setName('style').setDescription('primary/secondary/success/danger/link').setRequired(true)).addStringOption(o => o.setName('url').setDescription('URL para link (requerido si style=link)').setRequired(false)).addStringOption(o => o.setName('customid').setDescription('customId para botones no-link').setRequired(false)))
    .addSubcommand(sc => sc.setName('clear-buttons').setDescription('Elimina todos los botones'))
    .addSubcommand(sc => sc.setName('toggle-image').setDescription('Activar/desactivar imagen generada (canvas)').addBooleanOption(o => o.setName('enabled').setDescription('true = generar imagen').setRequired(true)))

    .addSubcommand(sc => sc.setName('show').setDescription('Muestra el JSON actual del embed (preview)'))
    .addSubcommand(sc => sc.setName('save').setDescription('Guardar cambios y usarlos para futuras bienvenidas')),

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

    // ensure embed_template is an object
    const tpl = current.embed_template && typeof current.embed_template === 'object' ? { ...current.embed_template } : (current.embed_template ? JSON.parse(current.embed_template) : {});

    async function persist(newTpl) {
      const save = { ...current, embed_template: newTpl };
      await client.db.set(key, save);
    }

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
      const tplNow = cfg?.embed_template ?? null;
      if (!tplNow) return interaction.reply({ content: 'No hay embed personalizado configurado.', ephemeral: true });
      const json = typeof tplNow === 'string' ? tplNow : JSON.stringify(tplNow, null, 2);
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
        const module = await import('../../../events/guildMemberAdd.js');
        const handler = module.default;
        await handler.execute(interaction.member, client);
        return interaction.reply({ content: 'Prueba enviada al canal configurado.', ephemeral: true });
      } catch (e) {
        console.error('Error enviando prueba de bienvenida:', e);
        return interaction.reply({ content: 'Error ejecutando prueba.', ephemeral: true });
      }
    }

    // Merged granular embed subcommands
    if (sub === 'set-title') {
      const title = interaction.options.getString('title');
      tpl.title = title;
      await persist(tpl);
      return interaction.reply({ content: 'Título del embed actualizado.', ephemeral: true });
    }

    if (sub === 'set-description') {
      const description = interaction.options.getString('description');
      tpl.description = description;
      await persist(tpl);
      return interaction.reply({ content: 'Descripción del embed actualizada.', ephemeral: true });
    }

    if (sub === 'set-color') {
      const color = interaction.options.getString('color');
      tpl.color = color;
      await persist(tpl);
      return interaction.reply({ content: 'Color del embed actualizado.', ephemeral: true });
    }

    if (sub === 'set-thumbnail') {
      const url = interaction.options.getString('url');
      tpl.thumbnail = { url };
      await persist(tpl);
      return interaction.reply({ content: 'Thumbnail actualizada.', ephemeral: true });
    }

    if (sub === 'set-image') {
      const url = interaction.options.getString('url');
      tpl.image = { url };
      await persist(tpl);
      return interaction.reply({ content: 'Imagen del embed actualizada.', ephemeral: true });
    }

    if (sub === 'set-footer') {
      const text = interaction.options.getString('text');
      const icon = interaction.options.getString('icon');
      tpl.footer = { text };
      if (icon) tpl.footer.icon_url = icon;
      await persist(tpl);
      return interaction.reply({ content: 'Footer actualizado.', ephemeral: true });
    }

    if (sub === 'add-field') {
      const name = interaction.options.getString('name');
      const value = interaction.options.getString('value');
      const inline = interaction.options.getBoolean('inline') || false;
      tpl.fields = Array.isArray(tpl.fields) ? tpl.fields : [];
      tpl.fields.push({ name, value, inline });
      await persist(tpl);
      return interaction.reply({ content: `Campo añadido (index ${tpl.fields.length - 1}).`, ephemeral: true });
    }

    if (sub === 'remove-field') {
      const index = interaction.options.getInteger('index');
      tpl.fields = Array.isArray(tpl.fields) ? tpl.fields : [];
      if (index < 0 || index >= tpl.fields.length) return interaction.reply({ content: 'Índice inválido.', ephemeral: true });
      tpl.fields.splice(index, 1);
      await persist(tpl);
      return interaction.reply({ content: 'Campo eliminado.', ephemeral: true });
    }

    if (sub === 'clear-fields') {
      tpl.fields = [];
      await persist(tpl);
      return interaction.reply({ content: 'Todos los campos han sido eliminados.', ephemeral: true });
    }

    if (sub === 'add-button') {
      const label = interaction.options.getString('label');
      const style = (interaction.options.getString('style') || 'link').toLowerCase();
      const url = interaction.options.getString('url');
      const customId = interaction.options.getString('customid');

      tpl.components = Array.isArray(tpl.components) ? tpl.components : [];
      // we'll store as single row (index 0)
      if (!tpl.components[0]) tpl.components[0] = { components: [] };

      const btn = { type: 'button', label, style };
      if (style === 'link') {
        if (!url) return interaction.reply({ content: 'URL requerida para botones tipo link.', ephemeral: true });
        btn.url = url;
      } else {
        btn.customId = customId || `gs_btn_${Math.random().toString(36).slice(2, 9)}`;
      }

      tpl.components[0].components.push(btn);
      await persist(tpl);
      return interaction.reply({ content: 'Botón añadido.', ephemeral: true });
    }

    if (sub === 'clear-buttons') {
      tpl.components = [];
      await persist(tpl);
      return interaction.reply({ content: 'Todos los botones eliminados.', ephemeral: true });
    }

    if (sub === 'toggle-image') {
      const enabled = interaction.options.getBoolean('enabled');
      tpl.useGeneratedImage = !!enabled;
      await persist(tpl);
      return interaction.reply({ content: `Generación de imagen ${enabled ? 'activada' : 'desactivada'}.`, ephemeral: true });
    }

    if (sub === 'show') {
      const pretty = JSON.stringify(tpl, null, 2);
      const chunk = pretty.length > 1900 ? pretty.slice(0, 1900) + '\n... (truncated)' : pretty;
      return interaction.reply({ content: `\`\`\`json\n${chunk}\n\`\`\``, ephemeral: true });
    }

    if (sub === 'save') {
      await persist(tpl);
      return interaction.reply({ content: 'Cambios guardados y aplicados para futuras bienvenidas.', ephemeral: true });
    }

    return interaction.reply({ content: 'Subcomando desconocido.', ephemeral: true });
  }
};
