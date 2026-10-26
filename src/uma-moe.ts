const UMA_MOE_API_URL = 'https://uma.moe/api/v4';

interface AlltimeRanking {
  viewer_id: number;
  trainer_name: string;
  total_fans: number;
  circle_id: number | null;
  circle_name: string | null;
}

export interface TrainerFans {
  id: string;
  name: string;
  totalFans: number;
  circleId: string | null;
  circleName: string | null;
}

/** Trainer ids on uma.moe are 9-12 digit account ids. */
export const isTrainerId = (value: string) => /^\d{9,12}$/.test(value);

/**
 * Looks up a trainer's lifetime fan total. Returns null when uma.moe has no record of them.
 * Uses the all-time rankings search since it is small and includes trainers inactive this month.
 */
export const fetchTrainerFans = async (trainerId: string): Promise<TrainerFans | null> => {
  const url = new URL(`${UMA_MOE_API_URL}/rankings/alltime`);
  url.searchParams.set('query', trainerId);
  url.searchParams.set('limit', '10');

  const response = await fetch(url, {
    headers: { 'X-API-Key': process.env.UMA_MOE_API_KEY },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`uma.moe responded with ${response.status} for trainer ${trainerId}`);
  }

  const body = (await response.json()) as { rankings: AlltimeRanking[] };
  // The query also matches names partially, so pick the exact id.
  const ranking = body.rankings.find((row) => String(row.viewer_id) === trainerId);

  if (!ranking) return null;

  return {
    id: trainerId,
    name: ranking.trainer_name,
    totalFans: ranking.total_fans,
    circleId: ranking.circle_id === null ? null : String(ranking.circle_id),
    circleName: ranking.circle_name
  };
};
