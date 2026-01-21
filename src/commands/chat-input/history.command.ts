import { SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import type { AppChatInputCommand } from './chat-input-command';

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
  execute: async (_context, _) => {}
};
