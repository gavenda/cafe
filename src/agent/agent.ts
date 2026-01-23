import { getLogger } from '@logtape/logtape';
import type { N8NWebhookResponse } from './n8n-webhook-response';
import type { Message, OmitPartialGroupDMChannel } from 'discord.js';
import type { AppContext } from 'cafe/context';

const logger = getLogger(['cafe', 'agent']);

/**
 * Send a prompt to the gpt agent webhook.
 */
export const agentPrompt = async (options: {
  context: AppContext;
  message: OmitPartialGroupDMChannel<Message<boolean>>;
  prompt: string;
}) => {
  if (!process.env.N8N_AGENT_WEBHOOK) return;
  if (!process.env.N8N_AGENT_WEBHOOK_SECRET) return;
  if (!process.env.CAFE_BREW) return;

  const { message, prompt } = options;

  if (!message.guildId) return;

  const clubId = findClubId(process.env.CAFE_BREW, message.guildId);

  if (!clubId) return;

  const { database } = options.context;

  logger.debug({ message: 'Fetching fan history', clubId });

  // Return the entire thing
  const dailyFansQuery = `SELECT unix_date, member_name, fans FROM daily_fan WHERE club_id = ? ORDER BY member_name`;
  const dailyFans = database
    .query<{ unix_date: number; member_name: string; fans: number }, number>(dailyFansQuery)
    .all(parseInt(clubId));

  logger.debug({ message: 'Fetching club information', clubId });

  const clubQuery = `SELECT name, leader FROM club WHERE id = ?`;
  const club = database.query<{ name: string; leader: string }, number>(clubQuery).get(parseInt(clubId));

  const body = {
    message: prompt,
    dailyFans: dailyFans.map((d) => `${d.member_name}|${d.fans}|${d.unix_date}\n`)
  };

  const headers = {
    'Content-Type': `application/json`,
    'Uma-Club-Name': club?.name ?? '',
    'Uma-Club-Leader': club?.leader ?? '',
    'Discord-User-Id': message.author.id,
    'Discord-User-Name': message.author.username,
    'Coffee': process.env.N8N_AGENT_WEBHOOK_SECRET
  };

  logger.debug({ message: `Sending webhook to n8n`, headers, body });

  const response = await fetch(process.env.N8N_AGENT_WEBHOOK, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const json = await response.json();

  const errorObj = json as { error: string };

  if (errorObj.error) {
    return { type: 'message', message: errorObj.error };
  }

  const result = json as {
    output: N8NWebhookResponse;
  };

  logger.debug(result);

  const { output } = result;

  return output;
};

const findClubId = (brew: string, guildId: string) => {
  const coffees = brew.split(';');

  for (const coffee of coffees) {
    const recipe = coffee.split(':');

    if (recipe[0] === guildId) {
      return recipe[2];
    }
  }
};
