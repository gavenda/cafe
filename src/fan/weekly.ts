import { APIMessageTopLevelComponent, ButtonStyle, ComponentType } from 'discord-api-types/v10';
import { DailyFan } from './daily-fan';
import { UMA_MOE_CLUB_URL } from './daily-fan.constants';

export const weeklyFanComponents = (options: {
  today: Date;
  lastWeek: Date;
  dailyFans: DailyFan[];
}): APIMessageTopLevelComponent[] => {
  const { today, lastWeek, dailyFans } = options;

  const dailyFanStr = [];
  // const fansFormat = new Intl.NumberFormat('en-US', { notation: 'compact' });

  let dailyRank = 1;

  for (const dailyFan of dailyFans) {
    const fanStr = new Intl.NumberFormat('en-US').format(dailyFan.fans_diff);

    if (dailyFan.fans_diff > 0) dailyFanStr.push(`${dailyRank++}. ${dailyFan.member_name} \`+${fanStr}\``);
  }

  const noTimeToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const noTimeLastWeek = new Date(lastWeek.getFullYear(), lastWeek.getMonth(), lastWeek.getDate());

  return [
    {
      type: ComponentType.Container,
      components: [
        {
          type: ComponentType.MediaGallery,
          items: [
            {
              media: {
                url: `https://w0.peakpx.com/wallpaper/221/943/HD-wallpaper-anime-long-hair-uma-musume-pretty-derby-manhattan-cafe.jpg`
              }
            }
          ]
        },
        {
          type: ComponentType.Section,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: `## Bogusume E Weekly Fan Count`
            },
            {
              type: ComponentType.TextDisplay,
              content: `-# Period of <t:${Math.floor(noTimeLastWeek.getTime() / 1000)}:R> - <t:${Math.floor(noTimeToday.getTime() / 1000)}:R>`
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
