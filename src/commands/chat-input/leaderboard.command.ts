import { today } from 'cafe/leaderboard/day';
import { publishLeaderboard } from 'cafe/leaderboard/publish';
import { latestSnapshotDay, type Period } from 'cafe/leaderboard/standings';
import { getGuildTrainers, MAX_WATCHED_TRAINERS, saveSnapshot } from 'cafe/leaderboard/trainers';
import { keys } from 'cafe/redis';
import { fetchTrainerFans, isTrainerId } from 'cafe/uma-moe';
import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import type { AppContext } from 'cafe/context';
import type { AppChatInputCommand } from './chat-input-command';
import { autocompleteTrainer } from './trainer-autocomplete';

const numberFormat = new Intl.NumberFormat('en-US');

const reply = (interaction: ChatInputCommandInteraction, content: string) =>
  interaction.deferred
    ? interaction.editReply({ content })
    : interaction.reply({ content, flags: MessageFlags.Ephemeral });

const setChannel = async (context: AppContext, interaction: ChatInputCommandInteraction, guildId: string) => {
  const channel = interaction.options.getChannel('channel', true);

  await context.redis.hset(keys.guild(guildId), { channel_id: channel.id });
  await context.redis.sadd(keys.guilds(), guildId);

  await reply(interaction, `Leaderboards will be posted in <#${channel.id}>.`);
};

const addTrainer = async (context: AppContext, interaction: ChatInputCommandInteraction, guildId: string) => {
  const { redis } = context;
  const trainerId = interaction.options.getString('trainer_id', true).trim();

  if (!isTrainerId(trainerId)) {
    await reply(interaction, 'A trainer id is the 9-12 digit number from the in-game profile.');
    return;
  }

  const watchedKey = keys.guildTrainers(guildId);

  if (await redis.sismember(watchedKey, trainerId)) {
    await reply(interaction, `Trainer \`${trainerId}\` is already on the leaderboard.`);
    return;
  }
  if ((await redis.scard(watchedKey)) >= MAX_WATCHED_TRAINERS) {
    await reply(interaction, `The leaderboard is full (${MAX_WATCHED_TRAINERS} trainers). Remove someone first.`);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const trainer = await fetchTrainerFans(trainerId);

  if (!trainer) {
    await reply(interaction, `uma.moe has no trainer with id \`${trainerId}\`.`);
    return;
  }

  // Record today's total right away so gains start counting from the next collection.
  await saveSnapshot(redis, trainer, today());
  await redis.sadd(watchedKey, trainerId);
  await redis.sadd(keys.guilds(), guildId);

  const circle = trainer.circleName ? ` of ${trainer.circleName}` : '';
  await reply(
    interaction,
    `Added **${trainer.name}**${circle} with ${numberFormat.format(trainer.totalFans)} fans. Gains show up after the next daily tally.`
  );
};

const removeTrainer = async (context: AppContext, interaction: ChatInputCommandInteraction, guildId: string) => {
  const trainerId = interaction.options.getString('trainer', true);
  const removed = await context.redis.srem(keys.guildTrainers(guildId), trainerId);

  await reply(
    interaction,
    removed ? `Removed trainer \`${trainerId}\`.` : `Trainer \`${trainerId}\` is not on the leaderboard.`
  );
};

const listTrainers = async (context: AppContext, interaction: ChatInputCommandInteraction, guildId: string) => {
  const trainers = await getGuildTrainers(context.redis, guildId);
  const channelId = await context.redis.hget(keys.guild(guildId), 'channel_id');

  const lines = trainers.map((trainer) => {
    const fans = trainer.fans === null ? '?' : numberFormat.format(trainer.fans);
    return `- ${trainer.name} \`${trainer.id}\` · ${fans} fans`;
  });

  await reply(
    interaction,
    [
      `**Channel:** ${channelId ? `<#${channelId}>` : 'not set, use `/leaderboard channel`'}`,
      `**Trainers (${trainers.length}/${MAX_WATCHED_TRAINERS}):**`,
      lines.length > 0 ? lines.join('\n') : 'None yet, use `/leaderboard add`.'
    ].join('\n')
  );
};

const postNow = async (context: AppContext, interaction: ChatInputCommandInteraction, guildId: string) => {
  const period = (interaction.options.getString('period') ?? 'daily') as Period;
  const channelId = await context.redis.hget(keys.guild(guildId), 'channel_id');

  if (!channelId) {
    await reply(interaction, 'Set a channel first with `/leaderboard channel`.');
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await publishLeaderboard(context, guildId, period, await latestSnapshotDay(context.redis));
  await reply(interaction, `Posted the ${period} leaderboard in <#${channelId}>.`);
};

export const leaderboard: AppChatInputCommand = {
  // prettier-ignore
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Set up which trainers cafe ranks and where the leaderboard is posted.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('channel')
      .setDescription('Set the channel the leaderboard is posted in.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Text channel for the leaderboard.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Add a trainer to the leaderboard.')
      .addStringOption((option) => option
        .setName('trainer_id')
        .setDescription('The 9-12 digit trainer id from the in-game profile.')
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove a trainer from the leaderboard.')
      .addStringOption((option) => option
        .setName('trainer')
        .setDescription('Trainer to remove.')
        .setAutocomplete(true)
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('list')
      .setDescription('Show the leaderboard channel and watched trainers.'))
    .addSubcommand((sub) => sub
      .setName('post')
      .setDescription('Post the leaderboard now.')
      .addStringOption((option) => option
        .setName('period')
        .setDescription('Which leaderboard to post.')
        .addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' })))
    .toJSON(),
  execute: async (context, interaction) => {
    const guildId = interaction.guildId;

    if (!guildId) {
      await reply(interaction, 'The leaderboard can only be set up in a server.');
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case 'channel':
        return setChannel(context, interaction, guildId);
      case 'add':
        return addTrainer(context, interaction, guildId);
      case 'remove':
        return removeTrainer(context, interaction, guildId);
      case 'list':
        return listTrainers(context, interaction, guildId);
      case 'post':
        return postNow(context, interaction, guildId);
    }
  },
  autocomplete: autocompleteTrainer
};
