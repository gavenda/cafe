import {
  APIMessageTopLevelComponent,
  APIUser,
  ButtonStyle,
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

const BOGUSUME_RANK = `BOGUSUME_RANK`;
const BOGUSUME_LAST_RANK = `BOGUSUME_LAST_RANK`;
const BOGUSUME_FANS = `BOGUSUME_FANS`;
const BOGUSUME_LAST_FANS = `BOGUSUME_LAST_FANS`;

const UMA_MOE_CLUB_API_URL = `https://uma.moe/api/v4/circles?circle_id=499459372`;
const UMA_MOE_CLUB_URL = `https://uma.moe/circles/499459372`;

interface DailyFan {
  year: number;
  month: number;
  day: number;
  member_id: number;
  member_name: string;
  fans: number;
  total_fans: number;
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
  const circleResult = await fetch(UMA_MOE_CLUB_API_URL);
  const circleResponseJson = await circleResult.json();
  const circleResponse = circleResponseJson as CircleResponse;
  const lastUpdated = new Date(circleResponse.circle.last_updated);
  const year = lastUpdated.getUTCFullYear();
  const month = lastUpdated.getUTCMonth();
  const day = lastUpdated.getUTCDate();

  // Store to KV
  await env.KV.put(BOGUSUME_RANK, circleResponse.circle.monthly_rank.toString());
  await env.KV.put(BOGUSUME_FANS, circleResponse.circle.monthly_point.toString());
  await env.KV.put(BOGUSUME_LAST_RANK, circleResponse.circle.yesterday_rank.toString());
  await env.KV.put(BOGUSUME_LAST_FANS, circleResponse.circle.yesterday_points.toString());

  // Create a map of daily fan count and sort
  const dailyFans: Omit<DailyFan, 'total_fans'>[] = circleResponse.members
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

  console.log(`✅ Fetched data from uma moe`);

  return dailyFans;
};

const dailyFansFromDb = async (env: Env, year: number, month: number, yesterday: number, day: number) => {
  const dailyFanStatement = env.D1.prepare(
    `SELECT id, year, month, day, member_id, member_name, fans AS total_fans, fans - LAG(fans, 1, 0) OVER(ORDER BY member_name) AS fans FROM daily_fan WHERE year = ? AND month = ? OR day = ? OR day = ? ORDER BY member_name`
  );

  const dailyFanResult = await dailyFanStatement.bind(year, month, yesterday, day).all<DailyFan>();

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
    yesterday.getUTCDate(),
    today.getUTCDate()
  );

  if (dailyFans.length <= 0) {
    console.log(`✅ Detected no data for today`);

    await fetchFromUmaMoe(env);

    dailyFans = await dailyFansFromDb(
      env,
      today.getUTCFullYear(),
      today.getUTCMonth(),
      yesterday.getUTCDate(),
      today.getUTCDate()
    );
  }

  // Send a message
  const components: APIMessageTopLevelComponent[] = await dailyFanComponents(
    env,
    today,
    yesterday,
    dailyFans.filter((dailyFan) => dailyFan.day === today.getUTCDate()).sort((a, b) => b.fans - a.fans)
  );
  await sendMessage(env, webhookId, webhookToken, components);

  console.log(`✅ Operation Succeeded!`);
};

const dailyFanComponents = async (
  env: Env,
  today: Date,
  yesterday: Date,
  dailyFans: DailyFan[]
): Promise<APIMessageTopLevelComponent[]> => {
  const dailyFanStr = [];
  const fansFormat = new Intl.NumberFormat('en-US', { notation: 'compact' });

  const rank = await env.KV.get<number>(BOGUSUME_RANK);
  const fans = await env.KV.get<number>(BOGUSUME_FANS);
  const lastRank = await env.KV.get<number>(BOGUSUME_LAST_RANK);
  const lastFans = await env.KV.get<number>(BOGUSUME_LAST_FANS);

  if (!rank) return [];
  if (!fans) return [];
  if (!lastRank) return [];
  if (!lastFans) return [];

  const fansDiff = fans - lastFans;
  const rankDiff = rank - lastRank;

  let dailyRank = 1;

  for (const dailyFan of dailyFans) {
    const fanStr = new Intl.NumberFormat('en-US').format(dailyFan.fans);

    if (dailyFan.fans > 0) dailyFanStr.push(`${dailyRank++}. ${dailyFan.member_name} \`+${fanStr}\``);
  }

  const noTimeToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const noTimeYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  return [
    {
      type: ComponentType.Container,
      components: [
        {
          type: ComponentType.MediaGallery,
          items: [
            {
              media: {
                url: `https://images2.alphacoders.com/118/thumb-1920-1184687.jpg`
              }
            }
          ]
        },
        {
          type: ComponentType.Section,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: `## Bogusume E Daily Fan Count`
            },
            {
              type: ComponentType.TextDisplay,
              content: `-# Period of <t:${Math.floor(noTimeYesterday.getTime() / 1000)}:R> - <t:${Math.floor(noTimeToday.getTime() / 1000)}:R>`
            }
          ],
          accessory: {
            label: 'View Chart',
            type: ComponentType.Button,
            style: ButtonStyle.Link,
            url: UMA_MOE_CLUB_URL
          }
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: `🏆 Rank #${rank} (+${rankDiff})`,
              disabled: true,
              custom_id: `cafe:rank`
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: `💕 Fans ${fansFormat.format(fans)} (+${fansFormat.format(fansDiff)})`,
              disabled: true,
              custom_id: `cafe:points`
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Link,
              label: `🔥 Pokey's Umamusume Guide`,
              url: `https://docs.google.com/spreadsheets/d/1kat8RUx0GQ-oMtYshruxzFsnQyoqbGT8`
            }
          ]
        },
        {
          type: ComponentType.TextDisplay,
          content: dailyFanStr.join('\n')
        }
      ]
    }
  ];
};
