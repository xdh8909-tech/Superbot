import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage, truncateForEmbedField } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('welcome-embed')
        .setDescription('Crea y configura un mensaje de bienvenida en Embed 100% personalizable')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Canal donde se enviarán los embeds')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Título principal del Embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Texto/Descripción ({user}, {username}, {server}, {memberCount})')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color Hexadecimal (Ejemplo: #d9510c o #5865F2)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('URL de la imagen grande de abajo (Banner)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('thumbnail')
                .setDescription('URL de la imagen pequeña lateral (Escribe "user" para usar la foto del usuario)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('footer')
                .setDescription('Texto del pie de página (Footer)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('ping')
                .setDescription('¿Mencionar/Etiquetar al usuario fuera del embed?')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) {
                logger.warn(`Welcome interaction defer failed`, {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'welcome-embed'
                });
                return;
            }
        } catch (deferError) {
            logger.error(`Welcome defer error`, { error: deferError.message });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Necesitas el permiso de **Administrar Servidor** para usar este comando.' });
        }

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
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'La URL de la imagen no es válida (debe empezar con http:// o https://)' });
            }
        }

        try {
            // Guardar configuración completa en la base de datos
            await updateWelcomeConfig(client, guild.id, {
                enabled: true,
                channelId: channel.id,
                welcomeTitle: title,
                welcomeMessage: message,
                welcomeColor: colorInput,
                welcomeImage: image || undefined,
                welcomeThumbnail: thumbnailInput,
                welcomeFooter: footerText,
                welcomePing: ping
            });

            logger.info(`[Welcome] Configurado por ${interaction.user.tag} en ${guild.name} (${guild.id})`);

            const formattedMessage = formatWelcomeMessage(message, {
                user: interaction.user,
                guild
            });

            // Resolver color
            let embedColor = getColor('primary');
            if (colorInput) {
                const cleanHex = colorInput.replace('#', '');
                const parsedColor = parseInt(cleanHex, 16);
                if (!isNaN(parsedColor)) {
                    embedColor = parsedColor;
                }
            }

            // Construcción del Embed de muestra
            const sampleEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(truncateForEmbedField(formattedMessage))
                .setColor(embedColor)
                .setTimestamp();

            if (image) {
                sampleEmbed.setImage(image);
            }

            if (thumbnailInput) {
                if (thumbnailInput.toLowerCase() === 'user') {
                    sampleEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
                } else {
                    sampleEmbed.setThumbnail(thumbnailInput);
                }
            }

            if (footerText) {
                sampleEmbed.setFooter({ text: footerText });
            }

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ **¡Bienvenida personalizada configurada en ${channel}!**\nAquí tienes una vista previa de cómo se verá:`,
                embeds: [sampleEmbed]
            });

        } catch (error) {
            logger.error(`[Welcome] Error al configurar bienvedida en ${guild.id}:`, error);
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Ocurrió un error al guardar la configuración.' });
        }
    },
};
