import { APIMessageTopLevelComponent, MessageFlags } from 'discord-api-types/v10';
import { CircleResponse } from '../circle';
import { isBlank } from '../utils/strings';
import { webhookCreate, webhookDeleteMessage, webhookSendMessage } from '../webhook';
import { ClubHistory } from './club-history';
import { dailyFanComponents } from './daily';
import {
  BOGUSUME_DAILY_LAST_MESSAGE_ID,
  BOGUSUME_DAILY_WEBHOOK_ID,
  BOGUSUME_DAILY_WEBHOOK_TOKEN,
  UMA_MOE_CLUB_API_URL
} from './daily-fan.constants';

export interface DailyFan {
  year: number;
  month: number;
  day: number;
  member_id: number;
  member_name: string;
  fans_diff: number;
  fans: number;
  created: string;
}

export type ApiDailyFan = Omit<DailyFan, 'fans_diff'>;

const fetchFromUmaMoe = async (options: { env: Env }): Promise<CircleResponse> => {
  const { env } = options;
  const circleResult = await fetch(UMA_MOE_CLUB_API_URL);
  const circleResponseJson = await circleResult.json();
  const circleResponse = circleResponseJson as CircleResponse;
  const lastUpdated = new Date(circleResponse.circle.last_updated);
  const yesterdayUpdated = new Date(circleResponse.circle.yesterday_updated);
  const year = lastUpdated.getUTCFullYear();
  const month = lastUpdated.getUTCMonth();
  const day = lastUpdated.getUTCDate();

  // Club history
  const clubHistory = [
    {
      year,
      month,
      day,
      rank: circleResponse.circle.monthly_rank,
      fans: circleResponse.circle.monthly_point,
      created: circleResponse.circle.last_updated
    },
    {
      year: yesterdayUpdated.getUTCFullYear(),
      month: yesterdayUpdated.getUTCMonth(),
      day: yesterdayUpdated.getUTCDate(),
      rank: circleResponse.circle.yesterday_rank,
      fans: circleResponse.circle.yesterday_points,
      created: circleResponse.circle.yesterday_updated
    }
  ];

  const clubHistoryBatch = clubHistory.map((history) =>
    env.D1.prepare(
      `INSERT OR IGNORE INTO club_history (year, month, day, rank, fans, created) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(history.year, history.month, history.day, history.rank, history.fans, history.created)
  );

  // Create a map of daily fan count and sort
  const dailyFans: ApiDailyFan[] = circleResponse.members
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
  const dailyFansBatch = dailyFans.map((dailyFan) =>
    env.D1.prepare(
      `INSERT OR IGNORE INTO daily_fan (year, month, day, member_id, member_name, fans, created) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      dailyFan.year,
      dailyFan.month,
      dailyFan.day,
      dailyFan.member_id,
      dailyFan.member_name,
      dailyFan.fans,
      dailyFan.created
    )
  );

  await env.D1.batch(clubHistoryBatch);
  await env.D1.batch(dailyFansBatch);

  return circleResponse;
};

const clubHistoryFromDb = async (options: {
  env: Env;
  year: number;
  month: number;
  yesterday: number;
  day: number;
}) => {
  const { env, year, month, yesterday, day } = options;

  const statement = env.D1.prepare(
    `SELECT id, year, month, day, rank, rank - LAG(rank, 1, 0) OVER(ORDER BY day) AS rank_diff, fans, fans - LAG(fans, 1, 0) OVER(ORDER BY day) AS fans_diff FROM club_history WHERE year = ? AND month = ? AND day IN (?, ?) ORDER BY day`
  );

  console.log(year, month, yesterday, day);

  const result = await statement.bind(year, month, yesterday, day).all<ClubHistory>();

  if (result.success) {
    console.log(result.results);
    return result.results[1];
  }

  throw new Error(`Unable to fetch club history!`);
};

const dailyFansFromDb = async (options: { env: Env; year: number; month: number; yesterday: number; day: number }) => {
  const { env, year, month, yesterday, day } = options;
  const statement = env.D1.prepare(
    `SELECT id, year, month, day, member_id, member_name, fans, fans - LAG(fans, 1, 0) OVER(ORDER BY member_name) AS fans_diff FROM daily_fan WHERE year = ? AND month = ? AND day IN (?, ?) ORDER BY member_name`
  );

  const result = await statement.bind(year, month, yesterday, day).all<DailyFan>();

  if (result.success) {
    return result.results;
  }

  return [];
};

export const dailyFan = async (options: { env: Env }) => {
  const { env } = options;

  if (!env.DISCORD_TOKEN) return;
  if (!env.DISCORD_DAILY_TEXT_CHANNEL) return;

  const webhookIdKv = await env.KV.get(BOGUSUME_DAILY_WEBHOOK_ID);
  const webhookTokenKv = await env.KV.get(BOGUSUME_DAILY_WEBHOOK_TOKEN);
  const lastMessageId = await env.KV.get(BOGUSUME_DAILY_LAST_MESSAGE_ID);

  let webhookId = webhookIdKv ?? '';
  let webhookToken = webhookTokenKv ?? '';

  if (isBlank(webhookId) || isBlank(webhookToken)) {
    console.log(`ℹ️  No webhook found, attemping to create webhook...`);
    const webhook = await webhookCreate({
      env,
      textChannelId: env.DISCORD_DAILY_TEXT_CHANNEL
    });

    if (webhook) {
      const [id, token] = webhook;

      await env.KV.put(BOGUSUME_DAILY_WEBHOOK_ID, id);
      await env.KV.put(BOGUSUME_DAILY_WEBHOOK_TOKEN, token);

      console.log(`✅ Created webhook in ${env.DISCORD_DAILY_TEXT_CHANNEL} with id ${id}`);

      webhookId = id;
      webhookToken = token;
    } else {
      return;
    }
  }

  console.log(`✅ Using webhook id ${webhookId}`);

  // Perform fan check
  const circleResponse = await fetchFromUmaMoe({ env });

  const today = new Date(circleResponse.circle.last_updated);
  const yesterday = new Date(circleResponse.circle.yesterday_updated);

  console.log(`✅ Fetched data from uma.moe`);

  // Perform db calculations
  const dailyFans: DailyFan[] = await dailyFansFromDb({
    env,
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
    yesterday: yesterday.getUTCDate(),
    day: today.getUTCDate()
  });

  const clubHistory = await clubHistoryFromDb({
    env,
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
    yesterday: yesterday.getUTCDate(),
    day: today.getUTCDate()
  });

  // Send a message
  const components: APIMessageTopLevelComponent[] = dailyFanComponents({
    today,
    yesterday,
    dailyFans: dailyFans
      .filter((dailyFan) => dailyFan.day === today.getUTCDate())
      .sort((a, b) => b.fans_diff - a.fans_diff),
    clubHistory
  });

  const message = await webhookSendMessage({
    env,
    webhookId,
    webhookToken,
    body: {
      flags: MessageFlags.IsComponentsV2,
      components
    }
  });

  // Store new message id
  await env.KV.put(BOGUSUME_DAILY_LAST_MESSAGE_ID, message.id);

  // Perform deletion of previous message
  if (lastMessageId) {
    await webhookDeleteMessage({ env, webhookId, webhookToken, messageId: lastMessageId });
  }

  console.log(`✅ Sent message via webhook!`);

  console.log(`✅ Operation succeeded!`);
};
