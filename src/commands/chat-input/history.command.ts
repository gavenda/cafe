import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandStringOption,
  type APIMessageTopLevelComponent
} from 'discord.js';
import type { AppChatInputCommand } from './chat-input-command';
import type { AppContext } from 'cafe/context';
import type { DailyFan } from 'cafe/fan/daily-fan';
import { UMA_MOE_CLUB_URL } from 'cafe/fan/daily-fan.constants';

export const history: AppChatInputCommand = {
  // prettier-ignore
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Looks up the fan history of a club member.')
    .addStringOption(
         new SlashCommandStringOption()
        .setName('name')
        .setDescription('Name of the member.')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .toJSON(),
  execute: async (context, interaction) => {
    const { database } = context;
    const name = interaction.options.getString('name') ?? '';
    const today = new Date();

    const dailyFans = database
      .prepare<
        DailyFan,
        [number, number, string]
      >(`SELECT * FROM daily_fan WHERE year = ? AND month = ? AND member_name = ? ORDER BY fans DESC`)
      .all(today.getUTCFullYear(), today.getUTCMonth(), name);

    const dailyFanFirst = dailyFans[0];

    if (dailyFans.length === 0 || !dailyFanFirst) {
      await interaction.reply({
        content: 'Unable to fetch fan history.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const dailyFanStr: string[] = [];
    const fansFormat = new Intl.NumberFormat('en-US');
    const fans = new Intl.NumberFormat('en-US', { notation: 'compact' }).format(dailyFanFirst.fans);
    const rank = await findMemberRank({ context, name });
    dailyFans
      .sort((a, b) => a.day - b.day)
      .forEach((dailyFan) => {
        if (dailyFan.fans > 0) {
          dailyFanStr.push(`- Day ${dailyFan.day} - \`${fansFormat.format(dailyFan.fans)}\``);
        } else {
          dailyFanStr.push(`- Day ${dailyFan.day} - ☕`);
        }
      });
    const historyComponents: APIMessageTopLevelComponent[] = [
      {
        type: ComponentType.Container,
        components: [
          {
            type: ComponentType.MediaGallery,
            items: [
              {
                media: {
                  url: `https://w.wallhaven.cc/full/rd/wallhaven-rdx5om.png`
                }
              }
            ]
          },
          {
            type: ComponentType.Section,
            components: [
              {
                type: ComponentType.TextDisplay,
                content: `## ${name}`
              },
              {
                type: ComponentType.TextDisplay,
                content: `-# Fan History`
              },
              {
                type: ComponentType.TextDisplay,
                content: `-# Month of ${today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
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
                label: `🏆 Club Fan Rank #${rank} of 30`,
                disabled: true,
                custom_id: `cafe:rank`
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: `💕 Fans ${fans}`,
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
            content: `-# Breakdown\n` + dailyFanStr.join('\n')
          }
        ]
      }
    ];

    await interaction.reply({
      components: historyComponents,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications
    });
  },
  autocomplete: async (context, interaction) => {
    const { database } = context;
    const search = interaction.options.getFocused();

    const results = database
      .query<{ member_name: string }, string>(`SELECT DISTINCT member_name FROM daily_fan WHERE member_name LIKE ?`)
      .all(`%${search}%`);

    await interaction.respond(
      results.map((member) => {
        return {
          name: member.member_name,
          value: member.member_name
        };
      })
    );
  }
};

class MemberRankRow {
  member_name!: string;
  rank!: number;
}

export const findMemberRank = async (options: { context: AppContext; name: string }) => {
  const { context, name } = options;
  const { database } = context;

  const rankings = database
    .query(
      `SELECT member_name, RANK() OVER (ORDER BY fans DESC) AS rank FROM daily_fan WHERE day = (SELECT MAX(day) FROM daily_fan WHERE fans <> 0) GROUP BY member_name ORDER BY rank`
    )
    .as(MemberRankRow)
    .all();

  const ranking = rankings.find((ranking) => ranking.member_name === name);

  if (!ranking) return -1;

  return ranking.rank;
};
