import type { RedisClient } from 'bun';
import { keys, SNAPSHOT_TTL_SECONDS } from 'cafe/redis';
import type { TrainerFans } from 'cafe/uma-moe';
import type { Day } from './day';

/** How many trainers one guild can watch. Keeps the leaderboard within Discord's message size. */
export const MAX_WATCHED_TRAINERS = 50;

export interface Trainer {
  id: string;
  name: string;
  circleName: string | null;
  fans: number | null;
}

/** Stores the trainer's latest details and records their fan total for the day. */
export const saveSnapshot = async (redis: RedisClient, trainer: TrainerFans, day: Day) => {
  await Promise.all([
    redis.hset(keys.trainer(trainer.id), {
      name: trainer.name,
      circle_id: trainer.circleId ?? '',
      circle_name: trainer.circleName ?? '',
      fans: trainer.totalFans,
      updated_at: new Date().toISOString()
    }),
    redis.zadd(keys.fans(day), trainer.totalFans, trainer.id),
    redis.expire(keys.fans(day), SNAPSHOT_TTL_SECONDS)
  ]);
};

export const getTrainers = async (redis: RedisClient, trainerIds: string[]): Promise<Map<string, Trainer>> => {
  const hashes = await Promise.all(trainerIds.map((id) => redis.hgetall(keys.trainer(id))));
  const trainers = new Map<string, Trainer>();

  trainerIds.forEach((id, index) => {
    const hash = hashes[index] ?? {};
    trainers.set(id, {
      id,
      name: hash['name'] || id,
      circleName: hash['circle_name'] || null,
      fans: hash['fans'] ? Number(hash['fans']) : null
    });
  });

  return trainers;
};

export const getGuildTrainers = async (redis: RedisClient, guildId: string) => {
  const ids = await redis.smembers(keys.guildTrainers(guildId));
  const trainers = await getTrainers(redis, ids);
  return [...trainers.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/** Every trainer watched by at least one guild. */
export const getAllWatchedTrainerIds = async (redis: RedisClient) => {
  const guildIds = await redis.smembers(keys.guilds());
  if (guildIds.length === 0) return [];

  const [first, ...rest] = guildIds.map((guildId) => keys.guildTrainers(guildId));
  return redis.sunion(first!, ...rest);
};
