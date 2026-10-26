import type { AppContext } from 'cafe/context';
import { getGuildTrainers } from 'cafe/leaderboard/trainers';
import type { AutocompleteInteraction } from 'discord.js';

/** Suggests the guild's watched trainers; the option value is the trainer id. */
export const autocompleteTrainer = async (context: AppContext, interaction: AutocompleteInteraction) => {
  if (!interaction.guildId) {
    await interaction.respond([]);
    return;
  }

  const search = interaction.options.getFocused().toLowerCase();
  const trainers = await getGuildTrainers(context.redis, interaction.guildId);

  await interaction.respond(
    trainers
      .filter((trainer) => trainer.name.toLowerCase().includes(search) || trainer.id.includes(search))
      .slice(0, 25)
      .map((trainer) => ({ name: `${trainer.name} (${trainer.id})`, value: trainer.id }))
  );
};
