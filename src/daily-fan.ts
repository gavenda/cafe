import {
  APIMessageTopLevelComponent,
  APIUser,
  CDNRoutes,
  ComponentType,
  ImageFormat,
  MessageFlags,
  RESTGetAPIWebhookResult,
  RESTPostAPIWebhookWithTokenWaitResult,
  RouteBases,
  Routes
} from 'discord-api-types/v10';
import { CircleResponse } from './circle';
import { kvRateLimitedFetch } from './utils/kv-fetch';
import { isBlank } from './utils/strings';

const BOGUSUME_WEBHOOK_ID = `BOGUSUME_WEBHOOK_ID`;
const BOGUSUME_WEBHOOK_TOKEN = `BOGUSUME_WEBHOOK_TOKEN`;
const BOGUSUME_LAST_MESSAGE_ID = `BOGUSUME_LAST_MESSAGE_ID`;
const UMA_MOE_CLUB_URL = `https://uma.moe/api/v4/circles?circle_id=499459372`;

interface DailyFan {
  year: number;
  month: number;
  day: number;
  member_id: number;
  member_name: string;
  fans: number;
  created: string;
}

const createWebhook = async (env: Env): Promise<[string, string] | null> => {
  // Create webhook
  const webhookCreateResponse = await kvRateLimitedFetch(
    RouteBases.api + Routes.channelWebhooks(env.DISCORD_TEXT_CHANNEL),
    env,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cafe/1.0',
        'Authorization': `Bot ${env.DISCORD_TOKEN}`
      },
      body: JSON.stringify({
        name: 'Cafe'
      })
    }
  );

  const webhook = await webhookCreateResponse.json<RESTGetAPIWebhookResult>();

  if (!webhook.token) {
    console.log(`⛔️ Creation of webhook did not return a token!`);
    return null;
  }

  await env.KV.put(BOGUSUME_WEBHOOK_ID, webhook.id);
  await env.KV.put(BOGUSUME_WEBHOOK_TOKEN, webhook.token);

  console.log(`✅ Created webhook in ${env.DISCORD_TEXT_CHANNEL} with id ${webhook.id} and token ${webhook.token}`);

  return [webhook.id, webhook.token];
};

