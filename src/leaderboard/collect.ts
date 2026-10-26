import { getLogger } from '@logtape/logtape';
import type { AppContext } from 'cafe/context';
import { fetchTrainerFans } from 'cafe/uma-moe';
import { today, type Day } from './day';
import { getAllWatchedTrainerIds, saveSnapshot } from './trainers';

/** Pause between uma.moe requests so we don't hammer the API. */
const REQUEST_DELAY_MS = 250;

/** Fetches every watched trainer's fan total from uma.moe and records it as the day's snapshot. */
export const collectSnapshots = async (context: AppContext, day: Day = today()) => {
  const logger = getLogger(['cafe', 'collect']);
  const { redis } = context;
  const trainerIds = await getAllWatchedTrainerIds(redis);

  logger.info({ message: 'Collecting fan snapshots', day, trainers: trainerIds.length });

  let saved = 0;

  for (const trainerId of trainerIds) {
    try {
      const trainer = await fetchTrainerFans(trainerId);

      if (trainer) {
        await saveSnapshot(redis, trainer, day);
        saved++;
      } else {
        logger.warn({ message: 'Trainer not found on uma.moe', trainerId });
      }
    } catch (error) {
      logger.error({ message: 'Unable to fetch trainer', trainerId, error });
    }

    await Bun.sleep(REQUEST_DELAY_MS);
  }

  logger.info({ message: 'Collected fan snapshots', day, saved, total: trainerIds.length });
};
