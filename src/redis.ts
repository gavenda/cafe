import { RedisClient } from 'bun';

/** Snapshots older than this are dropped by Redis. Covers the 14-day history view with room to spare. */
export const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24 * 45;
/** Computed leaderboards are a cache; they can be rebuilt from snapshots at any time. */
export const BOARD_TTL_SECONDS = 60 * 60 * 24 * 8;

export const createRedis = () => new RedisClient(process.env.REDIS_URL ?? 'redis://localhost:6379');

export const keys = {
  /** SET of guild ids that have configured cafe. */
  guilds: () => 'cafe:guilds',
  /** HASH of guild settings: channel_id, daily_message_id, weekly_message_id. */
  guild: (guildId: string) => `cafe:guild:${guildId}`,
  /** SET of trainer ids the guild is watching. */
  guildTrainers: (guildId: string) => `cafe:guild:${guildId}:trainers`,
  /** HASH of trainer details: name, circle_id, circle_name, fans, updated_at. */
  trainer: (trainerId: string) => `cafe:trainer:${trainerId}`,
  /** ZSET of trainer id -> lifetime fan total, one per UTC day. */
  fans: (day: string) => `cafe:fans:${day}`,
  /** ZSET of trainer id -> fans gained in the period ending on `day`, scoped to a guild. */
  board: (guildId: string, period: string, day: string) => `cafe:board:${guildId}:${period}:${day}`
};
