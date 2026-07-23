const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

const {
  createCanvas,
  loadImage,
} = require('@napi-rs/canvas');

const fs = require('fs');
const path = require('path');
const http = require('http');

// ======================================================
// ENVIRONMENT VARIABLES
// ======================================================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const goodbyeChannelId = process.env.GOODBYE_CHANNEL_ID;
const rolesChannelId = process.env.ROLES_CHANNEL_ID;

const selfRoleIds = {
  red: process.env.ROLE_RED_ID,
  orange: process.env.ROLE_ORANGE_ID,
  yellow: process.env.ROLE_YELLOW_ID,
  green: process.env.ROLE_GREEN_ID,
  blue: process.env.ROLE_BLUE_ID,
  purple: process.env.ROLE_PURPLE_ID,
  pink: process.env.ROLE_PINK_ID,
  under18: process.env.ROLE_UNDER_18_ID,
  over18: process.env.ROLE_18_PLUS_ID,
};

const port = Number(process.env.PORT || 10000);

const BAKED_BANNER_URL =
  'https://cdn.discordapp.com/attachments/1316124692188500010/1529655493595758823/baked.png?ex=6a62ba31&is=6a6168b1&hm=6e64c7f2b3205df1d11b3ec7999089b6ee5eda0712ce6ec9aaeb5387b664a934';

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID environment variable.');
  process.exit(1);
}

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ======================================================
// DATA STORAGE
// ======================================================

const dataFile = path.join(__dirname, 'baked-data.json');

const defaultData = {
  members: [
    'BKDROME',
    'BKDMASON',
    'BKDBELLE',
    'BKDRAZE',
    'BKDBREE',
    'BKDCHELS',
    'BKDSPIDEY',
  ],
  panels: [],
  economy: {},
};

function cloneDefaultData() {
  return {
    members: [...defaultData.members],
    panels: [],
    economy: {},
  };
}

function createDataFile() {
  if (fs.existsSync(dataFile)) return;

  fs.writeFileSync(
    dataFile,
    JSON.stringify(cloneDefaultData(), null, 2),
    'utf8'
  );

  console.log('Created baked-data.json.');
}

function loadData() {
  createDataFile();

  try {
    const rawData = fs.readFileSync(dataFile, 'utf8');
    const parsedData = JSON.parse(rawData);

    if (!Array.isArray(parsedData.members)) {
      parsedData.members = [...defaultData.members];
    }

    if (!Array.isArray(parsedData.panels)) {
      parsedData.panels = [];
    }


    if (!parsedData.economy || typeof parsedData.economy !== 'object') {
      parsedData.economy = {};
    }





    return parsedData;
  } catch (error) {
    console.error('Failed to read baked-data.json:', error);

    const restoredData = cloneDefaultData();
    saveData(restoredData);
    return restoredData;
  }
}

