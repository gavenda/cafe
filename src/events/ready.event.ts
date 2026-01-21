import { Events } from 'discord.js';
import type { AppEvent } from './event';
import { getLogger } from '@logtape/logtape';

const logger = getLogger(['cafe', 'event:ready']);

export const readyEvent: AppEvent<Events.ClientReady> = {
  event: Events.ClientReady,
  once: true,
  execute: async (_, client) => {
    logger.info({ message: `Ready! Logged in`, user: client.user.tag });
  }
};
