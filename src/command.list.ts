import { APIApplicationCommand, ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10';

export const COMMAND_ABOUT: Partial<APIApplicationCommand> = {
  name: 'about',
  type: ApplicationCommandType.ChatInput,
  description: 'Me.'
};

export const COMMAND_HISTORY: Partial<APIApplicationCommand> = {
  name: 'history',
  type: ApplicationCommandType.ChatInput,
  description: 'Looks up the fan history of a club member.',
  options: [
    {
      type: ApplicationCommandOptionType.Integer,
      name: 'name',
      description: 'Name of the member.',
      autocomplete: true,
      required: true
    }
  ]
};

export const commandList = [COMMAND_ABOUT, COMMAND_HISTORY];
