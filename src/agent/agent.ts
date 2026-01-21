import { getLogger } from '@logtape/logtape';
import type { N8NWebhookResponse } from './n8n-webhook-response';
import type { Message, OmitPartialGroupDMChannel } from 'discord.js';
import type { AppContext } from 'cafe/context';

const logger = getLogger(['cafe', 'agent']);

/**
 * Send a prompt to the gpt agent webhook.
 */
export const agentPrompt = async (promptOpts: {
  context: AppContext;
  message: OmitPartialGroupDMChannel<Message<boolean>>;
  prompt: string;
}) => {
  if (!process.env.N8N_AGENT_WEBHOOK) return;
  if (!process.env.N8N_AGENT_WEBHOOK_SECRET) return;

  const { message, prompt } = promptOpts;

  if (!message.guildId) return;

  const body = {
    message: prompt
  };

  const headers = {
    'Content-Type': `application/json`,
    'Uma-Club-Name': '',
    'Discord-User-Id': message.author.id,
    'Discord-User-Name': message.author.username,
    'Authorization': `Bearer ${process.env.N8N_AGENT_WEBHOOK_SECRET}`
  };

  logger.debug({ message: `Sending webhook to n8n`, headers, body });

  const response = await fetch(process.env.N8N_AGENT_WEBHOOK, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const json = await response.json();
  const result = json as {
    output: N8NWebhookResponse;
  };
  const { output } = result;

  return output;
};
