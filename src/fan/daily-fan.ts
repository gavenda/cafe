import { getLogger } from '@logtape/logtape';
import type { AppContext } from 'cafe/context';
import { MessageFlags, type APIMessageTopLevelComponent } from 'discord.js';
import type { CircleResponse } from '../circle';
import type { ClubHistory } from './club-history';
import { dailyFanComponents } from './daily';
import { UMA_MOE_CLUB_API_URL } from './daily-fan.constants';

export interface DailyFan {
  year: number;
  month: number;
  day: number;
  club_id: number;
  member_id: number;
  member_name: string;
  fans_diff: number;
  fans: number;
  created: string;
}

export type ApiDailyFan = Omit<DailyFan, 'fans_diff'>;

const fetchFromUmaMoe = async (options: { context: AppContext; circleId: number }): Promise<CircleResponse> => {
  const logger = getLogger(['cafe', 'daily-fan']);
  const { context, circleId } = options;
  const { database } = context;
  const circleResult = await fetch(UMA_MOE_CLUB_API_URL + circleId);
  const circleResponseJson = await circleResult.json();
  const circleResponse = circleResponseJson as CircleResponse;
  const { circle } = circleResponse;
  const lastUpdated = new Date(circle.last_updated);
  const yesterdayUpdated = new Date(circle.yesterday_updated);

  // Club history
  const clubHistory = [
    {
      year: lastUpdated.getUTCFullYear(),
      month: lastUpdated.getUTCMonth(),
      day: lastUpdated.getUTCDate(),
      club_id: circle.circle_id,
      rank: circle.monthly_rank,
      fans: circle.monthly_point,
      created: circle.last_updated
    },
    {
      year: yesterdayUpdated.getUTCFullYear(),
      month: yesterdayUpdated.getUTCMonth(),
      day: yesterdayUpdated.getUTCDate(),
      club_id: circle.circle_id,
      rank: circle.yesterday_rank,
      fans: circle.yesterday_points,
      created: circle.yesterday_updated
    }
  ];

  logger.info({ message: 'Inserting club information into database...', circleId });

  database
    .prepare(
      `INSERT INTO club (id, name, leader) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, leader = excluded.leader`
    )
    .run(circle.circle_id, circle.name, circle.leader_name);

  logger.info({ message: 'Inserting club history into database...', circleId });

  clubHistory.forEach((history) => {
    database
      .prepare(
        `INSERT OR IGNORE INTO club_history (year, month, day, club_id, rank, fans, created) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(history.year, history.month, history.day, circle.circle_id, history.rank, history.fans, history.created);
  });

  // Create a map of daily fan count and sort
  const dailyFansMatrix: ApiDailyFan[][] = circleResponse.members.map((member) => {
    return member.daily_fans
      .map((fans, index) => {
        const lastUpdatedMember = new Date(member.last_updated);
        lastUpdatedMember.setUTCDate(index + 1);

        return {
          year: lastUpdatedMember.getUTCFullYear(),
          month: lastUpdatedMember.getUTCMonth(),
          day: lastUpdatedMember.getUTCDate(),
          club_id: member.circle_id,
          member_id: member.viewer_id,
          member_name: member.trainer_name,
          fans: fans,
          created: member.last_updated
        };
      })
      .filter((member) => new Date(member.created).getUTCDate());
  });

  const dailyFans = dailyFansMatrix.flat();

  logger.info({ message: 'Inserting daily fans into database...', circleId });

  // Prepare batch of insert statements
  dailyFans.forEach((dailyFan) => {
    database
      .prepare(
        `INSERT INTO daily_fan (year, month, day, club_id, member_id, member_name, fans, created, unix_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(year, month, day, member_id) DO UPDATE SET fans = excluded.fans, created = excluded.created`
      )
      .run(
        dailyFan.year,
        dailyFan.month,
        dailyFan.day,
        dailyFan.club_id,
        dailyFan.member_id,
        dailyFan.member_name,
        dailyFan.fans,
        dailyFan.created,
        new Date(dailyFan.year, dailyFan.month, dailyFan.day).getTime()
      );
  });

  return circleResponse;
};

const clubHistoryFromDb = async (options: {
  context: AppContext;
  year: number;
  month: number;
  yesterday: number;
  day: number;
  circleId: number;
}) => {
  const { context, year, month, yesterday, day, circleId } = options;
  const { database } = context;

  const result = database
    .prepare<
      ClubHistory,
      [number, number, number, number, number]
    >(`SELECT id, year, month, day, rank, rank - LAG(rank, 1, 0) OVER(ORDER BY day) AS rank_diff, fans, fans - LAG(fans, 1, 0) OVER(ORDER BY day) AS fans_diff FROM club_history WHERE year = ? AND month = ? AND day IN (?, ?) AND club_id = ? ORDER BY day`)
    .all(year, month, yesterday, day, circleId);

  if (result) {
    if (result[1]) return result[1];
    return undefined;
  }

  throw new Error(`Unable to fetch club history!`);
};

const dailyFansFromDb = async (options: {
  context: AppContext;
  year: number;
  month: number;
  yesterday: number;
  day: number;
  circleId: number;
}) => {
  const { context, year, month, yesterday, day, circleId } = options;
  const { database } = context;

  const result = database
    .prepare<
      DailyFan,
      [number, number, number, number, number]
    >(`SELECT id, year, month, day, club_id, member_id, member_name, fans, fans - LAG(fans, 1, 0) OVER(ORDER BY member_name) AS fans_diff FROM daily_fan WHERE year = ? AND month = ? AND day IN (?, ?) AND club_id = ? ORDER BY member_name`)
    .all(year, month, yesterday, day, circleId);

  if (result) {
    return result;
  }

  return [];
};

export const beginDailyFan = async (options: { context: AppContext }) => {
  if (!process.env.CAFE_BREW) return;

  const brews = process.env.CAFE_BREW.split(';');
  const { context } = options;

  for (const brew of brews) {
    const [guildId, textChannelId, circleId] = brew.split(':');

    if (!guildId) break;
    if (!textChannelId) break;
    if (!circleId) break;

    await dailyFan({ context, guildId, textChannelId, circleId: parseInt(circleId) });
  }
};

export const dailyFan = async (options: {
  context: AppContext;
  guildId: string;
  textChannelId: string;
  circleId: number;
}) => {
  const { context, guildId, textChannelId, circleId } = options;
  const { database, client } = context;

  if (!process.env.CAFE_BREW) return;

  const logger = getLogger(['cafe', 'daily-fan']);

  logger.info({ message: 'Fetching daily fan count', circleId, guildId, textChannelId });

  // Perform fan check
  const circleResponse = await fetchFromUmaMoe({ context, circleId });
  const { circle } = circleResponse;

  const today = new Date(circle.last_updated);
  const yesterday = new Date(circle.yesterday_updated);

  // Perform sanity yesterday check
  if (yesterday.getUTCDate() === today.getUTCDate()) {
    yesterday.setUTCDate(today.getUTCDate() - 1);
  }

  logger.info({ message: 'Fetched data from uma.moe', circleId, guildId, textChannelId });

  // Perform db calculations

  logger.debug({ message: 'Fetching daily fans from db...', circleId, guildId, textChannelId });

  const dailyFans: DailyFan[] = await dailyFansFromDb({
    context,
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
    yesterday: yesterday.getUTCDate(),
    day: today.getUTCDate(),
    circleId: circle.circle_id
  });

  logger.debug({ message: 'Fetching club history from db...', circleId, guildId, textChannelId });

  const clubHistory = await clubHistoryFromDb({
    context,
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
    yesterday: yesterday.getUTCDate(),
    day: today.getUTCDate(),
    circleId: circle.circle_id
  });

  const club = database.query(`SELECT id, name, leader FROM club WHERE id = ?`).get(circleId) as {
    id: number;
    name: string;
    leader: string;
  };

  // Send a message
  const components: APIMessageTopLevelComponent[] = dailyFanComponents({
    today,
    yesterday,
    circleId: club.id,
    circleName: club.name,
    dailyFans: dailyFans
      .filter((dailyFan) => dailyFan.day === today.getUTCDate())
      .filter((dailyFan) => dailyFan.fans !== dailyFan.fans_diff)
      .sort((a, b) => b.fans_diff - a.fans_diff),
    clubHistory
  });

  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(textChannelId);

  // 3. Check if it's a text-based channel and send
  if (channel && channel.isTextBased()) {
    const message = await channel.send({
      components,
      flags: MessageFlags.IsComponentsV2
    });

    logger.debug({ message: 'Message sent', circleId, guildId, textChannelId });

    logger.debug({ message: 'Fetching old message id', circleId, guildId, textChannelId });

    // Fetch old message id
    const discordMessage = database
      .query<{ message_id: string }, string>(`SELECT message_id FROM discord_message WHERE discord_guild_id = ?`)
      .get(guildId);

    if (discordMessage) {
      logger.debug({ message: 'Deleting message', messageId: discordMessage.message_id });
      await channel.messages.delete(discordMessage.message_id);
    }

    logger.debug({ message: 'Storing message id', circleId, guildId, textChannelId });

    // Store new message id
    database
      .prepare(
        `INSERT INTO discord_message (discord_guild_id, discord_text_channel_id, message_id) VALUES (?, ?, ?) ON CONFLICT(discord_guild_id) DO UPDATE SET message_id = excluded.message_id`
      )
      .run(guildId, textChannelId, message.id);

    logger.debug({ message: 'Message sent', circleId, guildId, textChannelId });
  } else {
    logger.error('The provided Channel ID is not a text channel.');
  }
};
