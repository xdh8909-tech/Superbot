import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../utils/database.js';
import { formatWelcomeMessage, truncateForEmbedField } from '../../utils/welcome.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, replyUserError } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure and create custom embed welcome messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up the welcome message system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send welcome messages to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome text ({user}, {username}, {server}, {memberCount})')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Title for the welcome embed')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex color code (e.g. #d9510c)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL of the large banner image')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('URL for small image or write "user" for member avatar')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer')
                        .setDescription('Footer text at the bottom of the embed')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Whether to ping the user in the channel')
                        .setRequired(false))),

    async execute(interaction) {
        try {
            const deferSuccess = await InteractionHelper.safeDefer(interaction);
            if (!deferSuccess) {
                logger.warn(`Welcome interaction defer failed`, {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'welcome'
                });
                return;
            }
        } catch (deferError) {
            logger.error(`Welcome defer error`, { error: deferError.message });
            return;
        }

        const { options, guild, client } = interaction;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the **Manage Server** permission to use `/welcome`.' });
        }

        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const message = options.getString('message');
            const title = options.getString('title') || '¡Bienvenido/a al servidor!';
            const colorInput = options.getString('color');
            const image = options.getString('image');
            const thumbnailInput = options.getString('thumbnail');
            const footerText = options.getString('footer');
            const ping = options.getBoolean('ping') ?? false;

            if (!message || message.trim().length === 0) {
                logger.warn(`[Welcome] Empty message provided by ${interaction.user.tag} in ${guild.name}`);
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Welcome message cannot be empty' });
            }

            // Validar URL de imagen si fue proporcionada
            if (image) {
                try {
                    new URL(image);
                } catch (e) {
                    logger.warn(`[Welcome] Invalid image URL provided by ${interaction.user.tag}: ${image}`);
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Please provide a valid image URL (must start with http:// or https://)' });
                }
            }

            try {
                // Guardar la configuración en la base de datos del bot
                await updateWelcomeConfig(client, guild.id, {
                    enabled: true,
                    channelId: channel.id,
                    welcomeMessage: message,
                    welcomeTitle: title,
                    welcomeColor: colorInput,
                    welcomeImage: image || undefined,
                    welcomeThumbnail: thumbnailInput,
                    welcomeFooter: footerText,
                    welcomePing: ping
                });

                logger.info(`[Welcome] Setup configured by ${interaction.user.tag} for guild ${guild.name} (${guild.id})`);

                const formattedMessage = formatWelcomeMessage(message, {
                    user: interaction.user,
                    guild
                });

                // Procesamiento de color con fallback
                let embedColor = getColor('success');
                if (colorInput) {
                    const cleanHex = colorInput.replace('#', '');
                    const parsedColor = parseInt(cleanHex, 16);
                    if (!isNaN(parsedColor)) {
                        embedColor = parsedColor;
                    }
                }

                // Generar Embed de vista previa y prueba
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(title)
                    .setDescription(truncateForEmbedField(formattedMessage))
                    .setTimestamp();

                if (image) {
                    embed.setImage(image);
                }

                if (thumbnailInput) {
                    if (thumbnailInput.toLowerCase() === 'user') {
                        embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
                    } else {
                        embed.setThumbnail(thumbnailInput);
                    }
                }

                if (footerText) {
                    embed.setFooter({ text: footerText });
                }

                const responseEmbed = new EmbedBuilder()
                    .setColor(getColor('success'))
                    .setTitle('Sistema de Bienvenida Configurado')
                    .setDescription(`Las bienvenidas en Embed se enviarán a ${channel}`)
                    .addFields(
                        { name: 'Ping al Usuario', value: ping ? 'Sí' : 'No', inline: true },
                        { name: 'Estado', value: 'Habilitado', inline: true }
                    );

                await InteractionHelper.safeEditReply(interaction, {
                    content: '✅ **Configuración exitosa.** Vista previa de tu Embed:',
                    embeds: [embed, responseEmbed]
                });

            } catch (error) {
                logger.error(`[Welcome] Failed to setup welcome system for guild ${guild.id}:`, error);
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred while configuring the welcome system. Please try again.' });
            }
        }
    },
};