function saveData(data) {
  fs.writeFileSync(
    dataFile,
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

// ======================================================
// MEMBER HELPERS
// ======================================================

function formatMemberName(name) {
  let formattedName = name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');

  if (!formattedName.startsWith('BKD')) {
    formattedName = `BKD${formattedName}`;
  }

  return formattedName;
}

function createBakedMembersEmbed(guild) {
  const data = loadData();
  const members = data.members;

  const guildIcon = guild.iconURL({
    extension: 'png',
    size: 512,
  });

  const midpoint = Math.ceil(members.length / 2);
  const leftMembers = members.slice(0, midpoint);
  const rightMembers = members.slice(midpoint);

  function formatMemberColumn(memberList, startIndex) {
    if (memberList.length === 0) return '—';

    return memberList
      .map((member, index) => {
        const number = String(startIndex + index + 1).padStart(2, '0');
        return `\`${number}\`  **${member}**`;
      })
      .join('\n\n');
  }

  const embed = new EmbedBuilder()
    .setColor(0xf08a24)
    .setAuthor({
      name: 'BKD • BAKED',
      iconURL: guildIcon || undefined,
    })
    .setTitle('OFFICIAL MEMBER ROSTER')
    .setDescription([
      'The official people representing **Baked**.',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
    ].join('\n'))
    .addFields(
      {
        name: 'MEMBERS',
        value: formatMemberColumn(leftMembers, 0),
        inline: true,
      },
      {
        name: '\u200B',
        value: formatMemberColumn(rightMembers, midpoint),
        inline: true,
      },
      {
        name: '\u200B',
        value: '━━━━━━━━━━━━━━━━━━━━',
        inline: false,
      },
      {
        name: 'ROSTER STATUS',
        value: `\`${members.length}\` active ${
          members.length === 1 ? 'member' : 'members'
        }`,
        inline: true,
      },
      {
        name: 'GROUP',
        value: '`BKD — Baked`',
        inline: true,
      }
    )
    .setFooter({
      text: 'Built different. Baked together.',
      iconURL: guildIcon || undefined,
    });

  if (guildIcon) {
    embed.setThumbnail(guildIcon);
  }

  return embed;
}

async function updateAllMemberPanels(guild) {
  const data = loadData();
  const activePanels = [];

  for (const panel of data.panels) {
    if (panel.guildId !== guild.id) {
      activePanels.push(panel);
      continue;
    }

    try {
      const channel = await guild.channels.fetch(panel.channelId);

      if (!channel || !channel.isTextBased()) {
        continue;
      }

      const message = await channel.messages.fetch(panel.messageId);

      await message.edit({
        embeds: [createBakedMembersEmbed(guild)],
      });

      activePanels.push(panel);
    } catch {
      console.log(`Removing expired member panel ${panel.messageId}.`);
    }
  }

  data.panels = activePanels;
  saveData(data);
}

// ======================================================
// QUOTE IMAGE HELPERS
// ======================================================

function roundedRectangle(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawCircleImage(context, image, x, y, size) {
  context.save();
  context.beginPath();
  context.arc(
    x + size / 2,
    y + size / 2,
    size / 2,
    0,
    Math.PI * 2
  );
  context.closePath();
  context.clip();
  context.drawImage(image, x, y, size, size);
  context.restore();
}

function cleanMessageContent(content) {
  if (!content) return '';

  return content
    .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ':$1:')
    .replace(/<@!?(\d+)>/g, '@user')
    .replace(/<@&(\d+)>/g, '@role')
    .replace(/<#(\d+)>/g, '#channel')
    .replace(/\|\|(.+?)\|\|/g, '$1')
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .trim();
}

function splitLongWord(context, word, maximumWidth) {
  const pieces = [];
  let currentPiece = '';

  for (const character of word) {
    const testPiece = currentPiece + character;

    if (
      context.measureText(testPiece).width > maximumWidth &&
      currentPiece
    ) {
      pieces.push(currentPiece);
      currentPiece = character;
    } else {
      currentPiece = testPiece;
    }
  }

  if (currentPiece) pieces.push(currentPiece);
  return pieces;
}

function wrapText(context, text, maximumWidth) {
  const paragraphs = text.split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const originalWords = paragraph.split(/\s+/);
    const words = [];

    for (const word of originalWords) {
      if (context.measureText(word).width > maximumWidth) {
        words.push(...splitLongWord(context, word, maximumWidth));
      } else {
        words.push(word);
      }
    }

    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (
        context.measureText(testLine).width > maximumWidth &&
        currentLine
      ) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

function truncateLines(context, lines, maximumLines, maximumWidth) {
  if (lines.length <= maximumLines) return lines;

  const shortenedLines = lines.slice(0, maximumLines);
  let finalLine = shortenedLines[maximumLines - 1];

  while (
    context.measureText(`${finalLine}…`).width > maximumWidth &&
    finalLine.length > 0
  ) {
    finalLine = finalLine.slice(0, -1);
  }

  shortenedLines[maximumLines - 1] = `${finalLine.trim()}…`;
  return shortenedLines;
}

function formatQuoteDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  }).format(date);
}

async function safelyLoadImage(url) {
  if (!url) return null;

  try {
    return await loadImage(url);
  } catch (error) {
    console.error(`Unable to load image ${url}:`, error.message);
    return null;
  }
}

async function createQuoteImage(message, guild) {
  const canvasWidth = 1200;
  const horizontalPadding = 78;
  const contentWidth = canvasWidth - horizontalPadding * 2;

  const displayName =
    message.member?.displayName ||
    message.author.globalName ||
    message.author.username;

  const username = `@${message.author.username}`;

  let messageContent = cleanMessageContent(message.content);

  if (!messageContent) {
    if (message.stickers.size > 0) {
      messageContent = `[Sticker: ${message.stickers.first().name}]`;
    } else if (message.attachments.size > 0) {
      messageContent = 'Shared an attachment';
    } else {
      messageContent = 'No text content';
    }
  }

  const avatarImage = await safelyLoadImage(
    message.author.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true,
    })
  );

  const guildIcon = await safelyLoadImage(
    guild.iconURL({
      extension: 'png',
      size: 256,
    })
  );

  const measurementCanvas = createCanvas(canvasWidth, 500);
  const measurementContext = measurementCanvas.getContext('2d');

  measurementContext.font = '600 40px Arial, sans-serif';

  let messageLines = wrapText(
    measurementContext,
    messageContent,
    contentWidth - 100
  );

  messageLines = truncateLines(
    measurementContext,
    messageLines,
    12,
    contentWidth - 100
  );

  const lineHeight = 58;
  const textAreaHeight = Math.max(120, messageLines.length * lineHeight);
  const headerHeight = 190;
  const cardHeight = headerHeight + textAreaHeight + 130;
  const footerHeight = 105;
  const canvasHeight = cardHeight + footerHeight + 80;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext('2d');

  const backgroundGradient = context.createLinearGradient(
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  backgroundGradient.addColorStop(0, '#09090b');
  backgroundGradient.addColorStop(0.55, '#111114');
  backgroundGradient.addColorStop(1, '#1f130b');

  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const glow = context.createRadialGradient(
    canvasWidth - 130,
    80,
    0,
    canvasWidth - 130,
    80,
    480
  );

  glow.addColorStop(0, 'rgba(240, 138, 36, 0.24)');
  glow.addColorStop(1, 'rgba(240, 138, 36, 0)');

  context.fillStyle = glow;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.55)';
  context.shadowBlur = 35;
  context.shadowOffsetY = 18;

  roundedRectangle(
    context,
    42,
    38,
    canvasWidth - 84,
    cardHeight,
    32
  );

  context.fillStyle = '#17171b';
  context.fill();
  context.restore();

  roundedRectangle(
    context,
    42,
    38,
    canvasWidth - 84,
    cardHeight,
    32
  );

  const cardGradient = context.createLinearGradient(
    42,
    38,
    canvasWidth - 42,
    cardHeight
  );

  cardGradient.addColorStop(0, '#1c1c21');
  cardGradient.addColorStop(1, '#141417');

  context.fillStyle = cardGradient;
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 2;
  context.stroke();

  const accentGradient = context.createLinearGradient(
    42,
    0,
    canvasWidth - 42,
    0
  );

  accentGradient.addColorStop(0, '#f08a24');
  accentGradient.addColorStop(0.55, '#ffb45f');
  accentGradient.addColorStop(1, '#f08a24');

  roundedRectangle(
    context,
    42,
    38,
    canvasWidth - 84,
    10,
    6
  );

  context.fillStyle = accentGradient;
  context.fill();

  const avatarSize = 94;
  const avatarX = 92;
  const avatarY = 92;

  if (avatarImage) {
    context.save();
    context.shadowColor = 'rgba(240, 138, 36, 0.45)';
    context.shadowBlur = 24;
    context.beginPath();
    context.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2 + 4,
      0,
      Math.PI * 2
    );
    context.fillStyle = '#f08a24';
    context.fill();
    context.restore();

    drawCircleImage(
      context,
      avatarImage,
      avatarX,
      avatarY,
      avatarSize
    );
  }

  context.fillStyle = '#ffffff';
  context.font = '700 38px Arial, sans-serif';
  context.fillText(
    displayName,
    avatarX + avatarSize + 28,
    avatarY + 38
  );

  context.fillStyle = '#9b9ba5';
  context.font = '500 25px Arial, sans-serif';
  context.fillText(
    username,
    avatarX + avatarSize + 28,
    avatarY + 76
  );

  const badgeText = 'QUOTED';
  context.font = '700 18px Arial, sans-serif';

  const badgeWidth = context.measureText(badgeText).width + 34;
  const badgeX = canvasWidth - 92 - badgeWidth;

  roundedRectangle(context, badgeX, 106, badgeWidth, 40, 20);
  context.fillStyle = 'rgba(240, 138, 36, 0.14)';
  context.fill();
  context.strokeStyle = 'rgba(240, 138, 36, 0.45)';
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = '#ffac58';
  context.fillText(badgeText, badgeX + 17, 133);

  context.beginPath();
  context.moveTo(horizontalPadding, headerHeight + 24);
  context.lineTo(canvasWidth - horizontalPadding, headerHeight + 24);
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = 'rgba(240, 138, 36, 0.24)';
  context.font = '700 105px Georgia, serif';
  context.fillText('“', horizontalPadding + 5, headerHeight + 118);

  const textX = horizontalPadding + 80;
  let textY = headerHeight + 95;

  context.fillStyle = '#f3f3f5';
  context.font = '600 40px Arial, sans-serif';

  for (const line of messageLines) {
    context.fillText(line, textX, textY);
    textY += lineHeight;
  }

  const footerY = cardHeight + 75;

  if (guildIcon) {
    drawCircleImage(context, guildIcon, 67, footerY - 18, 46);
  }

  context.fillStyle = '#eeeeef';
  context.font = '700 22px Arial, sans-serif';

  const serverTextX = guildIcon ? 128 : 72;
  context.fillText(guild.name, serverTextX, footerY + 13);

  context.fillStyle = '#85858f';
  context.font = '500 20px Arial, sans-serif';

  const channelName = message.channel?.name || 'unknown-channel';

  context.fillText(
    `#${channelName}  •  ${formatQuoteDate(message.createdAt)}`,
    serverTextX,
    footerY + 45
  );

  context.textAlign = 'right';
  context.fillStyle = '#f08a24';
  context.font = '800 25px Arial, sans-serif';
  context.fillText('BKD', canvasWidth - 70, footerY + 10);

  context.fillStyle = '#85858f';
  context.font = '600 18px Arial, sans-serif';
  context.fillText('BAKED QUOTES', canvasWidth - 70, footerY + 41);

  context.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

// ======================================================
// FEET JOKE HELPERS
// ======================================================

const feetImageDirectory = path.join(__dirname, 'assets', 'feet');
const lastFeetImageByGuild = new Map();

const feetCaptions = [
  'Fresh out the toe factory.',
  'Put those dogs away 😭',
  'Certified gripper sighting.',
  'A completely unnecessary feet drop.',
  'The socks have officially left the chat.',
  'WikiFeet scouts are typing…',
  'Free feet in this economy?',
  'Caught in 4K with the toes out.',
  'Premium toe content has arrived.',
  'The grippers have been deployed.',
  'Nobody asked, but here we are.',
  'A historic moment for the server.',
];

