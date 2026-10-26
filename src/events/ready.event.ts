import { getLogger } from '@logtape/logtape';
import { collectSnapshots } from 'cafe/leaderboard/collect';
import { Events } from 'discord.js';
import type { AppEvent } from './event';

const logger = getLogger(['cafe', 'event:ready']);

export const readyEvent: AppEvent<Events.ClientReady> = {
  event: Events.ClientReady,
  once: true,
  execute: async (context, client) => {
    logger.info({ message: `Ready! Logged in`, user: client.user.tag });
    // Refresh today's snapshot so standings are current after a restart. Nothing is posted.
    await collectSnapshots(context).catch((error: unknown) => {
      logger.error({ message: 'Unable to collect snapshots on startup', error });
    });
  }
};
