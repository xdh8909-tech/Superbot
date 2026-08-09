import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Canvas from 'canvas';
import { logger } from '../utils/logger.js';
import { formatWelcomeMessage, getWelcomeConfig } from '../utils/welcome.js';

function getPlaceholders(member) {
  return {
    '{user}': `<@${member.id}>`,
    '{user.tag}': member.user.tag,
    '{user.username}': member.user.username,
    '{user.avatar}': member.user.displayAvatarURL({ extension: 'png', size: 512 }),
    '{server}': member.guild.name,
    '{membercount}': String(member.guild.memberCount)
  };
}

function replacePlaceholdersInString(str, member) {
  if (!str || typeof str !== 'string') return str;
  let out = str;
  const map = getPlaceholders(member);
  for (const key of Object.keys(map)) out = out.split(key).join(map[key]);
  return out;
}

function replacePlaceholders(obj, member) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return replacePlaceholdersInString(obj, member);
  if (Array.isArray(obj)) return obj.map(item => replacePlaceholders(item, member));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = replacePlaceholders(v, member);
    }
    return out;
  }
  return obj;
}

async function generateWelcomeImage(member) {
  const width = 1024;
  const height = 350;
  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#2b2d42');
  gradient.addColorStop(1, '#252525');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Sans';
  ctx.fillText('¡Bienvenido/a!', 320, 80);

  ctx.fillStyle = '#bfc0c2';
  ctx.font = '28px Sans';
  ctx.fillText(member.guild.name, 320, 120);

  const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
  const avatar = await Canvas.loadImage(avatarURL);
  const avatarX = 40, avatarY = 40, avatarSize = 256;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Sans';
  const displayName = member.user.username;
  ctx.fillText(displayName, 320, 200);

  ctx.fillStyle = '#9aa0a6';
  ctx.font = '20px Sans';
  ctx.fillText(member.user.tag, 320, 240);

  ctx.fillStyle = '#ffffff22';
  ctx.fillRect(320, 260, 600, 4);

  return {
    buffer: canvas.toBuffer(),
    name: `welcome-${member.id}.png`
  };
}

function buildDefaultEmbed(member, description) {
  return new EmbedBuilder()
    .setTitle('¡Bienvenido/a!')
    .setDescription(description)
    .setColor(0x57F287)
    .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 512 }))
    .addFields({ name: 'Miembros', value: String(member.guild.memberCount), inline: true })
    .setTimestamp();
}

export default {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      const config = await getWelcomeConfig(client, member.guild.id);
      if (!config || !config.channel_id) return;

      const channel = await member.guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const customMessage = config.message;
      const description = customMessage ? formatWelcomeMessage(customMessage, { user: member.user, guild: member.guild }) : `¡Bienvenido/a, <@${member.id}>! Somos ${member.guild.name}.`;

      let embed = null;
      let useGeneratedImage = true;

      if (config.embed_template) {
        try {
          const parsed = typeof config.embed_template === 'string' ? JSON.parse(config.embed_template) : config.embed_template;
          if (parsed.useGeneratedImage === false || parsed.use_generated_image === false) useGeneratedImage = false;
          delete parsed.useGeneratedImage;
          delete parsed.use_generated_image;

          const replaced = replacePlaceholders(parsed, member);

          if (replaced.color && typeof replaced.color === 'string' && replaced.color.startsWith('#')) {
            replaced.color = parseInt(replaced.color.replace('#', ''), 16);
          }

          embed = new EmbedBuilder(replaced);
        } catch (err) {
          logger.warn('Embed template inválido para guild', member.guild.id, err);
          embed = buildDefaultEmbed(member, description);
        }
      } else {
        embed = buildDefaultEmbed(member, description);
      }

      if (!embed.data.description) embed.setDescription(description);

      let files = [];
      if (useGeneratedImage) {
        try {
          const generated = await generateWelcomeImage(member);
          files.push({ attachment: generated.buffer, name: generated.name });
          embed.setImage(`attachment://${generated.name}`);
        } catch (err) {
          logger.warn('No se pudo crear la imagen de bienvenida:', err);
        }
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Leer reglas').setStyle(ButtonStyle.Link).setURL('https://tuservidor/regras').setEmoji('📜'),
        new ButtonBuilder().setLabel('Seleccionar roles').setStyle(ButtonStyle.Primary).setCustomId('welcome_select_roles')
      );

      await channel.send({ embeds: [embed], components: [row], files });
    } catch (err) {
      logger.error('Error en welcome handler:', err);
    }
  }
};
