import type { RedisClient } from 'bun';
import { BOARD_TTL_SECONDS, keys } from 'cafe/redis';
import { shiftDay, today, type Day } from './day';
import { getTrainers, type Trainer } from './trainers';

export type Period = 'daily' | 'weekly';

export const PERIOD_DAYS: Record<Period, number> = { daily: 1, weekly: 7 };

export interface Standing extends Trainer {
  rank: number;
  gain: number;
}

export interface Standings {
  period: Period;
  day: Day;
  since: Day;
  /** Trainers with a gain for the period, highest first. */
  ranked: Standing[];
  /** Trainers missing a snapshot at either end of the period, usually because they were just added. */
  pending: Trainer[];
}

/**
 * Builds the guild's leaderboard for the period ending on `day`.
 *
 * The gain is computed in Redis: intersect the day's snapshot, the snapshot at the start of the
 * period (weighted -1), and the guild's watched set (weighted 0). Only trainers present in all
 * three end up on the board, scored by fans gained.
 */
export const computeStandings = async (
  redis: RedisClient,
  guildId: string,
  period: Period,
  day: Day
): Promise<Standings> => {
  const since = shiftDay(day, -PERIOD_DAYS[period]);
  const board = keys.board(guildId, period, day);

  await redis.zinterstore(board, 3, keys.fans(day), keys.fans(since), keys.guildTrainers(guildId), 'WEIGHTS', 1, -1, 0);
  await redis.expire(board, BOARD_TTL_SECONDS);

  const [scores, watchedIds] = await Promise.all([
    redis.zrevrange(board, 0, -1, 'WITHSCORES'),
    redis.smembers(keys.guildTrainers(guildId))
  ]);
  const trainers = await getTrainers(redis, watchedIds);

  const ranked: Standing[] = [];
  let previousGain: number | undefined;
  let rank = 0;

  scores.forEach(([trainerId, score], index) => {
    const gain = Number(score);
    // Tied trainers share a rank (1, 2, 2, 4).
    if (gain !== previousGain) rank = index + 1;
    previousGain = gain;

    const trainer = trainers.get(trainerId);
    if (trainer) ranked.push({ ...trainer, rank, gain });
  });

  const rankedIds = new Set(ranked.map((standing) => standing.id));
  const pending = [...trainers.values()].filter((trainer) => !rankedIds.has(trainer.id));

  return { period, day, since, ranked, pending };
};

/** The newest day with a snapshot: today once collection has run, otherwise yesterday. */
export const latestSnapshotDay = async (redis: RedisClient): Promise<Day> => {
  const day = today();
  return (await redis.exists(keys.fans(day))) ? day : shiftDay(day, -1);
};
