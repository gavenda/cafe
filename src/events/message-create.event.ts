import { Events } from 'discord.js';
import type { AppEvent } from './event';
import { getLogger } from '@logtape/logtape';

const logger = getLogger(['cafe', 'event:message-create']);

export const messageCreateEvent: AppEvent<Events.MessageCreate> = {
  event: Events.MessageCreate,
  once: false,
  execute: async (context, message) => {
    if (message.author.bot) return;

    logger.info({
      message: `Received message`,
      content: `[${message.guild?.name || 'Unknown'}] ${message.author.globalName}: ${message.content}`,
      username: message.author.username,
      guild: message.guild?.name ?? 'Unknown'
    });

    if (!message.mentions.users.has(context.applicationId)) return;
    if (!message.member) return;
    if (!message.guildId) return;
  }
};
