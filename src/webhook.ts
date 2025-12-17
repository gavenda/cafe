import {
  APIMessage,
  APIUser,
  CDNRoutes,
  ImageFormat,
  RESTGetAPIWebhookResult,
  RESTPostAPIInteractionFollowupJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
  RESTPostAPIWebhookWithTokenWaitResult,
  RouteBases,
  Routes,
  Snowflake
} from 'discord-api-types/v10';
import { kvRateLimitedFetch } from './utils/kv-fetch';

const WEBHOOK_USER_AGENT = 'Cafe/1.0';

export const webhookCreate = async (options: { env: Env; textChannelId: string }): Promise<[string, string] | null> => {
  const { env, textChannelId } = options;

  // Create webhook
  const webhookCreateResponse = await kvRateLimitedFetch(RouteBases.api + Routes.channelWebhooks(textChannelId), env, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Cafe/1.0',
      'Authorization': `Bot ${env.DISCORD_TOKEN}`
    },
    body: JSON.stringify({
      name: 'Cafe'
    })
  });

  const webhook = await webhookCreateResponse.json<RESTGetAPIWebhookResult>();

  if (!webhook.token) {
    console.log(`⛔️ Creation of webhook did not return a token!`);
    return null;
  }

  return [webhook.id, webhook.token];
};

export const webhookDeleteMessage = async (options: {
  env: Env;
  webhookId: string;
  webhookToken: string;
  messageId: string;
}) => {
  const { env, webhookId, webhookToken, messageId } = options;

  await kvRateLimitedFetch(RouteBases.api + Routes.webhookMessage(webhookId, webhookToken, messageId), env, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WEBHOOK_USER_AGENT,
      'Authorization': `Bot ${env.DISCORD_TOKEN}`
    }
  });
};

export const webhookSendMessage = async (options: {
  env: Env;
  webhookId: string;
  webhookToken: string;
  body: RESTPostAPIWebhookWithTokenJSONBody;
}) => {
  const { env, webhookId, webhookToken, body } = options;

  // Grab avatar
  const userResult = await kvRateLimitedFetch(RouteBases.api + Routes.user(), env, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WEBHOOK_USER_AGENT,
      'Authorization': `Bot ${env.DISCORD_TOKEN}`
    }
  });
  const user = await userResult.json<APIUser>();
  const selfAvatarUrl = RouteBases.cdn + CDNRoutes.userAvatar(user.id, user.avatar!, ImageFormat.WebP);
  const webhookUrl = new URL(RouteBases.api + Routes.webhook(webhookId, webhookToken));

  webhookUrl.searchParams.append('wait', 'true');

  const webhookResponse = await kvRateLimitedFetch(webhookUrl, env, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': WEBHOOK_USER_AGENT,
      'Authorization': `Bot ${env.DISCORD_TOKEN}`
    },
    body: JSON.stringify({
      ...body,
      avatar_url: selfAvatarUrl
    })
  });

  return await webhookResponse.json<RESTPostAPIWebhookWithTokenWaitResult>();
};

export class Webhook {
  token: string;
  env: Env;

  constructor(options: { token: string; env: Env }) {
    this.env = options.env;
    this.token = options.token;
  }

  async followUp(data: RESTPostAPIInteractionFollowupJSONBody): Promise<APIMessage> {
    const body = JSON.stringify(data);

    const result = await kvRateLimitedFetch(
      RouteBases.api + Routes.webhook(this.env.DISCORD_APPLICATION_ID, this.token),
      this.env,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': WEBHOOK_USER_AGENT,
          'Authorization': `Bot ${this.env.DISCORD_TOKEN}`
        },
        body
      }
    );

    return await result.json<APIMessage>();
  }

  async edit(messageId: string, data: RESTPostAPIInteractionFollowupJSONBody): Promise<APIMessage> {
    const body = JSON.stringify(data);

    const result = await kvRateLimitedFetch(
      RouteBases.api + Routes.webhookMessage(this.env.DISCORD_APPLICATION_ID, this.token, messageId),
      this.env,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': WEBHOOK_USER_AGENT,
          'Authorization': `Bot ${this.env.DISCORD_TOKEN}`
        },
        body
      }
    );

    return await result.json<APIMessage>();
  }

  async delete(id: Snowflake): Promise<void> {
    await kvRateLimitedFetch(
      RouteBases.api + Routes.webhookMessage(this.env.DISCORD_APPLICATION_ID, this.token, id),
      this.env,
      {
        headers: {
          'User-Agent': WEBHOOK_USER_AGENT,
          'Authorization': `Bot ${this.env.DISCORD_TOKEN}`
        },
        method: 'DELETE'
      }
    );
  }
}
