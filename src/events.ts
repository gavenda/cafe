import { autocompleteInteraction } from './events/autocomplete-interaction.event';
import { chatInputCommandInteraction } from './events/chat-input-command-interaction.event';
import { readyEvent } from './events/ready.event';

export const events = [autocompleteInteraction, chatInputCommandInteraction, readyEvent];
