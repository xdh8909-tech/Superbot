import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import wlcSetup from './modules/wlc_setup.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('wlc')
        .setDescription('Configure and customize the welcome system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure a fully customizable welcome embed')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send welcome messages to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Embed title ({username}, {server}, etc.)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message ({user}, {username}, {server}, {memberCount})')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Hex code or color name (e.g. #d9510c, primary, blurple)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL of the large banner image at the bottom')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('thumbnail')
                        .setDescription('URL for small side image or type "user" for member avatar')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('footer')
                        .setDescription('Small text shown at the bottom of the embed')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Whether to ping the user in the channel')
                        .setRequired(false))),

    async execute(interaction, config, client) {
        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.PERMISSION, 
                    message: 'You need the **Manage Server** permission to use `/wlc`.' 
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'setup':
                    return await wlcSetup.execute(interaction, config, client);
                default:
                    logger.warn(`Unknown /wlc subcommand: ${subcommand}`);
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.CONFIGURATION, 
                    message: error.userMessage || 'Something went wrong.' 
                });
            }
            await handleInteractionError(interaction, error, { command: 'wlc' });
        }
    },
};
