import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../config/bot.js'; // 2 niveles hacia atrás: de /commands/Welcome -> /src -> /config

/**
 * Convierte un mensaje de bienvenida con tags en un payload listo para enviar por Discord.
 * Soporta etiquetas como: {user}, {username}, {server}, {memberCount} y {embed:nombre}
 */
export function buildWelcomePayload(client, guild, member, rawText) {
    const payload = {
        content: '',
        embeds: []
    };

    if (!rawText) return payload;

    // Detectar etiqueta {embed:nombre}
    const embedMatch = rawText.match(/\{embed:([a-zA-Z0-9_\-]+)\}/i);

    if (embedMatch) {
        const embedName = embedMatch[1].toLowerCase().trim();
        
        // Extraer el texto fuera de la etiqueta {embed:...}
        const cleanedText = rawText.replace(embedMatch[0], '').trim();
        payload.content = replaceVariables(cleanedText, member, guild);

        // Buscar el embed guardado
        const embedKey = `${guild.id}:${embedName}`;
        const savedEmbed = client.customEmbeds?.get(embedKey);

        if (savedEmbed) {
            const builtEmbed = new EmbedBuilder()
                .setColor(getColor(savedEmbed.color, getColor('primary')))
                .setTimestamp();

            if (savedEmbed.title) {
                builtEmbed.setTitle(replaceVariables(savedEmbed.title, member, guild));
            }
            if (savedEmbed.description) {
                builtEmbed.setDescription(replaceVariables(savedEmbed.description, member, guild));
            }
            if (savedEmbed.image) {
                builtEmbed.setImage(savedEmbed.image);
            }
            if (savedEmbed.thumbnail) {
                const thumbUrl = savedEmbed.thumbnail.toLowerCase() === 'user'
                    ? member.user.displayAvatarURL({ dynamic: true, size: 512 })
                    : savedEmbed.thumbnail;
                builtEmbed.setThumbnail(thumbUrl);
            }
            if (savedEmbed.footer) {
                builtEmbed.setFooter({ text: replaceVariables(savedEmbed.footer, member, guild) });
            }

            payload.embeds.push(builtEmbed);
        }
    } else {
        // Si no se especifica embed, se envía únicamente el texto plano con variables reemplazadas
        payload.content = replaceVariables(rawText, member, guild);
    }

    return payload;
}

/**
 * Reemplaza las variables estándar de Discord
 */
function replaceVariables(text, member, guild) {
    if (!text) return '';
    return text
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{server\}/g, guild.name)
        .replace(/\{memberCount\}/g, guild.memberCount.toString());
}
