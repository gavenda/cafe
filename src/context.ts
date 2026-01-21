import { Client } from 'discord.js';
import { Database } from 'bun:sqlite';

export interface AppContext {
  applicationId: string;
  client: Client;
  database: Database;
}
