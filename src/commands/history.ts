import {
  APIApplicationCommandOptionChoice,
  APIMessageTopLevelComponent,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from 'discord-api-types/v10';
import { ApplicationCommandAutocompleteContext } from '../application-command-autocomplete.context';
import { ChatInputApplicationCommandContext } from '../chat-input-application-command.context';
import { DailyFan } from '../fan/daily-fan';
import { UMA_MOE_CLUB_URL } from '../fan/daily-fan.constants';
import { ApplicationChatInputCommandHandler } from './command';

export const history: ApplicationChatInputCommandHandler = {
  async handle(context) {
    const name = context.getRequiredString('name');
    const today = new Date();
    const statement = context.env.D1.prepare(
      `SELECT * FROM daily_fan WHERE year = ? AND month = ? AND member_name = ? ORDER BY fans DESC`
    );

    const result = await statement.bind(today.getUTCFullYear(), today.getUTCMonth(), name).all<DailyFan>();

    if (!result.success) {
      await context.reply({
        content: 'Unable to fetch fan history.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const dailyFans = result.results;
    const dailyFanStr: string[] = [];
    const fansFormat = new Intl.NumberFormat('en-US');
    const fans = dailyFans[0].fans;
    const rank = await findMemberRank(context, name);

    dailyFans
      .sort((a, b) => a.day - b.day)
      .forEach((dailyFan) => {
        dailyFanStr.push(`- Day ${dailyFan.day} - \`${fansFormat.format(dailyFan.fans)}\``);
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
                label: `🏆 Rank #${rank}`,
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

    await context.reply({
      components: historyComponents,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications
    });
  },
  async handleAutocomplete(context) {
    return handleMemberSearch(context);
  }
};

export const handleMemberSearch = async (
  context: ApplicationCommandAutocompleteContext
): Promise<APIApplicationCommandOptionChoice[]> => {
  const search = context.getRequiredString(`name`);

  const statement = context.env.D1.prepare(`SELECT DISTINCT member_name FROM daily_fan WHERE member_name LIKE ?`);

  const result = await statement.bind(`%${search}%`).all<{ member_name: string }>();

  if (!result.success) {
    return [];
  }

  return result.results.map((member) => {
    return {
      name: member.member_name,
      value: member.member_name
    };
  });
};

export const findMemberRank = async (context: ChatInputApplicationCommandContext, name: string) => {
  const statement = await context.env.D1.prepare(
    `SELECT member_name, RANK() OVER (ORDER BY fans DESC) AS rank FROM daily_fan GROUP BY member_name ORDER BY rank`
  ).all<{ member_name: string; rank: number }>();

  if (!statement.success) return -1;

  const rankings = statement.results;
  const ranking = rankings.find((ranking) => ranking.member_name === name);

  if (!ranking) return -1;

  return ranking.rank;
};
