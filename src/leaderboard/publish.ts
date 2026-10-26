import { getLogger } from '@logtape/logtape';
import type { AppContext } from 'cafe/context';
import { keys } from 'cafe/redis';
import { MessageFlags } from 'discord.js';
import { leaderboardComponents } from './components';
import type { Day } from './day';
import { computeStandings, type Period } from './standings';

/** Posts the guild's leaderboard to its configured channel, replacing the previous one. */
export const publishLeaderboard = async (context: AppContext, guildId: string, period: Period, day: Day) => {
  const logger = getLogger(['cafe', 'publish']);
  const { client, redis } = context;
  const messageField = `${period}_message_id`;

  const settings = await redis.hgetall(keys.guild(guildId));
  const channelId = settings['channel_id'];

  if (!channelId) {
    logger.info({ message: 'No leaderboard channel set, skipping', guildId, period });
    return;
  }

  const standings = await computeStandings(redis, guildId, period, day);
  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isSendable()) {
    logger.error({ message: 'Leaderboard channel is not a sendable text channel', guildId, channelId });
    return;
  }

  const message = await channel.send({
    components: leaderboardComponents(standings),
    flags: MessageFlags.IsComponentsV2
  });

  const previousMessageId = settings[messageField];

  if (previousMessageId && channel.isTextBased() && 'messages' in channel) {
    // The old message may already be gone, or in a channel we can no longer see.
    await channel.messages.delete(previousMessageId).catch((error: unknown) => {
      logger.warn({ message: 'Unable to delete previous leaderboard', guildId, previousMessageId, error });
    });
  }

  await redis.hset(keys.guild(guildId), { [messageField]: message.id });

  logger.info({ message: 'Published leaderboard', guildId, period, day, ranked: standings.ranked.length });
};

export const publishAllLeaderboards = async (context: AppContext, period: Period, day: Day) => {
  const logger = getLogger(['cafe', 'publish']);
  const guildIds = await context.redis.smembers(keys.guilds());

  for (const guildId of guildIds) {
    try {
      await publishLeaderboard(context, guildId, period, day);
    } catch (error) {
      logger.error({ message: 'Unable to publish leaderboard', guildId, period, error });
    }
  }
};
