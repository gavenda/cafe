import { APIMessageTopLevelComponent, ButtonStyle, ComponentType } from 'discord-api-types/v10';
import { ClubHistory } from './club-history';
import { DailyFan } from './daily-fan';
import { UMA_MOE_CLUB_URL } from './daily-fan.constants';

export const dailyFanComponents = (options: {
  today: Date;
  yesterday: Date;
  dailyFans: DailyFan[];
  clubHistory: ClubHistory;
}): APIMessageTopLevelComponent[] => {
  const { today, yesterday, dailyFans, clubHistory } = options;

  const dailyFanStr = [];
  const fansFormat = new Intl.NumberFormat('en-US', { notation: 'compact' });

  let dailyRank = 1;

  const rankSymbol = clubHistory.rank_diff > 0 ? `-` : `+`;

  for (const dailyFan of dailyFans) {
    const fanStr = new Intl.NumberFormat('en-US').format(dailyFan.fans_diff);

    if (dailyFan.fans_diff > 0) dailyFanStr.push(`${dailyRank++}. ${dailyFan.member_name} \`+${fanStr}\``);
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
          content: dailyFanStr.length > 0 ? dailyFanStr.join('\n') : 'There is no results for today.'
        }
      ]
    }
  ];
};
