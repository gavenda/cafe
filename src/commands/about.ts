import {
  APIUser,
  ButtonStyle,
  CDNRoutes,
  ComponentType,
  ImageFormat,
  MessageFlags,
  RouteBases,
  Routes
} from 'discord-api-types/v10';
import { Snowflake, getDate } from 'discord-snowflake';
import { kvRateLimitedFetch } from '../utils/kv-fetch';
import { ApplicationChatInputCommandHandler } from './command';

export const about: ApplicationChatInputCommandHandler = {
  flags: MessageFlags.Ephemeral | MessageFlags.SuppressNotifications,
  async handle(context) {
    const result = await kvRateLimitedFetch(RouteBases.api + Routes.user(), context.env, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cafe/1.0',
        'Authorization': `Bot ${context.env.DISCORD_TOKEN}`
      }
    });
    const user = await result.json<APIUser>();

    const selfAvatarUrl = RouteBases.cdn + CDNRoutes.userAvatar(user.id, user.avatar!, ImageFormat.WebP);
    const dateCreated = getDate(user.id as Snowflake);

    const versionText = `-# Version\n1.0\n`;
    const languageText = `-# Language\n[TypeScript](https://typescriptlang.org/)\n`;
    const platformText = `-# Platform\n[Cloudflare](https://cloudflare.com/)\n`;
    const dateCreatedText = `-# Date Created\n${Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'long' }).format(dateCreated)}\n`;

    await context.reply({
      components: [
        {
          type: ComponentType.Container,
          components: [
            {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: `# Who is Manhattan Cafe?`
                },
                {
                  type: ComponentType.TextDisplay,
                  content: `-# I fan count Bogusume E.\n\nA mysterious girl who blends in with the shadows... and speaks with them. She can often be found sticking close to the walls, tracing odd patterns with her fingertips. According to her, however, she's always with her "friend." She enjoys sipping a nice cup of coffee, as gulping it down too quickly hurts her stomach.\n\n-# (source: umamusume wiki)`
                }
              ],
              accessory: {
                type: ComponentType.Thumbnail,
                media: {
                  url: selfAvatarUrl
                }
              }
            },
            {
              type: ComponentType.TextDisplay,
              content: versionText
            },
            {
              type: ComponentType.TextDisplay,
              content: languageText
            },
            {
              type: ComponentType.TextDisplay,
              content: platformText
            },
            {
              type: ComponentType.TextDisplay,
              content: dateCreatedText
            },
            {
              type: ComponentType.Separator
            },
            {
              type: ComponentType.Section,
              components: [
                {
                  type: ComponentType.TextDisplay,
                  content: `-# If you want to add more languages, feel free to hop on the github and submit a pull request.`
                }
              ],
              accessory: {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                label: 'GitHub',
                url: `https://github.com/gavenda/cafe`
              }
            }
          ]
        }
      ],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