function getFeetImages() {
  try {
    if (!fs.existsSync(feetImageDirectory)) return [];

    return fs.readdirSync(feetImageDirectory)
      .filter((fileName) => /\.(png|jpe?g|webp)$/i.test(fileName))
      .map((fileName) => path.join(feetImageDirectory, fileName));
  } catch (error) {
    console.error('Unable to read feet image directory:', error);
    return [];
  }
}

function chooseRandomFeetImage(guildId) {
  const images = getFeetImages();
  if (images.length === 0) return null;

  const previousImage = lastFeetImageByGuild.get(guildId);
  const availableImages = images.length > 1
    ? images.filter((imagePath) => imagePath !== previousImage)
    : images;

  const selectedImage = availableImages[randomInt(0, availableImages.length - 1)];
  lastFeetImageByGuild.set(guildId, selectedImage);
  return selectedImage;
}

function createFeetEmbed(user, attachmentName) {
  const caption = feetCaptions[randomInt(0, feetCaptions.length - 1)];

  return new EmbedBuilder()
    .setColor(0xff75b5)
    .setAuthor({
      name: 'BKD • FEET FINDER',
      iconURL: user.displayAvatarURL({ extension: 'png', size: 128 }),
    })
    .setTitle('👣 Random Feet Drop')
    .setDescription(`**${caption}**\n\nRequested by ${user}`)
    .setImage(`attachment://${attachmentName}`)
    .setFooter({ text: 'For legal reasons, this is a joke.' })
    .setTimestamp();
}

// ======================================================
// ECONOMY HELPERS
// ======================================================

const COIN = '🪙';
const economyCooldowns = new Map();
const shopItems = {
  fishing_rod: { name: 'Fishing Rod', emoji: '🎣', price: 2500, description: 'Improves /fish rewards.' },
  pickaxe: { name: 'Pickaxe', emoji: '⛏️', price: 3500, description: 'Improves /mine rewards.' },
  axe: { name: 'Axe', emoji: '🪓', price: 3000, description: 'Improves /chop rewards.' },
  lucky_charm: { name: 'Lucky Charm', emoji: '🍀', price: 6000, description: 'Small gambling luck bonus.' },
  bank_note: { name: 'Bank Note', emoji: '💵', price: 1500, description: 'Use it for a random coin reward.' },
  loot_box: { name: 'Loot Box', emoji: '🎁', price: 4500, description: 'Contains coins or a random item.' },
};

function economyKey(guildId, userId) { return `${guildId}:${userId}`; }
function getAccount(data, guildId, userId) {
  const key = economyKey(guildId, userId);
  if (!data.economy[key]) {
    data.economy[key] = {
      wallet: 500, bank: 0, xp: 0, level: 1, dailyStreak: 0,
      lastDaily: 0, lastWork: 0, lastBeg: 0, lastFish: 0,
      lastMine: 0, lastChop: 0, lastRob: 0,
      wins: 0, losses: 0, earned: 500, lost: 0, inventory: {},
    };
  }
  const a=data.economy[key];
  a.inventory ||= {};
  return a;
}
function fmt(n) { return Math.max(0, Math.floor(n)).toLocaleString('en-GB'); }
function randomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function cooldownLeft(last, ms){ return Math.max(0, last+ms-Date.now()); }
function formatWait(ms){ const s=Math.ceil(ms/1000); if(s>=3600)return `${Math.floor(s/3600)}h ${Math.ceil((s%3600)/60)}m`; if(s>=60)return `${Math.floor(s/60)}m ${s%60}s`; return `${s}s`; }
function addXp(account, amount){
  account.xp += amount;
  let levelled=false;
  while(account.xp >= account.level*250){ account.xp -= account.level*250; account.level++; account.wallet += account.level*100; levelled=true; }
  return levelled;
}
function parseAmount(input, available){
  const v=String(input).trim().toLowerCase();
  if(v==='all'||v==='max') return Math.floor(available);
  if(v==='half') return Math.floor(available/2);
  const n=Number(v.replace(/,/g,''));
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}
function addItem(account,id,qty=1){ account.inventory[id]=(account.inventory[id]||0)+qty; }
function hasItem(account,id){ return (account.inventory[id]||0)>0; }
function economyEmbed(title, description, color=0xf08a24){ return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setFooter({text:'BKD Economy • Play responsibly'}); }
function helpEmbed(){
 return new EmbedBuilder().setColor(0xf08a24).setAuthor({name:'BKD • ECONOMY'}).setTitle('Economy Command Guide').setDescription('Earn coins, build your inventory and compete for the top spot.').addFields(
 {name:'💰 Money',value:'`/balance` `/profile` `/daily` `/work` `/beg`\n`/pay` `/deposit` `/withdraw`',inline:false},
 {name:'🧰 Activities',value:'`/fish` `/mine` `/chop` `/rob`',inline:false},
 {name:'🎰 Gambling',value:'`/coinflip` `/dice` `/slots` `/blackjack`',inline:false},
 {name:'🛍️ Items',value:'`/shop` `/buy` `/inventory` `/use`',inline:false},
 {name:'🏆 Rankings',value:'`/leaderboard`',inline:false}
 ).setFooter({text:'Amounts accept numbers, half, or all'});
}

// ======================================================
// SMASH OR PASS HELPERS
// ======================================================

const smashOrPassPolls = new Map();

function formatVoteList(userIds) {
  if (userIds.length === 0) return '*Nobody voted.*';
  return userIds.map((id) => `<@${id}>`).join('\n').slice(0, 1024);
}

function createSmashOrPassEmbed({ target, starter, endsAt, smashVotes, passVotes, ended = false }) {
  const smashCount = smashVotes.size;
  const passCount = passVotes.size;
  const total = smashCount + passCount;
  const result = smashCount === passCount
    ? 'It is a tie.'
    : smashCount > passCount
      ? 'The server chose **SMASH**.'
      : 'The server chose **PASS**.';

  const embed = new EmbedBuilder()
    .setColor(ended ? (smashCount >= passCount ? 0xff4f9a : 0x5865f2) : 0xf08a24)
    .setAuthor({
      name: ended ? 'BKD • SMASH OR PASS RESULTS' : 'BKD • SMASH OR PASS',
      iconURL: starter.displayAvatarURL({ extension: 'png', size: 128 }),
    })
    .setTitle(ended ? `Voting ended for ${target.username}` : `Smash or Pass: ${target.username}?`)
    .setDescription(
      ended
        ? `${result}\n\nThe votes are locked.`
        : [
            `Vote on ${target} using the buttons below.`,
            '',
            `⏳ **Ends:** <t:${Math.floor(endsAt / 1000)}:R>`,
            `👤 **Started by:** ${starter}`,
          ].join('\n')
    )
    .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 512 }))
    .addFields(
      {
        name: `💖 SMASH • ${smashCount}`,
        value: ended ? formatVoteList([...smashVotes]) : total ? `${Math.round((smashCount / total) * 100)}% of votes` : 'No votes yet',
        inline: true,
      },
      {
        name: `🚪 PASS • ${passCount}`,
        value: ended ? formatVoteList([...passVotes]) : total ? `${Math.round((passCount / total) * 100)}% of votes` : 'No votes yet',
        inline: true,
      }
    )
    .setFooter({ text: ended ? `${total} total vote${total === 1 ? '' : 's'}` : 'You can change your vote before time runs out.' })
    .setTimestamp();

  return embed;
}

