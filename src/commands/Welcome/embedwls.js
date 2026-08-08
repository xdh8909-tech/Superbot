import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../config/bot.js'; // Sube a /commands y luego a /src para entrar a /config
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js';

export default {
    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) return;

        const { options, guild } = interaction;

        const embedName = options.getString('name').toLowerCase().trim();
        const title = options.getString('title');
        const description = options.getString('description');
        const colorInput = options.getString('color') || 'primary';
        const image = options.getString('image');
        const thumbnail = options.getString('thumbnail');
        const footer = options.getString('footer');

        if (!title && !description && !image) {
            return await replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Debes proporcionar al menos un **título**, **descripción** o **imagen** para guardar el embed.'
            });
        }

        try {
            const embedData = {
                title,
                description,
                color: colorInput,
                image,
                thumbnail,
                footer
            };

            if (!client.customEmbeds) client.customEmbeds = new Map();
            client.customEmbeds.set(`${guild.id}:${embedName}`, embedData);

            logger.info(`[Embed Creator] Embed '${embedName}' guardado para el servidor ${guild.id}`);

            const previewEmbed = new EmbedBuilder()
                .setColor(getColor(colorInput, getColor('primary')))
                .setTimestamp();

            if (title) previewEmbed.setTitle(title);
            if (description) previewEmbed.setDescription(description);
            if (image) previewEmbed.setImage(image);
            if (thumbnail) {
                previewEmbed.setThumbnail(thumbnail.toLowerCase() === 'user' ? interaction.user.displayAvatarURL({ dynamic: true }) : thumbnail);
            }
            if (footer) previewEmbed.setFooter({ text: footer });

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ **¡Embed \`${embedName}\` guardado con éxito!**\nPara vincularlo al sistema de bienvenidas usa: \`{embed:${embedName}}\``,
                embeds: [previewEmbed]
            });

        } catch (error) {
            logger.error(`[Embed Creator] Error al guardar el embed '${embedName}':`, error);
            await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Ocurrió un error al guardar la tarjeta embed.'
            });
        }
    }
};
