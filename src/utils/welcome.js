import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getWelcomeConfig, saveWelcomeConfig } from '../../utils/database.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure welcome messages for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub => sub.setName('config').setDescription('Open welcome configuration')),
    category: 'Community',

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'Solo administradores pueden usar este comando.',
            });
        }

        const config = await getWelcomeConfig(interaction.client, interaction.guildId);
        
        const embed = buildConfigEmbed(config, interaction.guild);
        const buttons = buildConfigButtons(interaction.guildId);

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components: [buttons] });

        const reply = await interaction.fetchReply().catch(() => null);
        if (!reply) return;

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 600_000,
        });

        collector.on('collect', async button => {
            if (button.customId === `welcome_edit:${interaction.guildId}`) {
                await showConfigModal(button, config, interaction.guildId, interaction.client, interaction);
            } else if (button.customId === `welcome_toggle:${interaction.guildId}`) {
                await toggleWelcome(button, config, interaction.guildId, interaction.client, interaction);
            }
        });
    }
};

function buildConfigEmbed(config, guild) {
    const embed = createEmbed({
        title: '👋 Configurar Bienvenidas',
        description: config.enabled ? '✅ Bienvenidas **activadas**' : '❌ Bienvenidas **desactivadas**',
        color: config.enabled ? 'success' : 'warning',
    });

    embed.addFields(
        {
            name: '📨 Canal',
            value: config.channelId ? `<#${config.channelId}>` : '`No configurado`',
            inline: true,
        },
        {
            name: '🎨 Color',
            value: `\`${config.welcomeEmbed?.color || '#000000'}\``,
            inline: true,
        },
        {
            name: '📝 Título',
            value: config.welcomeEmbed?.title || '`Por defecto`',
            inline: false,
        },
        {
            name: '📄 Descripción',
            value: config.welcomeEmbed?.description?.substring(0, 100) || '`Por defecto`',
            inline: false,
        },
        {
            name: '📸 Thumbnail URL',
            value: config.welcomeEmbed?.thumbnail ? '✅ Configurado' : '❌ No configurado',
            inline: true,
        },
        {
            name: '🖼️ Imagen URL',
            value: config.welcomeEmbed?.image ? '✅ Configurado' : '❌ No configurado',
            inline: true,
        },
        {
            name: '📋 Footer',
            value: config.welcomeEmbed?.footer?.substring(0, 100) || '`Por defecto`',
            inline: false,
        },
    );

    embed.setFooter({ text: 'Variables: {user}, {mention}, {server}, {memberCount}, {joinedAt}' });

    return embed;
}

function buildConfigButtons(guildId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`welcome_edit:${guildId}`)
            .setLabel('✏️ Editar')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`welcome_toggle:${guildId}`)
            .setLabel('🔄 Activar/Desactivar')
            .setStyle(ButtonStyle.Secondary),
    );
}

async function showConfigModal(button, config, guildId, client, rootInteraction) {
    const modal = new ModalBuilder()
        .setCustomId(`welcome_modal:${guildId}`)
        .setTitle('⚙️ Configurar Bienvenida');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Título del Embed')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(config.welcomeEmbed?.title || '👋 ¡Bienvenido!'),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Descripción')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setValue(config.welcomeEmbed?.description || 'Bienvenido {mention} a {server}'),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('channel')
                .setLabel('ID del canal de bienvenida')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(config.channelId || ''),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (hex: #FF0000)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(config.welcomeEmbed?.color || '#0099ff'),
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('thumbnail')
                .setLabel('URL de Thumbnail')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(config.welcomeEmbed?.thumbnail || ''),
        ),
    );

    await button.showModal(modal);

    const submitted = await button.awaitModalSubmit({
        filter: i => i.customId === `welcome_modal:${guildId}` && i.user.id === button.user.id,
        time: 600_000,
    }).catch(() => null);

    if (!submitted) return;

    try {
        const title = submitted.fields.getTextInputValue('title');
        const description = submitted.fields.getTextInputValue('description');
        const channel = submitted.fields.getTextInputValue('channel');
        const color = submitted.fields.getTextInputValue('color');
        const thumbnail = submitted.fields.getTextInputValue('thumbnail');

        const newConfig = {
            ...config,
            enabled: config.enabled !== false ? true : false,
            channelId: channel || null,
            welcomeEmbed: {
                ...config.welcomeEmbed,
                title,
                description,
                color,
                thumbnail: thumbnail || null,
            },
        };

        await saveWelcomeConfig(client, guildId, newConfig);

        await submitted.reply({
            embeds: [successEmbed('✅ Guardado', 'Configuración de bienvenida actualizada')],
            flags: MessageFlags.Ephemeral,
        });

        // Actualizar embed raíz
        const updatedConfig = await getWelcomeConfig(client, guildId);
        const embed = buildConfigEmbed(updatedConfig, submitted.guild);
        const buttons = buildConfigButtons(guildId);
        await rootInteraction.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
        logger.error('Error en welcome modal:', error);
        await replyUserError(submitted, {
            type: ErrorTypes.UNKNOWN,
            message: 'Error al guardar configuración',
        });
    }
}

async function toggleWelcome(button, config, guildId, client, rootInteraction) {
    try {
        const newConfig = {
            ...config,
            enabled: !config.enabled,
        };

        await saveWelcomeConfig(client, guildId, newConfig);

        await button.reply({
            embeds: [successEmbed('✅ Actualizado', `Bienvenidas ${newConfig.enabled ? '**activadas**' : '**desactivadas**'}`)],
            flags: MessageFlags.Ephemeral,
        });

        const updatedConfig = await getWelcomeConfig(client, guildId);
        const embed = buildConfigEmbed(updatedConfig, button.guild);
        const buttons = buildConfigButtons(guildId);
        await rootInteraction.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
        logger.error('Error toggling welcome:', error);
        await replyUserError(button, { type: ErrorTypes.UNKNOWN, message: 'Error al cambiar estado' });
    }
}

function replacePlaceholders(text, user, guild, member) {
    if (!text) return text;
    return text
        .replace(/{user}/g, user.username)
        .replace(/{mention}/g, user.toString())
        .replace(/{server}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount)
        .replace(/{joinedAt}/g, new Date(member.joinedAt).toLocaleDateString('es-ES'));
}

export { replacePlaceholders };