function createSmashOrPassButtons(pollId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sop:smash:${pollId}`)
      .setLabel('Smash')
      .setEmoji('💖')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`sop:pass:${pollId}`)
      .setLabel('Pass')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

async function endSmashOrPassPoll(pollId) {
  const poll = smashOrPassPolls.get(pollId);
  if (!poll || poll.ended) return;

  poll.ended = true;
  clearInterval(poll.updateInterval);
  clearTimeout(poll.endTimeout);

  try {
    const channel = await client.channels.fetch(poll.channelId);
    if (!channel?.isTextBased()) return;
    const message = await channel.messages.fetch(poll.messageId);

    await message.edit({
      embeds: [createSmashOrPassEmbed({
        target: poll.target,
        starter: poll.starter,
        endsAt: poll.endsAt,
        smashVotes: poll.smashVotes,
        passVotes: poll.passVotes,
        ended: true,
      })],
      components: [createSmashOrPassButtons(pollId, true)],
    });
  } catch (error) {
    console.error('Failed to finish Smash or Pass poll:', error);
  } finally {
    setTimeout(() => smashOrPassPolls.delete(pollId), 60 * 60 * 1000).unref?.();
  }
}

// ======================================================
// SELF ROLE HELPERS
// ======================================================

const COLOR_ROLE_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
const AGE_ROLE_KEYS = ['under18', 'over18'];

function configuredRoleIds(keys) {
  return keys.map((key) => selfRoleIds[key]).filter(Boolean);
}

function createSelfRolesEmbed(guild) {
  const guildIcon = guild.iconURL({ extension: 'png', size: 256 });

  return new EmbedBuilder()
    .setColor(0xf08a24)
    .setAuthor({
      name: 'BKD • SELF ROLES',
      iconURL: guildIcon || undefined,
    })
    .setTitle('Choose Your Roles')
    .setDescription([
      'Customise your profile using the menus below.',
      '',
      '🎨 **Colour role**',
      'Choose one colour for your name. Picking another colour automatically replaces your old one.',
      '',
      '🎂 **Age role**',
      'Choose either **Under 18** or **18+**. Please select honestly.',
      '',
      'You can change your choices whenever you want.',
    ].join('\
'))
    .setThumbnail(guildIcon || null)
    .setFooter({ text: 'BKD • Choose one option from each menu' });
}

function createSelfRoleMenus(disabled = false) {
  const colourMenu = new StringSelectMenuBuilder()
    .setCustomId('selfroles:colour')
    .setPlaceholder('🎨 Choose your colour')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disabled)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Red').setValue('red').setEmoji('🔴'),
      new StringSelectMenuOptionBuilder().setLabel('Orange').setValue('orange').setEmoji('🟠'),
      new StringSelectMenuOptionBuilder().setLabel('Yellow').setValue('yellow').setEmoji('🟡'),
      new StringSelectMenuOptionBuilder().setLabel('Green').setValue('green').setEmoji('🟢'),
      new StringSelectMenuOptionBuilder().setLabel('Blue').setValue('blue').setEmoji('🔵'),
      new StringSelectMenuOptionBuilder().setLabel('Purple').setValue('purple').setEmoji('🟣'),
      new StringSelectMenuOptionBuilder().setLabel('Pink').setValue('pink').setEmoji('🩷')
    );

  const ageMenu = new StringSelectMenuBuilder()
    .setCustomId('selfroles:age')
    .setPlaceholder('🎂 Choose your age group')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disabled)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Under 18').setValue('under18').setEmoji('🧸'),
      new StringSelectMenuOptionBuilder().setLabel('18+').setValue('over18').setEmoji('🔞')
    );

  return [
    new ActionRowBuilder().addComponents(colourMenu),
    new ActionRowBuilder().addComponents(ageMenu),
  ];
}

async function replaceExclusiveRole(member, selectedKey, groupKeys) {
  const selectedRoleId = selfRoleIds[selectedKey];
  if (!selectedRoleId) {
    throw new Error(`The environment variable for ${selectedKey} is not configured.`);
  }

  const rolesToRemove = configuredRoleIds(groupKeys).filter(
    (roleId) => roleId !== selectedRoleId && member.roles.cache.has(roleId)
  );

  if (rolesToRemove.length > 0) {
    await member.roles.remove(rolesToRemove, 'Self-role selection changed');
  }

  if (!member.roles.cache.has(selectedRoleId)) {
    await member.roles.add(selectedRoleId, 'Self-role selection');
  }
}

// ======================================================
// APPLICATION COMMANDS
// ======================================================

const commands = [
  new SlashCommandBuilder()
    .setName('bing')
    .setDescription('Replies with bong')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Makes the bot send your message')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('The message the bot should send')
        .setMinLength(1)
        .setMaxLength(2000)
        .setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('feet')
    .setDescription('Sends a random joke feet picture')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('bakedmembers')
    .setDescription('Posts the official Baked member roster')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Choose where the member roster should be posted')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('addbakedmember')
    .setDescription('Adds someone to the Baked roster')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Example: ROME or BKDROME')
        .setMinLength(1)
        .setMaxLength(25)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('removebakedmember')
    .setDescription('Removes someone from the Baked roster')
    .addStringOption((option) =>
      option
        .setName('member')
        .setDescription('Choose the member to remove')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder().setName('help').setDescription('Shows the BKD economy command guide').setDMPermission(false),
  new SlashCommandBuilder().setName('economy').setDescription('Shows the BKD economy command guide').setDMPermission(false),
  new SlashCommandBuilder().setName('balance').setDescription('Shows a user balance').addUserOption(o=>o.setName('user').setDescription('User to check')).setDMPermission(false),
  new SlashCommandBuilder().setName('profile').setDescription('Shows economy stats').addUserOption(o=>o.setName('user').setDescription('User to check')).setDMPermission(false),
  new SlashCommandBuilder().setName('daily').setDescription('Claims your daily coins').setDMPermission(false),
  new SlashCommandBuilder().setName('work').setDescription('Works for some coins').setDMPermission(false),
  new SlashCommandBuilder().setName('beg').setDescription('Begs for a few coins').setDMPermission(false),
  new SlashCommandBuilder().setName('fish').setDescription('Goes fishing for coins').setDMPermission(false),
  new SlashCommandBuilder().setName('mine').setDescription('Mines for coins').setDMPermission(false),
  new SlashCommandBuilder().setName('chop').setDescription('Chops wood for coins').setDMPermission(false),
  new SlashCommandBuilder().setName('pay').setDescription('Pays another member').addUserOption(o=>o.setName('user').setDescription('Member to pay').setRequired(true)).addStringOption(o=>o.setName('amount').setDescription('Amount, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('deposit').setDescription('Deposits wallet coins into your bank').addStringOption(o=>o.setName('amount').setDescription('Amount, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('withdraw').setDescription('Withdraws coins from your bank').addStringOption(o=>o.setName('amount').setDescription('Amount, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Shows the richest members').setDMPermission(false),
  new SlashCommandBuilder().setName('rob').setDescription('Attempts to rob another member').addUserOption(o=>o.setName('user').setDescription('Member to rob').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('coinflip').setDescription('Bets on a coin flip').addStringOption(o=>o.setName('side').setDescription('Heads or tails').addChoices({name:'Heads',value:'heads'},{name:'Tails',value:'tails'}).setRequired(true)).addStringOption(o=>o.setName('bet').setDescription('Bet, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('dice').setDescription('Rolls against the dealer').addStringOption(o=>o.setName('bet').setDescription('Bet, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('slots').setDescription('Spins the slot machine').addStringOption(o=>o.setName('bet').setDescription('Bet, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('blackjack').setDescription('Plays a quick blackjack hand').addStringOption(o=>o.setName('bet').setDescription('Bet, half, or all').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('shop').setDescription('Shows the economy shop').setDMPermission(false),
  new SlashCommandBuilder().setName('buy').setDescription('Buys an item').addStringOption(o=>o.setName('item').setDescription('Item to buy').addChoices(...Object.entries(shopItems).map(([value,item])=>({name:`${item.emoji} ${item.name}`,value}))).setRequired(true)).addIntegerOption(o=>o.setName('quantity').setDescription('Quantity').setMinValue(1).setMaxValue(20)).setDMPermission(false),
  new SlashCommandBuilder().setName('inventory').setDescription('Shows your inventory').addUserOption(o=>o.setName('user').setDescription('User to check')).setDMPermission(false),
  new SlashCommandBuilder().setName('use').setDescription('Uses an inventory item').addStringOption(o=>o.setName('item').setDescription('Item to use').addChoices({name:'💵 Bank Note',value:'bank_note'},{name:'🎁 Loot Box',value:'loot_box'}).setRequired(true)).setDMPermission(false),

  new SlashCommandBuilder()
    .setName('smashorpass')
    .setDescription('Starts a timed Smash or Pass vote for a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The member everyone will vote on')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('seconds')
        .setDescription('Voting time in seconds (default: 30)')
        .setMinValue(10)
        .setMaxValue(300)
        .setRequired(false)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Posts the BKD colour and age self-role panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new ContextMenuCommandBuilder()
    .setName('Make Quote')
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),
].map((command) => command.toJSON());

// ======================================================
// COMMAND REGISTRATION
// ======================================================

async function registerCommands() {
  const rest = new REST({
    version: '10',
  }).setToken(token);

  console.log('Registering application commands...');

  if (guildId) {
    // Remove stale global commands so Discord does not show every command twice.
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('Cleared old global application commands.');

    // Defensively remove accidental duplicate command definitions before deployment.
    const uniqueCommands = [];
    const seenCommandKeys = new Set();
    for (const command of commands) {
      const key = `${command.type || 1}:${command.name}`;
      if (seenCommandKeys.has(key)) {
        console.warn(`Skipped duplicate command definition: ${command.name}`);
        continue;
      }
      seenCommandKeys.add(key);
      uniqueCommands.push(command);
    }

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      {
        body: uniqueCommands,
      }
    );

    console.log(`Commands registered in server ${guildId}.`);
  } else {
    await rest.put(
      Routes.applicationCommands(clientId),
      {
        body: commands,
      }
    );

    console.log('Global application commands registered.');
  }
}

// ======================================================
// WELCOME / GOODBYE EMBEDS
// ======================================================

function createWelcomeEmbed(member) {
  const guildIcon = member.guild.iconURL({
    extension: 'png',
    size: 512,
  });

  return new EmbedBuilder()
    .setColor(0xf08a24)
    .setAuthor({
      name: 'BKD • NEW MEMBER',
      iconURL: guildIcon || undefined,
    })
    .setTitle(`Welcome to BKD, ${member.user.username}!`)
    .setDescription([
      `Welcome ${member} — you are officially part of **BKD**.`,
      '',
      'Make yourself at home, meet everyone, and enjoy the server. 🧡',
    ].join('\n'))
    .addFields(
      {
        name: '👥 Member',
        value: `You are member **#${member.guild.memberCount.toLocaleString('en-GB')}**`,
        inline: true,
      },
      {
        name: '📅 Account created',
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true,
      }
    )
    .setThumbnail(
      member.user.displayAvatarURL({
        extension: 'png',
        size: 512,
      })
    )
    .setImage(BAKED_BANNER_URL)
    .setFooter({
      text: `${member.guild.name} • Built different. Baked together.`,
      iconURL: guildIcon || undefined,
    })
    .setTimestamp();
}

