import { ButtonStyle, ComponentType, type APIMessageTopLevelComponent } from 'discord.js';
import { dayToUnix } from './day';
import type { Period, Standings } from './standings';

export const GUIDE_URL = 'https://docs.google.com/spreadsheets/d/1kat8RUx0GQ-oMtYshruxzFsnQyoqbGT8';

const BANNERS: Record<Period, string> = {
  daily: 'https://images2.alphacoders.com/118/thumb-1920-1184687.jpg',
  weekly:
    'https://w0.peakpx.com/wallpaper/221/943/HD-wallpaper-anime-long-hair-uma-musume-pretty-derby-manhattan-cafe.jpg'
};

const TITLES: Record<Period, string> = {
  daily: 'Daily Fan Leaderboard',
  weekly: 'Weekly Fan Leaderboard'
};

const numberFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact' });

export const leaderboardComponents = (standings: Standings): APIMessageTopLevelComponent[] => {
  const { period, day, since, ranked, pending } = standings;

  const gainers = ranked.filter((standing) => standing.gain > 0);
  const resting = ranked.filter((standing) => standing.gain <= 0);
  const totalGain = gainers.reduce((sum, standing) => sum + standing.gain, 0);

  const lines = gainers.map(
    (standing) => `${standing.rank}. ${standing.name} \`+${numberFormat.format(standing.gain)}\``
  );

  if (resting.length > 0) {
    lines.push('', `-# ☕ No gains: ${resting.map((trainer) => trainer.name).join(', ')}`);
  }
  if (pending.length > 0) {
    lines.push('', `-# ⏳ Waiting for data: ${pending.map((trainer) => trainer.name).join(', ')}`);
  }

  const body =
    lines.length > 0
      ? lines.join('\n')
      : 'Cafe is away making delicious coffee ☕\n\n-# No trainers are being watched yet. Add some with `/leaderboard add`.';

  return [
    {
      type: ComponentType.Container,
      components: [
        {
          type: ComponentType.MediaGallery,
          items: [{ media: { url: BANNERS[period] } }]
        },
        {
          type: ComponentType.TextDisplay,
          content: `## ${TITLES[period]}\n-# <t:${dayToUnix(since)}:D> → <t:${dayToUnix(day)}:D>`
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: `👥 ${ranked.length + pending.length} trainers`,
              disabled: true,
              custom_id: 'cafe:trainers'
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: `💕 +${compactFormat.format(totalGain)} fans`,
              disabled: true,
              custom_id: 'cafe:fans'
            },
            {
              type: ComponentType.Button,
              style: ButtonStyle.Link,
              label: `🔥 Pokey's Umamusume Guide`,
              url: GUIDE_URL
            }
          ]
        },
        {
          type: ComponentType.TextDisplay,
          content: body
        }
      ]
    }
  ];
};
