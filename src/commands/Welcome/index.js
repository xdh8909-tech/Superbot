// Creado por - youtube.com/@choreshp
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const welcomeConfig = {
    activo: false,
    canalId: null
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', async () => {
    // /welcome-setup
    const welcomeSetupCommand = new SlashCommandBuilder()
        .setName('welcome-setup')
        .setDescription('Configura el sistema de bienvenidas del servidor.')
        .addStringOption(option =>
            option.setName('estado')
                .setDescription('¿Activar o desactivar el sistema de bienvenidas?')
                .setRequired(true)
                .addChoices(
                    { name: 'Activado', value: 'on' },
                    { name: 'Desactivado', value: 'off' }
                )
        )
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal de texto donde se enviarán las bienvenidas.')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        );

    if (GUILD_ID) {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (guild) {
            await guild.commands.create(welcomeSetupCommand);
        }
    }

    console.log(`Bot ${client.user.tag} activo`);
});

 // interaccipn
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'welcome-setup') {
        const estado = interaction.options.getString('estado');
        const canal = interaction.options.getChannel('canal');

        welcomeConfig.activo = (estado === 'on');
        welcomeConfig.canalId = canal.id;

        const estadoStr = welcomeConfig.activo ? 'Activado' : 'Desactivado';

        const embed = new EmbedBuilder()
            .setDescription(
                `Configuración de Bienvenidas actualizada.\n\n` +
                `**Estado del Sistema**\n` +
                `${estadoStr}\n\n` +
                `**Canal de Bienvenidas**\n` +
                `${canal}`
            )
            .setColor(0xFFC0CB)
            .setAuthor({ name: 'Welcome Bot' })
            .setFooter({ text: 'Sistema de bienvenidas configurado.' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
});

client.on('guildMemberAdd', async member => {
    if (!welcomeConfig.activo || !welcomeConfig.canalId) return;

    const canal = member.guild.channels.cache.get(welcomeConfig.canalId);
    if (!canal) return;

    const servidor = member.guild.name;

    // Mensaje de bienvenida
    await canal.send(
        `🎉 **Welcome** ${member} **to** **${servidor}**! 🎉`
    );

    // Embed de bienvenidaa :)
    const embed = new EmbedBuilder()
        .setDescription(
            `**¡Hola ${member}!**\n` +
            `Es un placer darte la bienvenida a **${servidor}**.\n\n` +
            `**Antes de empezar**\n` +
            `Dirígete a #reglas para leer nuestras **normas** y evitar sanciones.\n\n` +
            `**Roles**\n` +
            `Pásate por #autorols y elige los roles que más te gusten.\n\n` +
            `**Soporte**\n` +
            `**Si ocupps ayuda abre un ticket en #crea-ticket**\n\n` +
            `=========================\n`
        )
        .setColor(0xA14C23)
        .setAuthor({ name: 'Testeo' })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'GRACIAS POR UNIRTE' })
        .setTimestamp();

    await canal.send({ embeds: [embed] });
});

client.login(TOKEN);
