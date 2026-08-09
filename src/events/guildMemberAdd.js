import { logger } from '../utils/logger.js';
import { getWelcomeConfig } from '../utils/database.js';
import { EmbedBuilder } from 'discord.js';

function replacePlaceholders(text, user, guild, member) {
    if (!text) return text;
    return text
        .replace(/{user}/g, user.username)
        .replace(/{mention}/g, user.toString())
        .replace(/{server}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount)
        .replace(/{joinedAt}/g, new Date(member.joinedAt).toLocaleDateString('es-ES'));
}

export default {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            const config = await getWelcomeConfig(client, member.guild.id);

            if (!config.enabled || !config.channelId) {
                return;
            }

            const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
            if (!channel || !channel.isSendable()) {
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(replacePlaceholders(config.welcomeEmbed?.title, member.user, member.guild, member))
                .setDescription(replacePlaceholders(config.welcomeEmbed?.description, member.user, member.guild, member))
                .setColor(config.welcomeEmbed?.color || '#0099ff')
                .setTimestamp();

            if (config.welcomeEmbed?.thumbnail) {
                embed.setThumbnail(config.welcomeEmbed.thumbnail);
            }

            if (config.welcomeEmbed?.image) {
                embed.setImage(config.welcomeEmbed.image);
            }

            if (config.welcomeEmbed?.footer) {
                embed.setFooter({
                    text: replacePlaceholders(config.welcomeEmbed.footer, member.user, member.guild, member),
                });
            }

            await channel.send({ embeds: [embed] });
            logger.info(`Welcome message sent for ${member.user.tag} in ${member.guild.name}`);
        } catch (error) {
            logger.error('Error in guildMemberAdd welcome:', error);
        }
    },
};
