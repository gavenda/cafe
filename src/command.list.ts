import { APIApplicationCommand, ApplicationCommandType } from 'discord-api-types/v10';

export const COMMAND_ABOUT: Partial<APIApplicationCommand> = {
  name: 'about',
  type: ApplicationCommandType.ChatInput,
  description: 'Me.'
};

export const commandList = [COMMAND_ABOUT];
