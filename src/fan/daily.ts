import {
  type APIComponentInMessageActionRow,
  type APIMessageTopLevelComponent,
  ButtonStyle,
  ComponentType
} from 'discord-api-types/v10';
import type { ClubHistory } from './club-history';
import type { DailyFan } from './daily-fan';
import { UMA_MOE_CLUB_URL } from './daily-fan.constants';

export const dailyFanComponents = (options: {
  today: Date;
  yesterday: Date;
  circleName: string;
  circleId: number;
  dailyFans: DailyFan[];
  clubHistory: ClubHistory | undefined;
}): APIMessageTopLevelComponent[] => {
  const { today, yesterday, circleId, circleName, dailyFans, clubHistory } = options;

  const dailyFanStr = [];
  const fansFormat = new Intl.NumberFormat('en-US', { notation: 'compact' });

  let dailyRank = 1;

  for (const dailyFan of dailyFans) {
    const fanStr = new Intl.NumberFormat('en-US').format(dailyFan.fans_diff);

    if (dailyFan.fans_diff > 0) dailyFanStr.push(`${dailyRank++}. ${dailyFan.member_name} \`+${fanStr}\``);
  }

  const noTimeToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // const noTimeYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  let clubHistoryComponents: APIComponentInMessageActionRow[] = [];

  if (clubHistory) {
    const rankSymbol = clubHistory.rank_diff > 0 ? `-` : `+`;

    clubHistoryComponents = [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: `🏆 Rank #${clubHistory.rank} (${rankSymbol}${Math.abs(clubHistory.rank_diff)})`,
        disabled: true,
        custom_id: `cafe:rank`
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: `💕 Fans ${fansFormat.format(clubHistory.fans)} (+${fansFormat.format(clubHistory.fans_diff)})`,
        disabled: true,
        custom_id: `cafe:points`
      }
    ];
  } else {
    clubHistoryComponents = [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: `🏆 Rank (N/A)`,
        disabled: true,
        custom_id: `cafe:rank`
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: `💕 Fans (N/A)`,
        disabled: true,
        custom_id: `cafe:points`
      }
    ];
  }

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
              content: `## ${circleName}`
            },
            {
              type: ComponentType.TextDisplay,
              content: `-# As of <t:${Math.floor(noTimeToday.getTime() / 1000)}:R>`
            }
          ],
          accessory: {
            label: 'View Chart',
            type: ComponentType.Button,
            style: ButtonStyle.Link,
            url: UMA_MOE_CLUB_URL + circleId
          }
        },
        {
          type: ComponentType.ActionRow,
          components: [
            ...clubHistoryComponents,
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
          content:
            dailyFanStr.length > 0
              ? dailyFanStr.join('\n')
              : 'Cafe is away making delicious coffee ☕\n\n-# On a serious note, there is no new fan data from uma.moe'
        }
      ]
    }
  ];
};
