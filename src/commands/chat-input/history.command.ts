import { GUIDE_URL } from 'cafe/leaderboard/components';
import { dayToUnix, shiftDay } from 'cafe/leaderboard/day';
import { computeStandings, latestSnapshotDay } from 'cafe/leaderboard/standings';
import { getTrainers } from 'cafe/leaderboard/trainers';
import { keys } from 'cafe/redis';
import {
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type APIMessageTopLevelComponent
} from 'discord.js';
import type { AppChatInputCommand } from './chat-input-command';
import { autocompleteTrainer } from './trainer-autocomplete';

const HISTORY_DAYS = 14;

const numberFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact' });

export const history: AppChatInputCommand = {
  // prettier-ignore
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Shows the daily fan gains of a trainer on the leaderboard.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) => option
      .setName('trainer')
      .setDescription('Trainer to look up.')
      .setAutocomplete(true)
      .setRequired(true))
    .toJSON(),
  execute: async (context, interaction) => {
    const { redis } = context;
    const guildId = interaction.guildId;
    const trainerId = interaction.options.getString('trainer', true);

    if (!guildId || !(await redis.sismember(keys.guildTrainers(guildId), trainerId))) {
      await interaction.reply({
        content: 'That trainer is not on this server’s leaderboard.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const day = await latestSnapshotDay(redis);
    // One extra day so the oldest shown day has a baseline.
    const days = Array.from({ length: HISTORY_DAYS + 1 }, (_, index) => shiftDay(day, index - HISTORY_DAYS));

    const [totals, trainers, daily] = await Promise.all([
      Promise.all(days.map((snapshotDay) => redis.zscore(keys.fans(snapshotDay), trainerId))),
      getTrainers(redis, [trainerId]),
      computeStandings(redis, guildId, 'daily', day)
    ]);

    const trainer = trainers.get(trainerId)!;
    const rank = daily.ranked.find((standing) => standing.id === trainerId)?.rank;

    const lines: string[] = [];
    for (let index = days.length - 1; index > 0; index--) {
      const current = totals[index];
      const previous = totals[index - 1];
      const label = `<t:${dayToUnix(days[index]!)}:D>`;

      if (current == null || previous == null) {
        lines.push(`- ${label} · no data`);
      } else if (current > previous) {
        lines.push(`- ${label} \`+${numberFormat.format(current - previous)}\``);
      } else {
        lines.push(`- ${label} ☕`);
      }
    }

    const components: APIMessageTopLevelComponent[] = [
      {
        type: ComponentType.Container,
        components: [
          {
            type: ComponentType.MediaGallery,
            items: [{ media: { url: 'https://w.wallhaven.cc/full/rd/wallhaven-rdx5om.png' } }]
          },
          {
            type: ComponentType.TextDisplay,
            content: `## ${trainer.name}\n-# ${trainer.circleName ?? 'No club'} · Last ${HISTORY_DAYS} days`
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: rank ? `🏆 Daily rank #${rank}` : '🏆 Daily rank (N/A)',
                disabled: true,
                custom_id: 'cafe:rank'
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: `💕 ${trainer.fans === null ? 'N/A' : compactFormat.format(trainer.fans)} fans`,
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
            content: `-# Breakdown\n${lines.join('\n')}`
          }
        ]
      }
    ];

    await interaction.reply({
      components,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications
    });
  },
  autocomplete: autocompleteTrainer
};
