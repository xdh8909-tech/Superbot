import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import embedModule from './embedwls.js'; // Mismo nivel (./)

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Crea y gestiona tarjetas embed personalizadas')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Crea o actualiza una tarjeta embed con un nombre único')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Nombre identificador para la tarjeta (ej. bienvenida1)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Título del embed (Soporta {username}, {server})')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Texto principal ({user}, {username}, {server}, {memberCount})')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Código Hex (#d9510c) o preset (primary, success, blurple)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL del banner grande inferior')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('URL de la miniatura o escribe "user" para la foto del usuario')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer')
                        .setDescription('Texto de pie de página')
                        .setRequired(false))),

    async execute(interaction, config, client) {
        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.PERMISSION, 
                    message: 'Necesitas el permiso de **Administrar Servidor** para usar `/embed`.' 
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'create':
                    return await embedModule.execute(interaction, config, client);
                default:
                    logger.warn(`Subcomando desconocido en /embed: ${subcommand}`);
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.CONFIGURATION, 
                    message: error.userMessage || 'Ocurrió un error al procesar el comando.' 
                });
            }
            await handleInteractionError(interaction, error, { command: 'embed' });
        }
    },
};
