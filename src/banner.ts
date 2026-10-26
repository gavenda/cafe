import { AttachmentBuilder } from 'discord.js';

const BANNER_NAME = 'cafe.png';
const BANNER_PATH = `${import.meta.dir}/../assets/${BANNER_NAME}`;

/** Use as a media URL in a message that carries {@link bannerAttachment}. */
export const BANNER_URL = `attachment://${BANNER_NAME}`;

/** The cafe banner, uploaded with each message instead of linking an external image. */
export const bannerAttachment = () => new AttachmentBuilder(BANNER_PATH, { name: BANNER_NAME });
