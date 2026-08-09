import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';
import { formatWelcomeMessage, getWelcomeConfig } from '../utils/welcome.js';

function getPlaceholders(member) {
  return {
    '{user}': `<@${member.id}>`,
    '{user.mention}': `<@${member.id}>`,
    '{user.tag}': member.user.tag,
    '{user.username}': member.user.username,
    '{user.avatar}': member.user.displayAvatarURL({ extension: 'png', size: 512 }),
    '{server}': member.guild.name,
    '{server.name}': member.guild.name,
    '{guild.name}': member.guild.name,
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
  // Lazy-load canvas only when needed to avoid requiring native deps in production.
  let Canvas;
  try {
    Canvas = (await import('canvas')).default || (await import('canvas'));
  } catch (err) {
    throw new Error('Canvas not available: ' + err.message);
  }

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

function buildActionRowsFromConfig(componentsConfig) {
  if (!Array.isArray(componentsConfig)) return [];
  const rows = [];
  for (const rowConfig of componentsConfig) {
    try {
      const row = new ActionRowBuilder();
      if (!Array.isArray(rowConfig.components)) continue;
      for (const comp of rowConfig.components) {
        if (!comp || typeof comp !== 'object') continue;
        if (comp.type === 'button') {
          const style = (comp.style || 'Link').toLowerCase();
          let btnStyle = ButtonStyle.Link;
          switch (style) {
            case 'primary': btnStyle = ButtonStyle.Primary; break;
            case 'secondary': btnStyle = ButtonStyle.Secondary; break;
            case 'success': btnStyle = ButtonStyle.Success; break;
            case 'danger': btnStyle = ButtonStyle.Danger; break;
            default: btnStyle = ButtonStyle.Link; break;
          }

          const builder = new ButtonBuilder()
            .setLabel(comp.label || 'Button')
            .setStyle(btnStyle);

          if (btnStyle === ButtonStyle.Link) {
            if (comp.url) builder.setURL(comp.url);
            else continue; // link buttons require URL
          } else {
            if (comp.customId) builder.setCustomId(comp.customId);
            else builder.setCustomId(`gs_btn_${Math.random().toString(36).slice(2, 9)}`);
          }

          if (comp.emoji) builder.setEmoji(comp.emoji);
          row.addComponents(builder);
        }
      }
      rows.push(row);
    } catch (err) {
      // ignore invalid component
      continue;
    }
  }
  return rows;
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
      // Default to NOT generating images to avoid native canvas deps on Railway.
      let useGeneratedImage = false;

      if (config.embed_template) {
        try {
          const parsed = typeof config.embed_template === 'string' ? JSON.parse(config.embed_template) : config.embed_template;
          if (parsed.useGeneratedImage === true || parsed.use_generated_image === true) useGeneratedImage = true;
          // remove the flag so it doesn't confuse EmbedBuilder
          delete parsed.useGeneratedImage;
          delete parsed.use_generated_image;

          const replaced = replacePlaceholders(parsed, member);

          // If color is a hex string convert to int
          if (replaced.color && typeof replaced.color === 'string' && replaced.color.startsWith('#')) {
            replaced.color = parseInt(replaced.color.replace('#', ''), 16);
          }

          // Create embed from object. EmbedBuilder accepts raw data in constructor
          embed = new EmbedBuilder(replaced);

          // Apply author and timestamp explicitly if present (safer across versions)
          if (replaced.author && replaced.author.name) {
            embed.setAuthor({
              name: replaced.author.name,
              iconURL: replaced.author.icon_url || replaced.author.iconURL || undefined,
              url: replaced.author.url || undefined
            });
          }

          if (replaced.timestamp === true || replaced.timestamp === 'now') {
            embed.setTimestamp();
          } else if (replaced.timestamp && typeof replaced.timestamp === 'string') {
            const t = Date.parse(replaced.timestamp);
            if (!Number.isNaN(t)) embed.setTimestamp(new Date(t));
          }

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
          logger.warn('No se pudo crear la imagen de bienvenida (canvas no disponible o error):', err.message || err);
        }
      }

      // Build components: prefer components defined in embed_template, fallback to default row
      let componentRows = [];
      const rawTemplate = config.embed_template && typeof config.embed_template === 'object' ? config.embed_template : (config.embed_template ? JSON.parse(config.embed_template) : null);
      if (rawTemplate && rawTemplate.components) {
        componentRows = buildActionRowsFromConfig(rawTemplate.components);
      }

      if (!componentRows || componentRows.length === 0) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Leer reglas').setStyle(ButtonStyle.Link).setURL('https://tuservidor/regras').setEmoji('📜'),
          new ButtonBuilder().setLabel('Seleccionar roles').setStyle(ButtonStyle.Primary).setCustomId('welcome_select_roles')
        );
        componentRows = [row];
      }

      await channel.send({ embeds: [embed], components: componentRows, files });
    } catch (err) {
      logger.error('Error en welcome handler:', err);
    }
  }
};
