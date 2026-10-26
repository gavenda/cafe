import { getLogger } from '@logtape/logtape';
import { bannerAttachment } from 'cafe/banner';
import type { AppContext } from 'cafe/context';
import { keys } from 'cafe/redis';
import { DiscordAPIError, MessageFlags, RESTJSONErrorCodes, type Snowflake } from 'discord.js';
import { leaderboardComponents } from './components';
import type { Day } from './day';
import { computeStandings, latestSnapshotDay, type Period } from './standings';

export const PERIODS: Period[] = ['daily', 'weekly'];

/** Guild settings fields for one leaderboard. Daily and weekly each have their own channel and post. */
const fields = (period: Period) => ({
  channel: `${period}_channel_id`,
  message: `${period}_message_id`
});

/** Discord says the message or channel no longer exists. Checks the code, not the class, so it holds across copies of discord.js. */
const isGone = (error: unknown) => {
  const code = (error as Partial<DiscordAPIError> | null)?.code;
  return code === RESTJSONErrorCodes.UnknownMessage || code === RESTJSONErrorCodes.UnknownChannel;
};

const fetchTextChannel = async (context: AppContext, channelId: Snowflake) => {
  const channel = await context.client.channels.fetch(channelId).catch((error: unknown) => {
    if (isGone(error)) return null;
    throw error;
  });
  return channel?.isSendable() ? channel : null;
};

export const getLeaderboardChannelId = async (context: AppContext, guildId: string, period: Period) =>
  context.redis.hget(keys.guild(guildId), fields(period).channel);

/**
 * Updates the guild's leaderboard post for the period. Each leaderboard is one message that is
 * edited in place; a new one is sent only when there is none yet or someone deleted it.
 */
export const publishLeaderboard = async (context: AppContext, guildId: string, period: Period, day: Day) => {
  const logger = getLogger(['cafe', 'publish']);
  const { redis } = context;
  const { channel: channelField, message: messageField } = fields(period);

  const settings = await redis.hgetall(keys.guild(guildId));
  const channelId = settings[channelField];

  if (!channelId) {
    logger.debug({ message: 'Leaderboard is off, skipping', guildId, period });
    return;
  }

  const channel = await fetchTextChannel(context, channelId);

  if (!channel) {
    logger.error({ message: 'Leaderboard channel is missing or not a text channel', guildId, period, channelId });
    return;
  }

  const standings = await computeStandings(redis, guildId, period, day);
  const components = leaderboardComponents(standings);
  const messageId = settings[messageField];

  if (messageId) {
    try {
      // Re-upload the banner and drop the old attachments so the edited post always shows it.
      await channel.messages.edit(messageId, { components, files: [bannerAttachment()], attachments: [] });
      logger.info({ message: 'Updated leaderboard', guildId, period, day, ranked: standings.ranked.length });
      return;
    } catch (error) {
      if (!isGone(error)) throw error;
      logger.warn({ message: 'Leaderboard post was deleted, posting a new one', guildId, period, messageId });
    }
  }

  const message = await channel.send({
    components,
    files: [bannerAttachment()],
    flags: MessageFlags.IsComponentsV2
  });
  await redis.hset(keys.guild(guildId), { [messageField]: message.id });

  logger.info({ message: 'Posted leaderboard', guildId, period, day, ranked: standings.ranked.length });
};

/**
 * Points a leaderboard at a channel, or turns it off with `null`. Moving it removes the old post
 * so the leaderboard only ever lives in one place, then posts it in the new channel right away.
 */
export const setLeaderboardChannel = async (
  context: AppContext,
  guildId: string,
  period: Period,
  channelId: Snowflake | null
) => {
  const logger = getLogger(['cafe', 'publish']);
  const { redis } = context;
  const { channel: channelField, message: messageField } = fields(period);

  const settings = await redis.hgetall(keys.guild(guildId));
  const oldChannelId = settings[channelField];
  const oldMessageId = settings[messageField];

  if (oldChannelId === channelId) return;

  if (oldChannelId && oldMessageId) {
    const oldChannel = await fetchTextChannel(context, oldChannelId);
    await oldChannel?.messages.delete(oldMessageId).catch((error: unknown) => {
      if (!isGone(error)) logger.warn({ message: 'Unable to remove old leaderboard post', guildId, period, error });
    });
  }

  await redis.hdel(keys.guild(guildId), messageField);

  if (!channelId) {
    await redis.hdel(keys.guild(guildId), channelField);
    return;
  }

  await redis.hset(keys.guild(guildId), { [channelField]: channelId });
  await redis.sadd(keys.guilds(), guildId);
  await publishLeaderboard(context, guildId, period, await latestSnapshotDay(redis));
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