const fetchFromUmaMoe = async (env: Env) => {
  const circleResult = await fetch(UMA_MOE_CLUB_URL);
  const circleResponseJson = await circleResult.json();
  const circleResponse = circleResponseJson as CircleResponse;
  const lastUpdated = new Date(circleResponse.circle.last_updated);
  const year = lastUpdated.getUTCFullYear();
  const month = lastUpdated.getUTCMonth();
  const day = lastUpdated.getUTCDate();

  // Create a map of daily fan count and sort
  const dailyFans: DailyFan[] = circleResponse.members
    .map((member) => {
      return {
        year,
        month,
        day,
        member_id: member.viewer_id,
        member_name: member.trainer_name,
        fans: member.daily_fans[day - 1] ?? 0,
        created: circleResponse.circle.last_updated
      };
    })
    .sort((memberA, memberB) => memberB.fans - memberA.fans);

  // Prepare batch of insert statements
  const dailyFansBatch = dailyFans.map((dailyFan) => {
    return env.D1.prepare(
      `INSERT OR IGNORE INTO daily_fan (year, month, day, member_id, member_name, fans, created) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      dailyFan.year,
      dailyFan.month,
      dailyFan.day,
      dailyFan.member_id,
      dailyFan.member_name,
      dailyFan.fans,
      dailyFan.created
    );
  });

  await env.D1.batch(dailyFansBatch);

  return dailyFans;
};

const dailyFansFromDb = async (env: Env, year: number, month: number, day: number) => {
  console.log(`ℹ️  Retrieving fans from year ${year}, month ${month}, day ${day}...`);

  const dailyFanStatement = env.D1.prepare(`SELECT * FROM daily_fan WHERE year = ? AND month = ? AND day = ?`);

  const dailyFanResult = await dailyFanStatement.bind(year, month, day).all<DailyFan>();

  if (dailyFanResult.success) {
    return dailyFanResult.results;
  }

  return [];
};

const sendMessage = async (
  env: Env,
  webhookId: string,
  webhookToken: string,
  components: APIMessageTopLevelComponent[]
) => {
  // Perform deletion of previous message
  const lastMessageId = await env.KV.get(BOGUSUME_LAST_MESSAGE_ID);

  if (lastMessageId) {
    await kvRateLimitedFetch(RouteBases.api + Routes.webhookMessage(webhookId, webhookToken, lastMessageId), env, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cafe/1.0',
        'Authorization': `Bot ${env.DISCORD_TOKEN}`
      }
    });
    await env.KV.delete(BOGUSUME_LAST_MESSAGE_ID);
  }

  // Grab avatar
  const userResult = await kvRateLimitedFetch(RouteBases.api + Routes.user(), env, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Cafe/1.0',
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
      'User-Agent': 'Cafe/1.0',
      'Authorization': `Bot ${env.DISCORD_TOKEN}`
    },
    body: JSON.stringify({
      components,
      flags: MessageFlags.IsComponentsV2,
      avatar_url: selfAvatarUrl
    })
  });

  const message = await webhookResponse.json<RESTPostAPIWebhookWithTokenWaitResult>();

  await env.KV.put(BOGUSUME_LAST_MESSAGE_ID, message.id);
};

export const dailyFan = async (env: Env) => {
  if (!env.DISCORD_TOKEN) return;
  if (!env.DISCORD_TEXT_CHANNEL) return;

  const webhookIdKv = await env.KV.get(BOGUSUME_WEBHOOK_ID);
  const webhookTokenKv = await env.KV.get(BOGUSUME_WEBHOOK_TOKEN);

  let webhookId = webhookIdKv ?? '';
  let webhookToken = webhookTokenKv ?? '';

  if (isBlank(webhookId) || isBlank(webhookToken)) {
    console.log(`ℹ️  No webhook found, attemping to create webhook...`);
    const webhook = await createWebhook(env);

    if (webhook) {
      const [id, token] = webhook;

      webhookId = id;
      webhookToken = token;
    }
  }

  console.log(`✅ Using webhook id ${webhookId} and token ${webhookToken}`);

  // Perform fan check

  const today = new Date();
  const yesterday = new Date();

  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // Check db first
  let dailyFans: DailyFan[] = await dailyFansFromDb(
    env,
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  let lastDailyFans: DailyFan[] = await dailyFansFromDb(
    env,
    yesterday.getUTCFullYear(),
    yesterday.getUTCMonth(),
    yesterday.getUTCDate()
  );
  const diffFans: DailyFan[] = [];

  if (lastDailyFans.length <= 0) {
    console.log(`✅ Detected no data from yesterday`);
    lastDailyFans = dailyFans;
  }

  if (dailyFans.length <= 0) {
    console.log(`✅ Detected no data for today`);
    dailyFans = await fetchFromUmaMoe(env);
  }

  // Do a diff
  dailyFans = dailyFans.sort((a, b) => a.member_id - b.member_id);
  lastDailyFans = lastDailyFans.sort((a, b) => a.member_id - b.member_id);

  for (const [index, dailyFan] of dailyFans.entries()) {
    const fans = lastDailyFans[index].fans - dailyFans[index].fans;

    if (fans > 0) {
      diffFans.push({
        ...dailyFan,
        fans
      });
    }
  }

  // Send a message
  if (diffFans.length > 0) {
    const components: APIMessageTopLevelComponent[] = dailyFanComponents(today, dailyFans);
    await sendMessage(env, webhookId, webhookToken, components);
  } else {
    const components: APIMessageTopLevelComponent[] = [
      {
        type: ComponentType.TextDisplay,
        content: `-# Bogusume E Daily Fan Count - <t:${Math.floor(today.getTime() / 1000)}:R>`
      },
      {
        type: ComponentType.TextDisplay,
        content: `There is no results for today.`
      }
    ];
    await sendMessage(env, webhookId, webhookToken, components);
  }

  console.log(`✅ Operation Succeeded!`);
};

const dailyFanComponents = (today: Date, dailyFans: DailyFan[]): APIMessageTopLevelComponent[] => {
  const dailyFanStr = [];
  const below100k = [];

  let dailyRank = 1;
  let below100kRank = 1;

  for (const [index, dailyFan] of dailyFans.entries()) {
    const fanStr = new Intl.NumberFormat('en-US').format(dailyFan.fans);

    if (dailyFan.fans > 100000) dailyFanStr.push(`${dailyRank++}. ${dailyFan.member_name} \`+${fanStr}\``);
    else below100k.push(`${below100kRank++}. ${dailyFan.member_name} \`+${fanStr}\``);
  }

  return [
    {
      type: ComponentType.TextDisplay,
      content: `-# Bogusume E Daily Fan Count - <t:${Math.floor(today.getTime() / 1000)}:R>`
    },
    {
      type: ComponentType.TextDisplay,
      content: dailyFanStr.join('\n')
    },
    {
      type: ComponentType.TextDisplay,
      content: `-# Members under 100k\n-# (might include kicked members)`
    },
    {
      type: ComponentType.TextDisplay,
      content: below100k.join('\n')
    }
  ];
};
