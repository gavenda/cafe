import { getFileSink } from '@logtape/file';
import { ansiColorFormatter, configure, getConsoleSink, getLogger, withFilter } from '@logtape/logtape';
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import i18next from 'i18next';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppContext } from './context';
import { events } from './events';
import { collectSnapshots } from './leaderboard/collect';
import { today } from './leaderboard/day';
import { publishAllLeaderboards } from './leaderboard/publish';
import en from './locales/en.json';
import { createRedis } from './redis';

/** Daily at 17:00 UTC, after uma.moe has refreshed the previous game day. */
const TALLY_SCHEDULE = '0 17 * * *';

export const main = async () => {
  if (!process.env.TOKEN) {
    throw new Error('TOKEN is required.');
  }
  if (!process.env.CLIENT_ID) {
    throw new Error('CLIENT_ID is required.');
  }
  if (!process.env.UMA_MOE_API_KEY) {
    throw new Error('UMA_MOE_API_KEY is required.');
  }

  // Configure logging
  await configure({
    sinks: {
      console: withFilter(getConsoleSink({ nonBlocking: true, formatter: ansiColorFormatter }), 'info'),
      file: getFileSink('data/logs/cafe.log', {
        lazy: true,
        bufferSize: 8192,
        flushInterval: 5000,
        nonBlocking: true
      })
    },
    loggers: [
      { category: ['logtape', 'meta'], sinks: ['file'] },
      { category: ['cafe'], lowestLevel: 'debug', sinks: ['console', 'file'] }
    ],
    contextLocalStorage: new AsyncLocalStorage()
  });

  const logger = getLogger(['cafe', 'main']);

  const redis = createRedis();
  await redis.connect();

  // Create discord client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    presence: {
      status: 'online',
      activities: [{ name: `A special cup of coffee for you ☕`, type: ActivityType.Custom }]
    }
  });

  // Handle application errors
  client.on(Events.Error, (error) => {
    logger.error('Internal error', { error });
  });

  const context: AppContext = {
    applicationId: process.env.CLIENT_ID,
    client,
    redis
  };

  // Register events
  for (const { once, event, execute } of events) {
    logger.debug({ message: `Registering event handler`, event });

    if (once) {
      // @ts-expect-error too much OR typing here, compiler will get confused
      client.once(event, ($event) => execute(context, $event));
    } else {
      // @ts-expect-error too much OR typing here, compiler will get confused
      client.on(event, ($event) => execute(context, $event));
    }
  }

  // Tally fans every day, and post the weekly leaderboard on Mondays.
  const tally = Bun.cron(
    TALLY_SCHEDULE,
    async () => {
      try {
        const day = today();
        await collectSnapshots(context, day);
        await publishAllLeaderboards(context, 'daily', day);

        if (new Date().getUTCDay() === 1) {
          await publishAllLeaderboards(context, 'weekly', day);
        }
      } catch (error) {
        logger.error({ message: 'Daily tally failed', error });
      }
    },
    { tz: 'UTC' }
  );

  const cleanup = async () => {
    logger.info('Received SIGINT/SIGTERM, cleaning up');
    tally.stop();
    if (client.isReady()) {
      await client.destroy();
    }
    redis.close();
    process.exit(0);
  };

  // Graceful disconnect. The cast works around bun-types' `memoryPressure` overload hiding
  // the signal overloads from @types/node 25.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    (process as NodeJS.EventEmitter).on(signal, () => void cleanup());
  }

  try {
    // Initialize i18next
    await i18next.init({
      lng: 'en-US',
      resources: {
        en
      }
    });

    // Now ready to login to gateway
    await client.login(process.env.TOKEN);
  } catch (error) {
    logger.error('Unable to connect to discord gateway', { error });
    process.exit(1);
  } finally {
    if (process.send) {
      process.send('ready');
    }
  }
};
