const { Listener } = require('@sapphire/framework');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Canvas = require('canvas');
const welcomeStore = require('../lib/welcomeStore');

module.exports = class GuildMemberAddListener extends Listener {
  constructor(context, options) {
    super(context, { ...options, event: 'guildMemberAdd' });
  }

  // Small helper: placeholders
  getPlaceholders(member) {
    return {
      '{user}': `<@${member.id}>`,
      '{user.tag}': member.user.tag,
      '{user.username}': member.user.username,
      '{user.avatar}': member.user.displayAvatarURL({ extension: 'png', size: 512 }),
      '{server}': member.guild.name,
      '{membercount}': String(member.guild.memberCount)
    };
  }

  replacePlaceholdersInString(str, member) {
    if (!str || typeof str !== 'string') return str;
    let out = str;
    const map = this.getPlaceholders(member);
    for (const key of Object.keys(map)) out = out.split(key).join(map[key]);
    return out;
  }

  replacePlaceholders(obj, member) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return this.replacePlaceholdersInString(obj, member);
    if (Array.isArray(obj)) return obj.map(item => this.replacePlaceholders(item, member));
    if (typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = this.replacePlaceholders(v, member);
      }
      return out;
    }
    return obj;
  }

  // Canvas generator estilo Mimu: avatar + nombre + server
  async generateWelcomeImage(member) {
    const width = 1024;
    const height = 350;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fondo degradado suave
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#2b2d42');
    gradient.addColorStop(1, '#252525');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Texto "Bienvenido/a" estilo Mimu
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Sans';
    ctx.fillText('¡Bienvenido/a!', 320, 80);

    // Server name
    ctx.fillStyle = '#bfc0c2';
    ctx.font = '28px Sans';
    ctx.fillText(member.guild.name, 320, 120);

    // avatar circular
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatar = await Canvas.loadImage(avatarURL);
    const avatarX = 40, avatarY = 40, avatarSize = 256;
    // máscara circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Nombre del usuario grande
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Sans';
    const displayName = member.user.username;
    ctx.fillText(displayName, 320, 200);

    // Subtexto con tag
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '20px Sans';
    ctx.fillText(member.user.tag, 320, 240);

    // Sutil sombra/linea decorativa
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(320, 260, 600, 4);

    return {
      buffer: canvas.toBuffer(),
      name: `welcome-${member.id}.png`
    };
  }

  buildDefaultEmbed(member, description) {
    return new EmbedBuilder()
      .setTitle('¡Bienvenido/a!')
      .setDescription(description)
      .setColor(0x57F287)
      .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 512 }))
      .addFields({ name: 'Miembros', value: String(member.guild.memberCount), inline: true })
      .setTimestamp();
  }

  async run(member) {
    try {
      const config = welcomeStore.getConfig(member.guild.id);
      if (!config || !config.channel_id) return;

      const channel = await member.guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const customMessage = config.message;
      const description = customMessage ? this.replacePlaceholdersInString(customMessage, member) : `¡Bienvenido/a, <@${member.id}>! Somos ${member.guild.name}.`;

      let embed = null;
      let useGeneratedImage = true; // default true for Mimu style
      if (config.embed_template) {
        try {
          const parsed = JSON.parse(config.embed_template);
          // allow a flag to control whether to attach generated image or not
          if (parsed.useGeneratedImage === false || parsed.use_generated_image === false) useGeneratedImage = false;
          // remove custom flags before feeding to EmbedBuilder
          delete parsed.useGeneratedImage;
          delete parsed.use_generated_image;

          // replace placeholders recursively
          const replaced = this.replacePlaceholders(parsed, member);

          // convert color if it's a hex string like "#FFAABB"
          if (replaced.color && typeof replaced.color === 'string' && replaced.color.startsWith('#')) {
            replaced.color = parseInt(replaced.color.replace('#', ''), 16);
          }

          embed = new EmbedBuilder(replaced);
        } catch (err) {
          this.container.logger.warn('Embed template inválido para guild', member.guild.id, err);
          embed = this.buildDefaultEmbed(member, description);
        }
      } else {
        embed = this.buildDefaultEmbed(member, description);
      }

      // If embed has empty description, set our description
      if (!embed.data.description) embed.setDescription(description);

      // Generate image if requested
      let attachment = null;
      if (useGeneratedImage) {
        try {
          const generated = await this.generateWelcomeImage(member);
          attachment = { attachment: generated.buffer, name: generated.name };
          embed.setImage(`attachment://${generated.name}`);
        } catch (err) {
          this.container.logger.warn('No se pudo crear la imagen de bienvenida:', err);
        }
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Leer reglas').setStyle(ButtonStyle.Link).setURL('https://tuservidor/regras').setEmoji('📜'),
        new ButtonBuilder().setLabel('Seleccionar roles').setStyle(ButtonStyle.Primary).setCustomId('welcome_select_roles')
      );

      await channel.send({ embeds: [embed], components: [row], files: attachment ? [attachment] : [] });
    } catch (err) {
      this.container.logger.error('Error en welcome listener:', err);
    }
  }
};
