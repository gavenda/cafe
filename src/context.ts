import type { RedisClient } from 'bun';
import type { Client } from 'discord.js';

export interface AppContext {
  applicationId: string;
  client: Client;
  redis: RedisClient;
}
