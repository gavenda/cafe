import { DailyFan } from './daily-fan';

const weeklyFansFromDb = async (options: { env: Env }) => {
  const { env } = options;

  const lastWeek = new Date();

  const todayUnix = new Date(2026, 0, 5).getTime() / 1000;

  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);

  const noTimeLastWeek = new Date(2025, 11, 29);

  const lastWeekUnix = noTimeLastWeek.getTime() / 1000;

  const statement = env.D1.prepare(
    `SELECT id, year, month, day, member_id, member_name, fans, fans - LAG(fans, 6, 0) OVER(ORDER BY member_name) AS fans_diff FROM daily_fan WHERE unix_date >= ? AND unix_date <= ? ORDER BY member_name`
  );

  console.log(lastWeekUnix, todayUnix);

  const result = await statement.bind(lastWeekUnix, todayUnix).all<DailyFan>();

  if (result.success) {
    return result.results;
  }

  return [];
};

export const weeklyFan = async (options: { env: Env }) => {
  const { env } = options;

  if (!env.DISCORD_TOKEN) return;
  if (!env.DISCORD_WEEKLY_TEXT_CHANNEL) return;

  // const webhookIdKv = await env.KV.get(BOGUSUME_WEEKLY_WEBHOOK_ID);
  // const webhookTokenKv = await env.KV.get(BOGUSUME_WEEKLY_WEBHOOK_TOKEN);
  // const lastMessageId = await env.KV.get(BOGUSUME_WEEKLY_LAST_MESSAGE_ID);

  // let webhookId = webhookIdKv ?? '';
  // let webhookToken = webhookTokenKv ?? '';

  // if (isBlank(webhookId) || isBlank(webhookToken)) {
  //   console.log(`ℹ️  No webhook found, attemping to create webhook...`);
  //   const webhook = await webhookCreate({
  //     env,
  //     textChannelId: env.DISCORD_WEEKLY_TEXT_CHANNEL
  //   });

  //   if (webhook) {
  //     const [id, token] = webhook;

  //     await env.KV.put(BOGUSUME_WEEKLY_WEBHOOK_ID, id);
  //     await env.KV.put(BOGUSUME_WEEKLY_WEBHOOK_TOKEN, token);

  //     console.log(`✅ Created webhook in ${env.DISCORD_WEEKLY_TEXT_CHANNEL} with id ${id}`);

  //     webhookId = id;
  //     webhookToken = token;
  //   } else {
  //     return;
  //   }
  // }

  // // Perform db calculations
  // const dailyFans: DailyFan[] = await weeklyFansFromDb({
  //   env
  // });

  // const lastWeek = new Date();
  // const today = new Date();

  // lastWeek.setDate(today.getUTCDate() - 7);

  // // Send a message
  // const components: APIMessageTopLevelComponent[] = weeklyFanComponents({
  //   today,
  //   lastWeek,
  //   dailyFans: dailyFans
  //     .filter((dailyFan) => dailyFan.day === today.getUTCDate())
  //     .filter((dailyFan) => dailyFan.fans !== dailyFan.fans_diff)
  //     .sort((a, b) => b.fans_diff - a.fans_diff)
  // });

  // const message = await webhookSendMessage({
  //   env,
  //   webhookId,
  //   webhookToken,
  //   body: {
  //     flags: MessageFlags.IsComponentsV2,
  //     components
  //   }
  // });

  // // Store new message id
  // await env.KV.put(BOGUSUME_WEEKLY_LAST_MESSAGE_ID, message.id);

  // // Perform deletion of previous message
  // if (lastMessageId) {
  //   await webhookDeleteMessage({ env, webhookId, webhookToken, messageId: lastMessageId });
  // }

  // console.log(`✅ Sent message via webhook!`);

  // console.log(`✅ Operation succeeded!`);
};
