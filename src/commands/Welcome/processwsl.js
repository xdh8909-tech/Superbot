import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../config/bot.js';

export function buildWelcomePayload(client, guild, member, rawText) {
    const payload = {
        content: '',
        embeds: []
    };

    if (!rawText) return payload;

    const embedMatch = rawText.match(/\{embed:([a-zA-Z0-9_\-]+)\}/i);

    if (embedMatch) {
        const embedName = embedMatch[1].toLowerCase().trim();
        const cleanedText = rawText.replace(embedMatch[0], '').trim();
        payload.content = replaceVariables(cleanedText, member, guild);

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
        payload.content = replaceVariables(rawText, member, guild);
    }

    return payload;
}

function replaceVariables(text, member, guild) {
    if (!text) return '';
    return text
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{server\}/g, guild.name)
        .replace(/\{memberCount\}/g, guild.memberCount.toString());
}