function createGoodbyeEmbed(member) {
  const guildIcon = member.guild.iconURL({
    extension: 'png',
    size: 512,
  });

  return new EmbedBuilder()
    .setColor(0x7a1f1f)
    .setAuthor({
      name: 'BKD • MEMBER LEFT',
      iconURL: guildIcon || undefined,
    })
    .setTitle(`${member.user.username} left BKD`)
    .setDescription([
      `**${member.user.username}** has left the server.`,
      '',
      'Thanks for being part of **BKD** — we hope to see you again. 🖤',
    ].join('\n'))
    .addFields({
      name: '👥 Members remaining',
      value: `**${member.guild.memberCount.toLocaleString('en-GB')}**`,
      inline: true,
    })
    .setThumbnail(
      member.user.displayAvatarURL({
        extension: 'png',
        size: 512,
      })
    )
    .setImage(BAKED_BANNER_URL)
    .setFooter({
      text: `${member.guild.name} • Once BKD, always remembered.`,
      iconURL: guildIcon || undefined,
    })
    .setTimestamp();
}

async function sendMemberEventEmbed(channelId, embed, eventName) {
  if (!channelId) {
    console.log(`${eventName} channel is not configured.`);
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
      console.error(`${eventName} channel ${channelId} is not a text channel.`);
      return;
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`Failed to send ${eventName.toLowerCase()} message:`, error);
  }
}

client.on('guildMemberAdd', async (member) => {
  await sendMemberEventEmbed(
    welcomeChannelId,
    createWelcomeEmbed(member),
    'Welcome'
  );
});

client.on('guildMemberRemove', async (member) => {
  await sendMemberEventEmbed(
    goodbyeChannelId,
    createGoodbyeEmbed(member),
    'Goodbye'
  );
});

// ======================================================
// READY EVENT
// ======================================================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Security and automatic chat responses are disabled. Links are allowed.');
  console.log(`Connected to ${client.guilds.cache.size} server(s).`);
  console.log(`Welcome channel: ${welcomeChannelId || 'not configured'}`);
  console.log(`Goodbye channel: ${goodbyeChannelId || 'not configured'}`);
  console.log(`Roles channel: ${rolesChannelId || 'not configured'}`);
});

// ======================================================
// AUTOCOMPLETE
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  try {
    const searchText = interaction.options
      .getFocused()
      .toLowerCase();

    const data = loadData();

    if (interaction.commandName === 'removebakedmember') {
      const results = data.members
        .filter((member) =>
          member.toLowerCase().includes(searchText)
        )
        .slice(0, 25)
        .map((member) => ({
          name: member,
          value: member,
        }));

      await interaction.respond(results);
      return;
    }


  } catch (error) {
    console.error('Autocomplete error:', error);
    await interaction.respond([]).catch(() => {});
  }
});

// ======================================================
// MESSAGE CONTEXT MENU: MAKE QUOTE
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand()) return;
  if (interaction.commandName !== 'Make Quote') return;

  await interaction.deferReply();

  try {
    const message = interaction.targetMessage;

    if (!interaction.guild) {
      await interaction.editReply({
        content: 'Quotes can only be created inside a server.',
      });
      return;
    }

    if (message.author.bot) {
      await interaction.editReply({
        content: 'You cannot create a quote from a bot message.',
      });
      return;
    }

    const hasUsefulContent =
      Boolean(message.content?.trim()) ||
      message.attachments.size > 0 ||
      message.stickers.size > 0;

    if (!hasUsefulContent) {
      await interaction.editReply({
        content: 'That message does not contain anything I can quote.',
      });
      return;
    }

    const quoteBuffer = await createQuoteImage(
      message,
      interaction.guild
    );

    const safeUsername = message.author.username
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 30);

    const quoteAttachment = new AttachmentBuilder(
      quoteBuffer,
      {
        name: `quote-${safeUsername || 'member'}.png`,
        description: `A quote from ${message.author.username}`,
      }
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Original')
        .setStyle(ButtonStyle.Link)
        .setURL(message.url)
    );

    await interaction.editReply({
      files: [quoteAttachment],
      components: [row],
    });
  } catch (error) {
    console.error('Failed to create quote:', error);

    await interaction.editReply({
      content:
        'I could not create that quote image. Check the Render logs for the error.',
      files: [],
      components: [],
    });
  }
});

