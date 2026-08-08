import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { updateWelcomeConfig } from '../../../utils/database.js';
import { formatWelcomeMessage, truncateForEmbedField } from '../../../utils/welcome.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';

export default {
    async execute(interaction) {
        const { options, guild, client } = interaction;

        const channel = options.getChannel('channel');
        const title = options.getString('title');
        const message = options.getString('message');
        const colorInput = options.getString('color');
        const image = options.getString('image');
        const thumbnailInput = options.getString('thumbnail');
        const footerText = options.getString('footer');
        const ping = options.getBoolean('ping') ?? false;

        if (image) {
            try {
                new URL(image);
            } catch (e) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.VALIDATION, 
                    message: 'Ingresa una URL de imagen válida (debe comenzar con http:// o https://)' 
                });
            }
        }

        try {
            // Guarda los datos del Embed en la base de datos
            await updateWelcomeConfig(client, guild.id, {
                enabled: true,
                channelId: channel.id,
                welcomeTitle: title,
                welcomeMessage: message,
                welcomeColor: colorInput || undefined,
                welcomeImage: image || undefined,
                welcomeThumbnail: thumbnailInput || undefined,
                welcomeFooter: footerText || undefined,
                welcomePing: ping
            });

            logger.info(`[Welcome Embed] Configurado por ${interaction.user.tag} en ${guild.name} (${guild.id})`);

            const formattedMessage = formatWelcomeMessage(message, {
                user: interaction.user,
                guild
            });

            let embedColor = getColor('primary');
            if (colorInput) {
                const cleanHex = colorInput.replace('#', '');
                const parsedColor = parseInt(cleanHex, 16);
                if (!isNaN(parsedColor)) {
                    embedColor = parsedColor;
                }
            }

            // Muestra una vista previa exacta de cómo quedará el Embed
            const previewEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(truncateForEmbedField(formattedMessage))
                .setColor(embedColor)
                .setTimestamp();

            if (image) previewEmbed.setImage(image);

            if (thumbnailInput) {
                if (thumbnailInput.toLowerCase() === 'user') {
                    previewEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
                } else {
                    previewEmbed.setThumbnail(thumbnailInput);
                }
            }

            if (footerText) previewEmbed.setFooter({ text: footerText });

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ **¡Mensaje de bienvenida en Embed configurado exitosamente en ${channel}!**\nVista previa:`,
                embeds: [previewEmbed]
            });

        } catch (error) {
            logger.error(`[Welcome Embed] Error al configurar embed en ${guild.id}:`, error);
            await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'Ocurrió un error al guardar la configuración en la base de datos.' 
            });
        }
    }
};
