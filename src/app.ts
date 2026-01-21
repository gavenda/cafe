import { getFileSink } from '@logtape/file';
import { ansiColorFormatter, configure, getConsoleSink, getLogger } from '@logtape/logtape';
import { Database } from 'bun:sqlite';
import Baker from 'cronbake';
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import i18next from 'i18next';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppContext } from './context';
import { events } from './events';
import { beginDailyFan } from './fan/daily-fan';
import en from './locales/en.json';

const SCHEMA_PATH = './schema.sql';

export const main = async () => {
  if (!process.env.TOKEN) {
    throw new Error('TOKEN is required.');
  }
  if (!process.env.CLIENT_ID) {
    throw new Error('CLIENT_ID is required.');
  }
  if (!process.env.SQLITE_FILE) {
    throw new Error('SQLITE_FILE is required.');
  }

  const file = Bun.file(SCHEMA_PATH);
  const schema = await file.text();
  const database = new Database(process.env.SQLITE_FILE);
  const baker = Baker.create();
  // Create schema
  database.run(schema);

  // Configure logging
  await configure({
    sinks: {
      console: getConsoleSink({ nonBlocking: true, formatter: ansiColorFormatter }),
      file: getFileSink('logs/cafe.log', {
        lazy: true,
        bufferSize: 8192,
        flushInterval: 5000,
        nonBlocking: true
      })
    },
    loggers: [
      { category: ['logtape', 'meta'], sinks: ['file'] },
      { category: 'cafe', lowestLevel: 'debug', sinks: ['console', 'file'] }
    ],
    contextLocalStorage: new AsyncLocalStorage()
  });

  const logger = getLogger(['cafe', 'main']);

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
    database,
    client
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

  // Create cron jobs
  baker.add({
    name: 'daily-fan-count',
    cron: '0 0 17 * * *', // Runs daily at midnight
    callback: async () => {
      await beginDailyFan({ context });
    }
  });

  baker.add({
    name: 'weekly-fan-count',
    cron: '0 5 17 * * 1', // Runs daily at midnight
    callback: () => {}
  });

  const cleanup = async () => {
    logger.info('Received SIGINT/SIGTERM, cleaning up');
    if (client.isReady()) {
      await client.destroy();
    }
    process.exit(0);
  };

  // Graceful disconnect
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Initialize i18next
    await i18next.init({
      lng: 'en-US',
      resources: {
        en
      }
    });

    // Start cronjob
    baker.bakeAll();

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
