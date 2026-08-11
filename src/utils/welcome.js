// Utilities for welcome templates and validation
import { logger } from './logger.js';

const DEFAULT_TEMPLATES = {
    welcome: 'Welcome {user} to {server}!',
    goodbye: '{user.tag} has left the server.'
};

function replaceAll(message, token, value) {
    if (value === undefined || value === null) {
        return message;
    }
    return message.split(token).join(String(value));
}

export function truncateForEmbedField(value, maxLength = 1024) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '—';
    }
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function isValidUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

export function sanitizeEmbedTemplate(template) {
    // Allow only a safe subset of embed fields; sanitize lengths and urls
    if (!template || typeof template !== 'object') return null;

    const out = {};

    if (template.title && typeof template.title === 'string') out.title = truncateForEmbedField(template.title, 256);
    if (template.description && typeof template.description === 'string') out.description = truncateForEmbedField(template.description, 4096);

    if (template.url && isValidUrl(template.url)) out.url = template.url;

    if (template.color) {
        // Accept hex string (#xxxxxx) or integer
        if (typeof template.color === 'string' && template.color.startsWith('#')) {
            const parsed = parseInt(template.color.replace('#', ''), 16);
            if (!Number.isNaN(parsed)) out.color = parsed;
        } else if (Number.isInteger(template.color)) {
            out.color = template.color;
        }
    }

    if (template.thumbnail && template.thumbnail.url && typeof template.thumbnail.url === 'string') {
        if (isValidUrl(template.thumbnail.url) || template.thumbnail.url.includes('{user.avatar}')) out.thumbnail = { url: template.thumbnail.url };
    }

    if (template.image && template.image.url && typeof template.image.url === 'string') {
        if (isValidUrl(template.image.url) || template.image.url.includes('{user.avatar}')) out.image = { url: template.image.url };
    }

    if (template.author && typeof template.author === 'object' && template.author.name) {
        out.author = { name: truncateForEmbedField(String(template.author.name), 256) };
        if (template.author.icon_url && isValidUrl(template.author.icon_url)) out.author.icon_url = template.author.icon_url;
        if (template.author.url && isValidUrl(template.author.url)) out.author.url = template.author.url;
    }

    if (template.footer && typeof template.footer === 'object' && template.footer.text) {
        out.footer = { text: truncateForEmbedField(String(template.footer.text), 2048) };
        if (template.footer.icon_url && isValidUrl(template.footer.icon_url)) out.footer.icon_url = template.footer.icon_url;
    }

    if (Array.isArray(template.fields)) {
        out.fields = [];
        for (const f of template.fields.slice(0, 25)) {
            if (!f || typeof f !== 'object') continue;
            const name = truncateForEmbedField(String(f.name ?? ''));
            const value = truncateForEmbedField(String(f.value ?? ''));
            const inline = Boolean(f.inline);
            if (name && value) out.fields.push({ name, value, inline });
        }
    }

    if (Array.isArray(template.components)) {
        // keep as-is; components are validated when building ActionRows
        out.components = template.components;
    }

    if (template.timestamp === true || template.timestamp === 'now' || (typeof template.timestamp === 'string' && !Number.isNaN(Date.parse(template.timestamp)))) {
        out.timestamp = template.timestamp;
    }

    if (template.useGeneratedImage === true || template.use_generated_image === true) {
        out.useGeneratedImage = true;
    }

    return out;
}

export function formatWelcomeMessage(message, data) {
    if (typeof message !== 'string') return '';
    if (!message) return '';
    if (!data || typeof data !== 'object') return message;

    const user = data?.user;
    const guild = data?.guild;

    if (!user || typeof user !== 'object') {
        logger.warn('Invalid user object passed to formatWelcomeMessage');
    }
    if (!guild || typeof guild !== 'object') {
        logger.warn('Invalid guild object passed to formatWelcomeMessage');
    }

    const tokens = {
        '{user}': user?.toString?.() || 'User',
        '{user.mention}': user?.toString?.() || 'User',
        '{user.tag}': user?.tag || 'Unknown#0000',
        '{user.username}': user?.username || 'Unknown',
        '{username}': user?.username || 'Unknown',
        '{user.discriminator}': user?.discriminator || '0000',
        '{user.id}': user?.id || 'unknown',
        '{server}': guild?.name || 'Server',
        '{server.name}': guild?.name || 'Server',
        '{guild.name}': guild?.name || 'Server',
        '{guild.id}': guild?.id || 'unknown',
        '{guild.memberCount}': guild?.memberCount?.toString?.() || '0',
        '{memberCount}': guild?.memberCount?.toString?.() || '0',
        '{membercount}': guild?.memberCount?.toString?.() || '0',
        '{user.avatar}': user?.displayAvatarURL?.({ extension: 'png', size: 512 }) || ''
    };

    let result = message;
    for (const [token, value] of Object.entries(tokens)) {
        if (value === undefined || value === null) continue;
        result = replaceAll(result, token, String(value));
    }

    return result;
}

export function getDefaultWelcomeMessage() {
    return DEFAULT_TEMPLATES.welcome;
}

export function getDefaultGoodbyeMessage() {
    return DEFAULT_TEMPLATES.goodbye;
}
/**
 * Obtiene la configuración de bienvenida del servidor.
 * La configuración se almacena directamente en la DB del bot.
 */
export async function getWelcomeConfig(client, guildId) {
    if (!client?.db || !guildId) {
        return null;
    }

    try {
        return await client.db.get(`guild:${guildId}:welcome`) || null;
    } catch (error) {
        logger.error('Error getting welcome config:', {
            guildId,
            error: error.message
        });

        return null;
    }
}