// ======================================================
// SMASH OR PASS BUTTON HANDLER
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('sop:')) return;

  const [, choice, pollId] = interaction.customId.split(':');
  const poll = smashOrPassPolls.get(pollId);

  if (!poll || poll.ended || Date.now() >= poll.endsAt) {
    await interaction.reply({
      content: 'This Smash or Pass vote has already ended.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  if (interaction.user.id === poll.target.id) {
    await interaction.reply({
      content: 'You cannot vote on yourself.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  poll.smashVotes.delete(interaction.user.id);
  poll.passVotes.delete(interaction.user.id);

  if (choice === 'smash') poll.smashVotes.add(interaction.user.id);
  if (choice === 'pass') poll.passVotes.add(interaction.user.id);

  await interaction.update({
    embeds: [createSmashOrPassEmbed({
      target: poll.target,
      starter: poll.starter,
      endsAt: poll.endsAt,
      smashVotes: poll.smashVotes,
      passVotes: poll.passVotes,
    })],
    components: [createSmashOrPassButtons(pollId)],
  });
});

// ======================================================
// SELF ROLE SELECT MENU HANDLER
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith('selfroles:')) return;

  try {
    const member = interaction.member;
    const selectedKey = interaction.values[0];

    if (!member || !interaction.guild) {
      await interaction.reply({
        content: 'Self roles can only be used inside the server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === 'selfroles:colour') {
      if (!COLOR_ROLE_KEYS.includes(selectedKey)) return;
      await replaceExclusiveRole(member, selectedKey, COLOR_ROLE_KEYS);
      await interaction.reply({
        content: `Your colour role has been updated to <@&${selfRoleIds[selectedKey]}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === 'selfroles:age') {
      if (!AGE_ROLE_KEYS.includes(selectedKey)) return;
      await replaceExclusiveRole(member, selectedKey, AGE_ROLE_KEYS);
      await interaction.reply({
        content: `Your age role has been updated to <@&${selfRoleIds[selectedKey]}>.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('Self-role update failed:', error);
    const message = error.code === 50013
      ? 'I cannot manage that role. Move the bot role above all colour and age roles, then give it **Manage Roles**.'
      : `I could not update your role. ${error.message || 'Check the Render logs.'}`;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

// ======================================================
// SLASH COMMAND HANDLER
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'bing') {
      await interaction.reply('bong');
      return;
    }

    if (interaction.commandName === 'say') {
      const message = interaction.options.getString('message', true).trim();

      await interaction.reply({
        content: 'Message sent.',
        flags: MessageFlags.Ephemeral,
      });

      await interaction.channel.send({
        content: message,
        allowedMentions: { parse: [] },
      });
      return;
    }




    if (interaction.commandName === 'setuproles') {
      const channel = rolesChannelId
        ? await interaction.guild.channels.fetch(rolesChannelId).catch(() => null)
        : interaction.channel;

      if (!channel?.isTextBased()) {
        await interaction.reply({
          content: 'Set a valid `ROLES_CHANNEL_ID` in Render, or run this command inside a text channel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const missing = Object.entries(selfRoleIds)
        .filter(([, roleId]) => !roleId)
        .map(([key]) => key);

      if (missing.length > 0) {
        await interaction.reply({
          content: `These role IDs are missing in Render: **${missing.join(', ')}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const missingRoles = Object.entries(selfRoleIds)
        .filter(([, roleId]) => !interaction.guild.roles.cache.has(roleId))
        .map(([key]) => key);

      if (missingRoles.length > 0) {
        await interaction.reply({
          content: `I could not find these configured roles in this server: **${missingRoles.join(', ')}**. Check their IDs.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await channel.send({
        embeds: [createSelfRolesEmbed(interaction.guild)],
        components: createSelfRoleMenus(),
      });

      await interaction.reply({
        content: `The self-role panel was posted in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.commandName === 'feet') {
      await interaction.deferReply();

      const selectedImage = chooseRandomFeetImage(interaction.guildId);

      if (!selectedImage) {
        await interaction.editReply({
          content: 'No feet pictures are installed. Add PNG, JPG, or WEBP files to `assets/feet/`.',
        });
        return;
      }

      const extension = path.extname(selectedImage).toLowerCase() || '.png';
      const attachmentName = `bkd-feet-${Date.now()}${extension}`;
      const attachment = new AttachmentBuilder(selectedImage, {
        name: attachmentName,
        description: 'A random joke feet picture',
      });

      await interaction.editReply({
        embeds: [createFeetEmbed(interaction.user, attachmentName)],
        files: [attachment],
      });
      return;
    }


    if (['help', 'economy'].includes(interaction.commandName)) {
      await interaction.reply({ embeds: [helpEmbed()] }); return;
    }

    if (['balance','profile','daily','work','beg','fish','mine','chop','pay','deposit','withdraw','leaderboard','rob','coinflip','dice','slots','blackjack','shop','buy','inventory','use'].includes(interaction.commandName)) {
      const data=loadData(); const guild=interaction.guild; const user=interaction.user; const account=getAccount(data,guild.id,user.id);
      const cmd=interaction.commandName;
      if(cmd==='balance'||cmd==='profile'){
        const target=interaction.options.getUser('user')||user; const a=getAccount(data,guild.id,target.id); saveData(data);
        if(cmd==='balance') await interaction.reply({embeds:[economyEmbed(`${target.username}'s Balance`,`${COIN} **Wallet:** ${fmt(a.wallet)}\n🏦 **Bank:** ${fmt(a.bank)}\n💰 **Total:** ${fmt(a.wallet+a.bank)}`)]});
        else await interaction.reply({embeds:[economyEmbed(`${target.username}'s Profile`,`${COIN} **Total:** ${fmt(a.wallet+a.bank)}\n⭐ **Level:** ${a.level} (${fmt(a.xp)}/${fmt(a.level*250)} XP)\n🔥 **Daily streak:** ${a.dailyStreak}\n🎲 **Gambling:** ${a.wins} wins • ${a.losses} losses\n📈 **Lifetime earned:** ${fmt(a.earned)}`)]});
        return;
      }
      if(cmd==='daily'){
        const left=cooldownLeft(account.lastDaily,86400000); if(left){await interaction.reply({content:`Your daily is ready in **${formatWait(left)}**.`,flags:MessageFlags.Ephemeral});return;}
        const previous=account.lastDaily; account.dailyStreak=(previous&&Date.now()-previous<172800000)?account.dailyStreak+1:1; const reward=750+Math.min(account.dailyStreak,14)*75; account.wallet+=reward;account.earned+=reward;account.lastDaily=Date.now();addXp(account,35);saveData(data);
        await interaction.reply({embeds:[economyEmbed('Daily Reward',`You collected ${COIN} **${fmt(reward)}**.\n🔥 Streak: **${account.dailyStreak} days**`)]});return;
      }
      const activity={work:[450,900,3600000,'worked a shift','lastWork'],beg:[40,180,300000,'asked around','lastBeg'],fish:[120,500,600000,'went fishing','lastFish'],mine:[160,650,720000,'went mining','lastMine'],chop:[140,560,600000,'chopped wood','lastChop']};
      if(activity[cmd]){let [mn,mx,cd,text,key]=activity[cmd];const left=cooldownLeft(account[key],cd);if(left){await interaction.reply({content:`Try again in **${formatWait(left)}**.`,flags:MessageFlags.Ephemeral});return;} if(cmd==='fish'&&hasItem(account,'fishing_rod'))mx+=200;if(cmd==='mine'&&hasItem(account,'pickaxe'))mx+=250;if(cmd==='chop'&&hasItem(account,'axe'))mx+=220;const reward=randomInt(mn,mx);account.wallet+=reward;account.earned+=reward;account[key]=Date.now();addXp(account,randomInt(12,28));saveData(data);await interaction.reply({embeds:[economyEmbed(cmd[0].toUpperCase()+cmd.slice(1),`You ${text} and earned ${COIN} **${fmt(reward)}**.`)]});return;}
      if(cmd==='pay'){const target=interaction.options.getUser('user',true);if(target.bot||target.id===user.id){await interaction.reply({content:'Choose another real member.',flags:MessageFlags.Ephemeral});return;}const amount=parseAmount(interaction.options.getString('amount',true),account.wallet);if(!Number.isFinite(amount)||amount<1||amount>account.wallet){await interaction.reply({content:'That is not a valid amount.',flags:MessageFlags.Ephemeral});return;}const ta=getAccount(data,guild.id,target.id);account.wallet-=amount;ta.wallet+=amount;saveData(data);await interaction.reply({embeds:[economyEmbed('Payment Sent',`You paid ${target} ${COIN} **${fmt(amount)}**.`)]});return;}
      if(cmd==='deposit'||cmd==='withdraw'){const source=cmd==='deposit'?'wallet':'bank';const dest=cmd==='deposit'?'bank':'wallet';const amount=parseAmount(interaction.options.getString('amount',true),account[source]);if(!Number.isFinite(amount)||amount<1||amount>account[source]){await interaction.reply({content:'That is not a valid amount.',flags:MessageFlags.Ephemeral});return;}account[source]-=amount;account[dest]+=amount;saveData(data);await interaction.reply({embeds:[economyEmbed(cmd==='deposit'?'Deposit Complete':'Withdrawal Complete',`${COIN} **${fmt(amount)}** moved ${cmd==='deposit'?'into':'out of'} your bank.`)]});return;}
      if(cmd==='leaderboard'){const entries=Object.entries(data.economy).filter(([k])=>k.startsWith(`${guild.id}:`)).map(([k,a])=>({id:k.split(':')[1],total:(a.wallet||0)+(a.bank||0)})).sort((a,b)=>b.total-a.total).slice(0,10);const lines=await Promise.all(entries.map(async(e,i)=>{const m=await guild.members.fetch(e.id).catch(()=>null);return `**${i+1}.** ${m?m.user.username:'Unknown'} — ${COIN} ${fmt(e.total)}`}));await interaction.reply({embeds:[economyEmbed('Richest Members',lines.join('\n')||'Nobody has started yet.') ]});return;}
      if(cmd==='rob'){const target=interaction.options.getUser('user',true);if(target.bot||target.id===user.id){await interaction.reply({content:'Choose another real member.',flags:MessageFlags.Ephemeral});return;}const left=cooldownLeft(account.lastRob,3600000);if(left){await interaction.reply({content:`You can rob again in **${formatWait(left)}**.`,flags:MessageFlags.Ephemeral});return;}const ta=getAccount(data,guild.id,target.id);if(ta.wallet<250){await interaction.reply({content:'That member does not have enough wallet coins to rob.',flags:MessageFlags.Ephemeral});return;}account.lastRob=Date.now();if(Math.random()<0.42){const amount=randomInt(100,Math.min(900,Math.floor(ta.wallet*.25)));ta.wallet-=amount;account.wallet+=amount;account.earned+=amount;saveData(data);await interaction.reply({embeds:[economyEmbed('Robbery Successful',`You stole ${COIN} **${fmt(amount)}** from ${target}.`,0x57f287)]});}else{const fine=Math.min(account.wallet,randomInt(75,350));account.wallet-=fine;account.lost+=fine;saveData(data);await interaction.reply({embeds:[economyEmbed('Robbery Failed',`You got caught and paid ${COIN} **${fmt(fine)}**.`,0xed4245)]});}return;}
      if(['coinflip','dice','slots','blackjack'].includes(cmd)){const amount=parseAmount(interaction.options.getString('bet',true),account.wallet);if(!Number.isFinite(amount)||amount<10||amount>account.wallet){await interaction.reply({content:'Bet at least 10 coins and no more than your wallet.',flags:MessageFlags.Ephemeral});return;}account.wallet-=amount;let won=false,payout=0,text='';
        if(cmd==='coinflip'){const pick=interaction.options.getString('side',true),result=Math.random()<.5?'heads':'tails';won=pick===result;payout=won?amount*2:0;text=`The coin landed on **${result}**.`;}
        if(cmd==='dice'){const you=randomInt(1,6),dealer=randomInt(1,6);won=you>dealer;payout=won?amount*2:you===dealer?amount:0;text=`You rolled **${you}** • Dealer rolled **${dealer}**.`;}
        if(cmd==='slots'){const sy=['🍒','🍋','🍇','🔔','💎'];const r=[sy[randomInt(0,4)],sy[randomInt(0,4)],sy[randomInt(0,4)]];if(r[0]===r[1]&&r[1]===r[2]){won=true;payout=amount*(r[0]==='💎'?8:5);}else if(r[0]===r[1]||r[1]===r[2]||r[0]===r[2]){won=true;payout=Math.floor(amount*1.5);}text=`╔═════════╗\n║ ${r.join(' │ ')} ║\n╚═════════╝`;}
        if(cmd==='blackjack'){const draw=()=>randomInt(2,11);const you=draw()+draw(),dealer=draw()+draw();won=(you<=21&&(dealer>21||you>dealer));payout=you===dealer?amount:won?(you===21?Math.floor(amount*2.5):amount*2):0;text=`Your hand: **${you}**\nDealer: **${dealer}**`;}
        account.wallet+=payout;if(payout>amount){account.wins++;account.earned+=payout-amount;}else if(payout===0){account.losses++;account.lost+=amount;}saveData(data);await interaction.reply({embeds:[economyEmbed(cmd[0].toUpperCase()+cmd.slice(1),`${text}\n\n${payout>amount?`You won ${COIN} **${fmt(payout-amount)}**!`:payout===amount?'**Push — your bet was returned.**':`You lost ${COIN} **${fmt(amount)}**.`}`,payout>amount?0x57f287:payout===amount?0xf1c40f:0xed4245)]});return;}
      if(cmd==='shop'){const lines=Object.entries(shopItems).map(([id,it])=>`${it.emoji} **${it.name}** — ${COIN} ${fmt(it.price)}\n${it.description}\nID: \`${id}\``).join('\n\n');await interaction.reply({embeds:[economyEmbed('BKD Shop',lines)]});return;}
      if(cmd==='buy'){const id=interaction.options.getString('item',true),qty=interaction.options.getInteger('quantity')||1,it=shopItems[id],cost=it.price*qty;if(cost>account.wallet){await interaction.reply({content:'You do not have enough wallet coins.',flags:MessageFlags.Ephemeral});return;}account.wallet-=cost;addItem(account,id,qty);saveData(data);await interaction.reply({embeds:[economyEmbed('Purchase Complete',`Bought **${qty}× ${it.emoji} ${it.name}** for ${COIN} **${fmt(cost)}**.`)]});return;}
      if(cmd==='inventory'){const target=interaction.options.getUser('user')||user,a=getAccount(data,guild.id,target.id);const items=Object.entries(a.inventory).filter(([,q])=>q>0).map(([id,q])=>`${shopItems[id]?.emoji||'📦'} **${shopItems[id]?.name||id}** ×${q}`).join('\n');saveData(data);await interaction.reply({embeds:[economyEmbed(`${target.username}'s Inventory`,items||'Inventory is empty.') ]});return;}
      if(cmd==='use'){const id=interaction.options.getString('item',true);if(!account.inventory[id]){await interaction.reply({content:'You do not own that item.',flags:MessageFlags.Ephemeral});return;}account.inventory[id]--;let result='';if(id==='bank_note'){const reward=randomInt(500,2200);account.wallet+=reward;account.earned+=reward;result=`The bank note was worth ${COIN} **${fmt(reward)}**.`;}else{const reward=randomInt(1000,5000);account.wallet+=reward;account.earned+=reward;if(Math.random()<.25){const choices=['fishing_rod','pickaxe','axe','lucky_charm'];const bonus=choices[randomInt(0,choices.length-1)];addItem(account,bonus);result=`The box contained ${COIN} **${fmt(reward)}** and **${shopItems[bonus].emoji} ${shopItems[bonus].name}**.`;}else result=`The box contained ${COIN} **${fmt(reward)}**.`;}saveData(data);await interaction.reply({embeds:[economyEmbed('Item Used',result)]});return;}
    }

    if (interaction.commandName === 'smashorpass') {
      const target = interaction.options.getUser('user', true);
      const seconds = interaction.options.getInteger('seconds') || 30;

      if (target.bot) {
        await interaction.reply({
          content: 'Choose a real member, not a bot.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (target.id === interaction.user.id) {
        await interaction.reply({
          content: 'You cannot start a Smash or Pass vote on yourself.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const pollId = `${interaction.id}-${Date.now()}`;
      const endsAt = Date.now() + seconds * 1000;
      const smashVotes = new Set();
      const passVotes = new Set();

      await interaction.reply({
        embeds: [createSmashOrPassEmbed({
          target,
          starter: interaction.user,
          endsAt,
          smashVotes,
          passVotes,
        })],
        components: [createSmashOrPassButtons(pollId)],
      });

      const message = await interaction.fetchReply();
      const poll = {
        id: pollId,
        messageId: message.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        target,
        starter: interaction.user,
        endsAt,
        smashVotes,
        passVotes,
        ended: false,
        updateInterval: null,
        endTimeout: null,
      };

      poll.updateInterval = setInterval(async () => {
        if (poll.ended || Date.now() >= poll.endsAt) return;
        try {
          await message.edit({
            embeds: [createSmashOrPassEmbed({
              target: poll.target,
              starter: poll.starter,
              endsAt: poll.endsAt,
              smashVotes: poll.smashVotes,
              passVotes: poll.passVotes,
            })],
            components: [createSmashOrPassButtons(pollId)],
          });
        } catch (error) {
          console.error('Failed to refresh Smash or Pass timer:', error);
        }
      }, 5000);
      poll.updateInterval.unref?.();

      poll.endTimeout = setTimeout(() => endSmashOrPassPoll(pollId), seconds * 1000);
      poll.endTimeout.unref?.();

      smashOrPassPolls.set(pollId, poll);
      return;
    }

    if (interaction.commandName === 'bakedmembers') {
      const selectedChannel = interaction.options.getChannel(
        'channel',
        true
      );

      if (!selectedChannel.isTextBased()) {
        await interaction.reply({
          content: 'That channel cannot receive messages.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const botMember = interaction.guild.members.me;
      const permissions = selectedChannel.permissionsFor(botMember);
      const missingPermissions = [];

      if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
        missingPermissions.push('View Channel');
      }

      if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
        missingPermissions.push('Send Messages');
      }

      if (!permissions?.has(PermissionFlagsBits.EmbedLinks)) {
        missingPermissions.push('Embed Links');
      }

      if (missingPermissions.length > 0) {
        await interaction.reply({
          content:
            `I cannot post in ${selectedChannel}.\n` +
            `Missing permissions: **${missingPermissions.join(', ')}**`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const postedMessage = await selectedChannel.send({
        embeds: [createBakedMembersEmbed(interaction.guild)],
      });

      const data = loadData();

      data.panels.push({
        guildId: interaction.guild.id,
        channelId: selectedChannel.id,
        messageId: postedMessage.id,
      });

      saveData(data);

      await interaction.reply({
        content: `The Baked member roster was posted in ${selectedChannel}.`,
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    if (interaction.commandName === 'addbakedmember') {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const providedName = interaction.options.getString(
        'name',
        true
      );

      const formattedName = formatMemberName(providedName);

      if (formattedName === 'BKD' || formattedName.length < 4) {
        await interaction.editReply({
          content: 'Please enter a valid member name.',
        });
        return;
      }

      const data = loadData();

      const alreadyExists = data.members.some(
        (member) =>
          member.toUpperCase() === formattedName.toUpperCase()
      );

      if (alreadyExists) {
        await interaction.editReply({
          content:
            `**${formattedName}** is already on the Baked roster.`,
        });
        return;
      }

      data.members.push(formattedName);
      saveData(data);

      await updateAllMemberPanels(interaction.guild);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('Member Added')
            .setDescription(
              `**${formattedName}** is now officially part of **Baked**.`
            )
            .addFields({
              name: 'Current roster',
              value: `\`${data.members.length}\` members`,
              inline: true,
            })
            .setFooter({
              text: `Added by ${interaction.user.username}`,
            }),
        ],
      });

      return;
    }

    if (interaction.commandName === 'removebakedmember') {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const selectedMember = interaction.options.getString(
        'member',
        true
      );

      const data = loadData();

      const memberIndex = data.members.findIndex(
        (member) =>
          member.toUpperCase() === selectedMember.toUpperCase()
      );

      if (memberIndex === -1) {
        await interaction.editReply({
          content:
            `I could not find **${selectedMember}** on the Baked roster.`,
        });
        return;
      }

      const [removedMember] = data.members.splice(memberIndex, 1);

      saveData(data);
      await updateAllMemberPanels(interaction.guild);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Member Removed')
            .setDescription(
              `**${removedMember}** has been removed from the **Baked** roster.`
            )
            .addFields({
              name: 'Current roster',
              value: `\`${data.members.length}\` members`,
              inline: true,
            })
            .setFooter({
              text: `Removed by ${interaction.user.username}`,
            }),
        ],
      });

      return;
    }



  } catch (error) {
    console.error(
      `Error handling /${interaction.commandName}:`,
      error
    );

    if (interaction.deferred) {
      await interaction
        .editReply({
          content:
            'Something went wrong while running that command. Check the Render logs.',
          embeds: [],
        })
        .catch(() => {});
      return;
    }

    if (interaction.replied) {
      await interaction
        .followUp({
          content:
            'Something went wrong while running that command. Check the Render logs.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }

    await interaction
      .reply({
        content:
          'Something went wrong while running that command. Check the Render logs.',
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
});

// ======================================================
// RENDER WEB SERVER
// ======================================================

const server = http.createServer((request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/plain',
  });

  response.end(
    client.isReady()
      ? `BKD bot is online as ${client.user.tag}.`
      : 'BKD bot is starting...'
  );
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Web server listening on port ${port}.`);
});

// ======================================================
// START BOT
// ======================================================

createDataFile();

registerCommands()
  .then(() => client.login(token))
  .catch((error) => {
    console.error('Bot startup failed:', error);
    process.exit(1);
  });
