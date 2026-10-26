import { leaderboardComponents } from 'cafe/leaderboard/components';
import { computeStandings, latestSnapshotDay, type Period } from 'cafe/leaderboard/standings';
import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { AppChatInputCommand } from './chat-input-command';

export const standings: AppChatInputCommand = {
  // prettier-ignore
  data: new SlashCommandBuilder()
    .setName('standings')
    .setDescription('Shows the current fan leaderboard.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) => option
      .setName('period')
      .setDescription('Daily or weekly gains.')
      .addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' }))
    .toJSON(),
  execute: async (context, interaction) => {
    if (!interaction.guildId) return;

    const period = (interaction.options.getString('period') ?? 'daily') as Period;
    const day = await latestSnapshotDay(context.redis);
    const result = await computeStandings(context.redis, interaction.guildId, period, day);

    await interaction.reply({
      components: leaderboardComponents(result),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
};
