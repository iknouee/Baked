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
const port = Number(process.env.PORT || 10000);

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
  replies: [],
  economy: {},
  chatbot: {},
  moderation: { warnings: {}, blacklists: {} },
};

function cloneDefaultData() {
  return {
    members: [...defaultData.members],
    panels: [],
    replies: [],
    economy: {},
    chatbot: {},
    moderation: { warnings: {}, blacklists: {} },
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

    if (!Array.isArray(parsedData.replies)) {
      parsedData.replies = [];
    }

    if (!parsedData.economy || typeof parsedData.economy !== 'object') {
      parsedData.economy = {};
    }

    if (!parsedData.chatbot || typeof parsedData.chatbot !== 'object') {
      parsedData.chatbot = {};
    }

    if (!parsedData.moderation || typeof parsedData.moderation !== 'object') {
      parsedData.moderation = { warnings: {}, blacklists: {} };
    }

    if (!parsedData.moderation.warnings || typeof parsedData.moderation.warnings !== 'object') {
      parsedData.moderation.warnings = {};
    }

    if (!parsedData.moderation.blacklists || typeof parsedData.moderation.blacklists !== 'object') {
      parsedData.moderation.blacklists = {};
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
// AUTO-REPLY HELPERS
// ======================================================

const replyCooldowns = new Map();

function normaliseTrigger(value) {
  return value.trim().toLowerCase();
}

function triggerMatches(messageContent, replyRule) {
  const content = messageContent.toLowerCase();
  const trigger = replyRule.trigger.toLowerCase();

  if (replyRule.matchType === 'exact') {
    return content.trim() === trigger;
  }

  return content.includes(trigger);
}

function isReplyOnCooldown(guildId, channelId, ruleId) {
  const key = `${guildId}:${channelId}:${ruleId}`;
  const now = Date.now();
  const previous = replyCooldowns.get(key) || 0;
  const cooldownMs = 5000;

  if (now - previous < cooldownMs) {
    return true;
  }

  replyCooldowns.set(key, now);

  setTimeout(() => {
    replyCooldowns.delete(key);
  }, cooldownMs).unref?.();

  return false;
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
// LOCAL CONVERSATION ENGINE (NO EXTERNAL AI)
// ======================================================

const conversationState = new Map();
const chatCooldowns = new Map();

const recentChatReplies = new Map();

const chatBanks = {
  greetings: [
    'yo {name}', 'wagwan {name}', 'what you saying gang', 'yo who let {name} in',
    'my guy {name} has entered the building', 'safe {name}', 'look alive, {name} just spawned in',
    'yo gangnem', 'what we on then', 'there goes the neighbourhood 😭', 'big {name} in the chat',
    'say less, im here', 'who summoned the mandem', 'yo bossman', 'alright calm down im awake',
  ],
  howAreYou: [
    'im calm, just monitoring the streets of discord', 'surviving off electricity and pure aura',
    'im good bro, server looks dodgy though', 'chilling like i do not have 40 commands to run',
    'still standing, still dangerous, still hosted on render', 'im blessed, slightly laggy but blessed',
    'im on timing today icl', 'good until one of you starts moving federal',
    'living lavish inside a javascript file', 'cant complain, nobody would listen anyway',
  ],
  thanks: [
    'say less gang', 'anytime my drilla', 'you know the vibes', 'got you family',
    'no stress boss', 'allow the emotional speech 😭', 'payment accepted in respect and coins',
    'thats what the mandem are for', 'real one detected', 'safe my guy',
  ],
  insults: [
    'you are beefing code and somehow losing', 'bro came with violence and no material',
    'that insult had no seasoning', 'you typed that with your whole chest too 😭',
    'calm down keyboard warrior', 'you are moving brave behind that profile picture',
    'respectfully, hold that L', 'bro loaded the comeback and it jammed',
    'your roast needs a software update', 'you have been sentenced to ten minutes of silence',
    'do not make me expose your /slots record', 'big talk from someone with zero aura points',
    'you tried to cook and left the oven off', 'that was criminally unfunny',
    'im not taking lip from a civilian', 'pipe down before i calculate your embarrassment',
  ],
  compliments: [
    'real recognises real', 'common {name} W', 'my guy knows quality',
    'certified member of the mandem', 'you got aura icl', 'finally somebody speaking facts',
    'respect has been deposited into your account', 'big up yourself',
    'you might be the chosen one', 'rare intelligent message in this server',
  ],
  agreement: [
    'real talk', 'on gang', 'no lies detected', 'you cooked there', 'facts only',
    'say it louder for the civilians', 'thats what im saying', 'heavy on that',
    'certified street knowledge', 'the council approves this message',
  ],
  disagreement: [
    'nah you lost me', 'that is premium cap', 'respectfully, absolutely not',
    'bro is spreading misinformation in the ends', 'delete this before the mandem see it',
    'you are not cooking, turn the stove off', 'im calling cap enforcement',
    'that opinion needs bail money', 'wild statement with zero evidence',
  ],
  cap: [
    'CAP 😭', 'bro lying like rent is due', 'source: trust me bro',
    'the cap levels are dangerous', 'even pinocchio said calm down',
    'you nearly convinced yourself there', 'moving fraudulent in broad daylight',
    'federal levels of misinformation', 'that story has downloadable content missing',
  ],
  yes: ['yeah probably', '100%', 'obviously', 'say less', 'for sure gang', 'without a doubt', 'green light from the council'],
  no: ['nah gang', 'absolutely not 😭', 'not on my watch', 'zero chance', 'allow it', 'the streets said no', 'request denied by management'],
  maybe: ['maybe still', 'depends how much aura is involved', 'could go either way icl', 'ask the council', '50/50 like a dodgy coinflip'],
  confused: [
    'what are you waffling about', 'run that back in english gang', 'you lost me after the first three words',
    'bro what 😭', 'translation unavailable', 'even google translate gave up',
    'speak clearly before i call the grammar unit', 'that sentence came from the trenches',
  ],
  laugh: [
    'nahhh 😭', 'im finished', 'you lot are criminals', 'that is outrageous behavior',
    'who raised you people', 'im logging off after that', 'foul play detected 💀',
    'the streets will remember this', 'you did not need to air that publicly',
    'someone clip that immediately', 'nah this server is beyond saving',
  ],
  boredom: [
    'start harmless beef then', 'go lose the family fortune on /slots',
    'someone run smash or pass and ruin a friendship', 'make a confession, the streets are quiet',
    'go check who has the least aura', 'create drama but keep it legally manageable',
    'challenge someone to a coinflip, winner gets custody of the server',
    'say something controversial like pineapple belongs on pizza',
  ],
  goodnight: [
    'safe night {name}', 'sleep well gang, the ends are secure', 'night my drilla',
    'go recharge your aura', 'finally, one less civilian online', 'dream responsibly',
    'rest up boss, tomorrow we move again', 'goodnight gangnem',
  ],
  goodbye: [
    'safe {name}', 'later gang', 'do not get caught lacking', 'see you when the group chat gets active',
    'move safe bossman', 'the streets will miss you for approximately six minutes',
    'exit approved', 'later my drilla',
  ],
  whoAreYou: [
    'im BKD, local businessman and full-time menace',
    'the most respected javascript file in these ends',
    'your favourite digital drilla, no batteries included',
    'server security, entertainment and occasional bad advice',
    'the mandem put me in charge while they were away',
  ],
  money: [
    'check the balance before you start flexing', 'bro has champagne dreams and /beg money',
    'the economy is in the mud again', 'make your coins quietly, taxman is watching',
    'rich talk from the financially challenged', 'go work a shift before speaking on wealth',
    'money comes and goes, mostly goes when you use /slots',
  ],
  relationship: [
    'focus on the bag gang', 'love is temporary, aura is forever',
    'that situation sounds expensive', 'do not double text, maintain street discipline',
    'they left you on delivered? tragic scenes', 'relationship advice from me is legally questionable',
    'stand up bro, your crown is hitting the pavement',
  ],
  food: [
    'save me a plate gang', 'that sounds dangerously edible', 'ordering food without the mandem is betrayal',
    'big meal, bigger consequences', 'chef behaviour', 'rate the scran out of ten',
  ],
  gaming: [
    'sounds like a skill issue from the ends', 'lock in gang', 'bro blamed lag before the match started',
    'carry the mandem then', 'you play like the controller owes you money',
    'ranked mode has damaged this community', 'get the win and stop giving speeches',
  ],
  genericQuestions: [
    'honestly gang, probably', 'the streets are saying no', 'ask {other}, they move like an expert',
    'give me context before i make a reckless ruling', 'my professional opinion is pure chaos',
    'that sounds suspicious still', 'depends how brave you are feeling',
    'ive seen worse plans succeed', 'the council needs more evidence',
    'flip a coin and call it strategy', 'you already know the answer, you just want backup',
  ],
  genericReplies: [
    'real', 'say less', 'you might be cooking', 'that is mad icl', 'noted by the council',
    'why would you admit this in public', 'the streets are watching', 'heavy statement',
    'i hear it', 'some thoughts belong in drafts gang', 'big if true',
    'moving mysterious today', 'that has changed the political climate of the server',
    'respectfully, what a day to have internet', 'the mandem will review this',
    'dangerous information', 'this is why we cannot have nice things',
    'you woke up and chose disorder', 'fair play bossman', 'keep talking, im building a case',
  ],
  callbacks: [
    'we are still on {topic}? the agenda is strong', 'not {topic} again 😭',
    '{name} has been campaigning about {topic} all day', 'the {topic} operation continues',
    'word on the street is {topic} caused all this', '{other} started the {topic} allegations still',
  ],
};

function getChatConfig(data, guildId) {
  if (!data.chatbot[guildId]) {
    data.chatbot[guildId] = {
      enabled: true,
      chance: 8,
      channels: [],
      ignoredUsers: [],
      nicknames: {},
      personality: 'chaotic',
    };
  }
  const c = data.chatbot[guildId];
  c.channels ||= [];
  c.ignoredUsers ||= [];
  c.nicknames ||= {};
  c.chance = Number.isFinite(c.chance) ? c.chance : 8;
  c.personality ||= 'chaotic';
  return c;
}

function choice(items) { return items[Math.floor(Math.random() * items.length)]; }
function chance(percent) { return Math.random() * 100 < percent; }
function cleanForChat(value) {
  return String(value || '').toLowerCase().replace(/<@!?\d+>/g, '').replace(/[^a-z0-9'?! ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function getDisplayName(message, config) {
  return config.nicknames[message.author.id] || message.member?.displayName || message.author.globalName || message.author.username;
}
function rememberMessage(message) {
  const key = `${message.guild.id}:${message.channel.id}`;
  const history = conversationState.get(key) || [];
  history.push({ userId: message.author.id, name: message.member?.displayName || message.author.username, content: cleanForChat(message.content), at: Date.now() });
  while (history.length > 24) history.shift();
  conversationState.set(key, history);
  return history;
}
function extractTopic(history) {
  const stop = new Set(['this','that','with','have','what','when','where','your','youre','they','them','just','like','really','about','from','been','were','will','would','could','should','bro','gang','still','yeah','nah','lmao','because','think','know']);
  const counts = new Map();
  for (const item of history.slice(-10)) {
    for (const word of item.content.split(' ')) if (word.length > 4 && !stop.has(word)) counts.set(word, (counts.get(word)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
}
function fillChatTemplate(template, message, config, history) {
  const name = getDisplayName(message, config);
  const other = history.slice().reverse().find(x => x.userId !== message.author.id)?.name || 'someone here';
  const topic = extractTopic(history) || 'that';
  return template.replaceAll('{name}', name).replaceAll('{other}', other).replaceAll('{topic}', topic);
}
function classifyChat(content) {
  if (/\b(hi|hey|hello|yo|sup|wassup|wsg|wagwan)\b/.test(content)) return 'greetings';
  if (/how (are|r) (you|u)|you good|u good/.test(content)) return 'howAreYou';
  if (/\b(thanks|thank you|ty|appreciate|safe bro)\b/.test(content)) return 'thanks';
  if (/\b(stupid|dumb|idiot|shut up|ugly|useless|hate you|trash|mid bot|fraud bot)\b/.test(content)) return 'insults';
  if (/\b(good bot|love you|best bot|funny bot|smart bot|w bot|goat bot)\b/.test(content)) return 'compliments';
  if (/\b(cap|lying|liar|not true|fake|stop lying)\b/.test(content)) return 'cap';
  if (/\b(facts|real talk|exactly|i agree|true that|on god)\b/.test(content)) return 'agreement';
  if (/\b(i disagree|wrong|not really|no way)\b/.test(content)) return 'disagreement';
  if (/\b(im bored|i am bored|dead chat|boring)\b/.test(content)) return 'boredom';
  if (/\b(goodnight|good night|gn)\b/.test(content)) return 'goodnight';
  if (/\b(bye|goodbye|later|cya|im leaving)\b/.test(content)) return 'goodbye';
  if (/who are you|what are you|who r u/.test(content)) return 'whoAreYou';
  if (/\b(money|coins|rich|broke|balance|payday|cash|bank)\b/.test(content)) return 'money';
  if (/\b(girl|boyfriend|girlfriend|crush|relationship|love|left on read|delivered)\b/.test(content)) return 'relationship';
  if (/\b(food|hungry|eat|pizza|burger|chicken|meal|scran)\b/.test(content)) return 'food';
  if (/\b(game|gaming|fortnite|roblox|cod|valorant|minecraft|ranked|controller|console)\b/.test(content)) return 'gaming';
  if (/\b(lol|lmao|lmfao|haha|😭|💀)\b/.test(content)) return 'laugh';
  if (/\b(yes or no|should i|do you think|is .*\?|are .*\?|can .*\?|will .*\?)\b/.test(content) || content.endsWith('?')) return 'genericQuestions';
  if (content.length < 3) return 'confused';
  return 'genericReplies';
}
function selectFreshReply(category, message, config, history) {
  const key = `${message.guild.id}:${message.channel.id}`;
  const used = recentChatReplies.get(key) || [];
  const bank = chatBanks[category] || chatBanks.genericReplies;
  const available = bank.filter(line => !used.includes(line));
  const picked = choice(available.length ? available : bank);
  used.push(picked);
  while (used.length > 14) used.shift();
  recentChatReplies.set(key, used);
  return fillChatTemplate(picked, message, config, history);
}
function createLocalReply(message, config, history, direct) {
  const content = cleanForChat(message.content);
  let category = classifyChat(content);
  if (!direct && extractTopic(history) && chance(28)) category = 'callbacks';
  let reply = selectFreshReply(category, message, config, history);
  if (config.personality === 'dry' && reply.length > 30) reply = choice(['real', 'say less', 'fair', 'nah gang', 'crazy work', '😭']);
  if (config.personality === 'friendly' && category === 'insults') reply = choice(['allow it gang 😭', 'peace in the ends please', 'love you too bossman', 'we are all family here unfortunately']);
  if (config.personality === 'chaotic' && chance(16) && !/[😭💀]/.test(reply)) reply += choice([' 😭', ' still', ' icl', ' gang']);
  return reply.slice(0, 280);
}
async function isReplyToBot(message) {
  if (!message.reference?.messageId) return false;
  try { const original = await message.channel.messages.fetch(message.reference.messageId); return original.author.id === client.user.id; }
  catch { return false; }
}
async function handleLocalConversation(message, data) {
  const config = getChatConfig(data, message.guild.id);
  const history = rememberMessage(message);
  if (!config.enabled || config.ignoredUsers.includes(message.author.id)) return false;
  if (config.channels.length && !config.channels.includes(message.channel.id)) return false;
  const mentioned = message.mentions.users.has(client.user.id);
  const replied = await isReplyToBot(message);
  const named = /\b(bkd bot|baked bot|bkd)\b/i.test(message.content);
  const direct = mentioned || replied || named;
  const activeChat = history.filter(x => Date.now() - x.at < 90000).length >= 4;
  const spontaneous = activeChat && chance(Math.max(0, Math.min(35, config.chance)));
  if (!direct && !spontaneous) return false;
  const cooldownKey = `${message.guild.id}:${message.channel.id}`;
  const wait = direct ? 2500 : 12000;
  if (Date.now() - (chatCooldowns.get(cooldownKey) || 0) < wait) return false;
  chatCooldowns.set(cooldownKey, Date.now());
  const reply = createLocalReply(message, config, history, direct);
  try {
    await message.channel.sendTyping();
    await new Promise(resolve => setTimeout(resolve, Math.min(2400, 450 + reply.length * 24 + randomInt(0, 500))));
    await message.reply({ content: reply, allowedMentions: { repliedUser: false, parse: [] } });
    if (chance(8)) await message.react(choice(['😭','💀','😂','🔥','🤨'])).catch(()=>{});
    return true;
  } catch (error) { console.error('Local conversation error:', error); return false; }
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

  new SlashCommandBuilder()
    .setName('addreply')
    .setDescription('Adds an automatic reply trigger')
    .addStringOption((option) =>
      option
        .setName('trigger')
        .setDescription('The word or phrase that activates the reply')
        .setMinLength(1)
        .setMaxLength(100)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('response')
        .setDescription('What the bot should reply with')
        .setMinLength(1)
        .setMaxLength(1800)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('matching')
        .setDescription('How the trigger should match messages')
        .addChoices(
          {
            name: 'Contains trigger',
            value: 'contains',
          },
          {
            name: 'Exact message only',
            value: 'exact',
          }
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('removereply')
    .setDescription('Removes an automatic reply trigger')
    .addStringOption((option) =>
      option
        .setName('trigger')
        .setDescription('Choose the trigger to remove')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('listreplies')
    .setDescription('Shows all automatic reply triggers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),


  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Shows the moderation warnings for a member')
    .addUserOption(option => option
      .setName('user')
      .setDescription('Member whose warnings you want to view')
      .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription("Manage this server's blocked words")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(o => o
      .setName('add')
      .setDescription('Add a word or phrase to the blacklist')
      .addStringOption(v => v
        .setName('word')
        .setDescription('Word or phrase to block')
        .setMinLength(1)
        .setMaxLength(80)
        .setRequired(true)))
    .addSubcommand(o => o
      .setName('remove')
      .setDescription('Remove a word or phrase from the blacklist')
      .addStringOption(v => v
        .setName('word')
        .setDescription('Word or phrase to remove')
        .setAutocomplete(true)
        .setRequired(true)))
    .addSubcommand(o => o
      .setName('list')
      .setDescription('Show all blacklisted words')),

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
    .setName('chatbot')
    .setDescription('Controls the local BKD conversation system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(o => o.setName('status').setDescription('Shows the chatbot settings'))
    .addSubcommand(o => o.setName('enable').setDescription('Enables conversational replies'))
    .addSubcommand(o => o.setName('disable').setDescription('Disables conversational replies'))
    .addSubcommand(o => o.setName('channel').setDescription('Adds or removes a chatbot channel').addChannelOption(c => c.setName('channel').setDescription('Channel to toggle').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(o => o.setName('chance').setDescription('Sets spontaneous reply chance').addIntegerOption(v => v.setName('percent').setDescription('0 to 35 percent').setMinValue(0).setMaxValue(35).setRequired(true)))
    .addSubcommand(o => o.setName('personality').setDescription('Changes the bot personality').addStringOption(v => v.setName('style').setDescription('Personality style').addChoices({name:'Chaotic',value:'chaotic'},{name:'Friendly',value:'friendly'},{name:'Dry',value:'dry'}).setRequired(true)))
    .addSubcommand(o => o.setName('nickname').setDescription('Sets what the bot calls a member').addUserOption(u => u.setName('user').setDescription('Member').setRequired(true)).addStringOption(n => n.setName('name').setDescription('Nickname').setMinLength(1).setMaxLength(30).setRequired(true)))
    .addSubcommand(o => o.setName('ignore').setDescription('Toggles whether the bot ignores a member').addUserOption(u => u.setName('user').setDescription('Member').setRequired(true))),

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
// READY EVENT
// ======================================================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('AUTOMOD enabled: severe language, spam, links, attachments and NSFW checks are active.');
  console.log(`Connected to ${client.guilds.cache.size} server(s).`);
});

// ======================================================
// AUTOMATIC MODERATION
// ======================================================

const moderationActivity = new Map();
const moderationLocks = new Set();
const recentGuildJoins = new Map();

const moderationSettings = {
  noticeDeleteMs: 12_000,
  rapidWindowMs: 6_000,
  rapidLimit: 5,
  duplicateWindowMs: 15_000,
  duplicateLimit: 3,
  mentionLimit: 6,
  capsMinimumLength: 18,
  capsRatio: 0.82,
  emojiLimit: 18,
  lineLimit: 14,
};

// Ordinary swearing is intentionally allowed. These patterns are for serious
// slurs, hateful language and degrading sexual harassment. Server-specific
// entries can also be added to
// moderation-extra-words.json as plain strings (one JSON array).
const severeWordPatterns = [];

const extraWordFile = path.join(__dirname, 'moderation-extra-words.json');
let cachedExtraWords = { mtime: 0, patterns: [] };

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadExtraModerationPatterns() {
  try {
    if (!fs.existsSync(extraWordFile)) return [];
    const stat = fs.statSync(extraWordFile);
    if (cachedExtraWords.mtime === stat.mtimeMs) return cachedExtraWords.patterns;
    const values = JSON.parse(fs.readFileSync(extraWordFile, 'utf8'));
    const patterns = Array.isArray(values)
      ? values.filter(v => typeof v === 'string' && v.trim()).slice(0, 1000)
          .map(v => new RegExp(`\\b${escapeRegex(normaliseModerationText(v, true))}\\b`, 'i'))
      : [];
    cachedExtraWords = { mtime: stat.mtimeMs, patterns };
    return patterns;
  } catch (error) {
    console.error('Unable to load moderation-extra-words.json:', error.message);
    return [];
  }
}

function normaliseModerationText(value, compact = false) {
  let text = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .toLowerCase()
    .replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b')
    .replace(/@/g, 'a').replace(/\$/g, 's');
  if (compact) {
    return text.replace(/[^a-z0-9]+/g, '').replace(/(.)\1{2,}/g, '$1$1');
  }
  return text
    .replace(/[`_*~|]/g, '')
    .replace(/[^a-z0-9\s'.,!?/:@#-]+/g, ' ')
    .replace(/(.)\1{3,}/g, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function getGuildBlacklist(data, guildId) {
  data.moderation ||= { warnings: {}, blacklists: {} };
  data.moderation.blacklists ||= {};
  if (!Array.isArray(data.moderation.blacklists[guildId])) {
    data.moderation.blacklists[guildId] = [];
  }
  return data.moderation.blacklists[guildId];
}

function blacklistWordMatches(content, word) {
  const spaced = normaliseModerationText(content);
  const compact = normaliseModerationText(content, true);
  const wordSpaced = normaliseModerationText(word);
  const wordCompact = normaliseModerationText(word, true);
  if (!wordCompact) return false;

  const spacedPattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(wordSpaced)}([^a-z0-9]|$)`, 'i');
  const compactPattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(wordCompact)}([^a-z0-9]|$)`, 'i');
  return spacedPattern.test(spaced) || compactPattern.test(compact);
}

function containsSevereLanguage(content, data, guildId) {
  const spaced = normaliseModerationText(content);
  const compact = normaliseModerationText(content, true);
  const builtInMatch = [...severeWordPatterns, ...loadExtraModerationPatterns()].some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(spaced) || pattern.test(compact);
  });
  return false;
}

function warningKey(guildId, userId) { return `${guildId}:${userId}`; }

function addModerationWarning(data, message, reason) {
  const key = warningKey(message.guild.id, message.author.id);
  const current = data.moderation.warnings[key] || { count: 0, history: [] };
  current.count += 1;
  current.history.push({ reason, at: Date.now(), channelId: message.channel.id, messageId: message.id });
  current.history = current.history.slice(-30);
  data.moderation.warnings[key] = current;
  saveData(data);
  return current.count;
}

function safeLogText(value, maximum = 1000) {
  const text = String(value || '')
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere')
    .replace(/<@&?(\d+)>/g, '<@\u200b$1>')
    .replace(/`/g, 'ˋ')
    .trim();
  if (!text) return '*No text content.*';
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text;
}

async function sendModLog(guild, payload) {
  const channelId = process.env.MOD_LOG_CHANNEL_ID;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const fields = [
    ...(payload.user ? [{ name: 'Member', value: `${payload.user} (\`${payload.user.id}\`)`, inline: true }] : []),
    ...(payload.channel ? [{ name: 'Channel', value: `${payload.channel}`, inline: true }] : []),
    ...(payload.warningCount ? [{ name: 'Warnings', value: `\`${payload.warningCount}\``, inline: true }] : []),
    ...(payload.messageContent !== undefined ? [{ name: 'Message deleted', value: `\`\`\`\n${safeLogText(payload.messageContent)}\n\`\`\``, inline: false }] : []),
    ...(payload.attachments?.length ? [{ name: 'Attachments', value: safeLogText(payload.attachments.join('\n'), 1000), inline: false }] : []),
    ...(payload.messageCount > 1 ? [{ name: 'Messages removed', value: `\`${payload.messageCount}\``, inline: true }] : []),
  ];

  const embed = new EmbedBuilder()
    .setColor(payload.color || 0xed4245)
    .setAuthor({ name: 'BKD • AUTOMOD' })
    .setTitle(payload.title || 'Moderation action')
    .setDescription(payload.description || 'No details provided.')
    .addFields(fields)
    .setTimestamp();

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(error => {
    console.error('Failed to send moderation log:', error.message);
  });
}

async function applyWarningEscalation(message, warningCount, reason) {
  const member = message.member;
  if (!member) return 'Warning recorded';
  let action = 'Warning recorded';
  try {
    if (warningCount === 2 && member.moderatable) {
      await member.timeout(10 * 60_000, `Automod: ${reason}`);
      action = 'Timed out for 10 minutes';
    } else if (warningCount === 3 && member.moderatable) {
      await member.timeout(60 * 60_000, `Automod: ${reason}`);
      action = 'Timed out for 1 hour';
    } else if (warningCount === 4 && member.kickable) {
      await member.kick(`Automod reached 4 warnings: ${reason}`);
      action = 'Kicked from the server';
    } else if (warningCount >= 5 && process.env.MODERATION_AUTO_BAN === 'true' && member.bannable) {
      await member.ban({ deleteMessageSeconds: 3600, reason: `Automod reached ${warningCount} warnings: ${reason}` });
      action = 'Banned from the server';
    }
  } catch (error) {
    console.error('Warning escalation failed:', error.message);
    action = 'Warning recorded (punishment failed — check bot role position)';
  }
  return action;
}

async function sendModerationNotice(message, reason, warningCount, action) {
  const notice = await message.channel.send({
    content: `⚠️ ${message.author}, your message was removed. **Reason:** ${reason}\nWarning **#${warningCount}** • ${action}.`,
    allowedMentions: { users: [message.author.id], roles: [], repliedUser: false },
  }).catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), moderationSettings.noticeDeleteMs).unref?.();
}

async function deleteMessagesSafely(messages) {
  const unique = [...new Map(messages.filter(Boolean).map(m => [m.id, m])).values()];
  const groups = new Map();
  for (const msg of unique) {
    const list = groups.get(msg.channel.id) || [];
    list.push(msg); groups.set(msg.channel.id, list);
  }
  for (const list of groups.values()) {
    const channel = list[0].channel;
    if (list.length > 1 && channel.bulkDelete) {
      await channel.bulkDelete(list, true).catch(async () => {
        for (const msg of list) await msg.delete().catch(() => {});
      });
    } else if (list[0]) await list[0].delete().catch(() => {});
  }
}

function getMessageRuleViolation(message) {
  const raw = String(message.content || '');
  const text = normaliseModerationText(raw);
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const history = (moderationActivity.get(key) || []).filter(item => now - item.at < 20_000);
  history.push({ at: now, content: text, message });
  moderationActivity.set(key, history);

  const rapid = history.filter(item => now - item.at < moderationSettings.rapidWindowMs);
  const duplicates = text ? history.filter(item => now - item.at < moderationSettings.duplicateWindowMs && item.content === text) : [];
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  const letters = raw.match(/[A-Za-z]/g) || [];
  const capitals = raw.match(/[A-Z]/g) || [];
  const emojiCount = (raw.match(/<a?:\w+:\d+>|\p{Extended_Pictographic}/gu) || []).length;
  const lines = raw.split(/\r?\n/).length;
  const combiningMarks = (raw.match(/[\u0300-\u036f]/g) || []).length;

  if (rapid.length >= moderationSettings.rapidLimit) return { reason: 'Rapid message spam', messages: rapid.map(x => x.message) };
  if (duplicates.length >= moderationSettings.duplicateLimit) return { reason: 'Repeated-message spam', messages: duplicates.map(x => x.message) };
  if (mentions >= moderationSettings.mentionLimit) return { reason: 'Mass mention spam', messages: [message] };
  if (letters.length >= moderationSettings.capsMinimumLength && capitals.length / letters.length >= moderationSettings.capsRatio) return { reason: 'Excessive capital-letter spam', messages: [message] };
  if (emojiCount >= moderationSettings.emojiLimit) return { reason: 'Emoji spam', messages: [message] };
  if (lines >= moderationSettings.lineLimit) return { reason: 'Line-break spam', messages: [message] };
  if (combiningMarks >= 20) return { reason: 'Zalgo/Unicode spam', messages: [message] };

  const invite = /(?:discord(?:app)?\.com\/invite|discord\.gg)\/[a-z0-9-]+/i.test(raw);
  if (invite && process.env.ALLOW_DISCORD_INVITES !== 'true' && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return { reason: 'Discord invite links are not allowed', messages: [message] };
  }

  const suspicious = /(?:free\s*(?:nitro|boost)|steam\s*gift|claim\s*(?:gift|nitro)|discord\s*gift|verify\s*your\s*account|token\s*grabber|ip\s*logger)/i.test(raw);
  const hasUrl = /https?:\/\/|www\./i.test(raw);
  if (suspicious && hasUrl) return { reason: 'Possible scam or phishing link', messages: [message] };

  return null;
}

function dangerousAttachmentReason(message) {
  const dangerous = /\.(?:exe|scr|bat|cmd|com|msi|jar|ps1|vbs|js|jse|wsf|hta|apk|dmg|iso|lnk)$/i;
  for (const attachment of message.attachments.values()) {
    if (dangerous.test(attachment.name || '')) return 'Potentially dangerous executable attachment';
  }
  return null;
}

async function imageLooksNsfw(url) {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) return false;
  try {
    const form = new FormData();
    form.append('url', url);
    form.append('models', 'nudity-2.1');
    form.append('api_user', apiUser);
    form.append('api_secret', apiSecret);
    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST', body: form, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const n = result.nudity || {};
    return Number(n.sexual_activity || 0) >= 0.45 || Number(n.sexual_display || 0) >= 0.45 ||
      Number(n.erotica || 0) >= 0.68 || Number(n.very_suggestive || 0) >= 0.78;
  } catch (error) {
    console.error('NSFW image scan failed:', error.message);
    return false;
  }
}

async function containsNsfwImage(message) {
  const images = [...message.attachments.values()].filter(a =>
    a.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name || '')
  );
  for (const image of images.slice(0, 6)) if (await imageLooksNsfw(image.url)) return true;
  return false;
}

async function punishAndLog(message, data, reason, messages = [message]) {
  const lockKey = `${message.guild.id}:${message.author.id}`;
  if (moderationLocks.has(lockKey)) return true;
  moderationLocks.add(lockKey);
  try {
    // Capture evidence before Discord deletes the messages.
    const evidenceMessages = [...new Map(messages.filter(Boolean).map(msg => [msg.id, msg])).values()];
    const messageContent = evidenceMessages
      .slice(-8)
      .map(msg => `${msg.author?.username || 'Unknown'}: ${msg.content?.trim() || '[attachment/no text]'}`)
      .join('\n');
    const attachments = evidenceMessages
      .flatMap(msg => [...(msg.attachments?.values?.() || [])].map(file => `${file.name || 'attachment'} — ${file.url}`))
      .slice(0, 8);

    const deletableMessages = messages.filter(msg => msg?.deletable !== false);
    if (deletableMessages.length === 0) {
      console.error('AUTOMOD: Cannot delete messages. Give the bot Manage Messages and place its role correctly.');
    }
    await deleteMessagesSafely(deletableMessages);
    moderationActivity.delete(lockKey);
    const count = addModerationWarning(data, message, reason);
    const action = await applyWarningEscalation(message, count, reason);
    await sendModerationNotice(message, reason, count, action);
    await sendModLog(message.guild, {
      title: 'Automatic moderation action',
      description: `**Reason:** ${reason}\n**Action:** ${action}`,
      user: message.author,
      channel: message.channel,
      warningCount: count,
      messageContent,
      attachments,
      messageCount: evidenceMessages.length,
    });
  } finally {
    setTimeout(() => moderationLocks.delete(lockKey), 2500).unref?.();
  }
  return true;
}

function memberBypassesModeration(message) {
  const ids = String(process.env.MODERATION_BYPASS_ROLE_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return ids.length > 0 && message.member?.roles.cache.some(role => ids.includes(role.id));
}

async function moderateMessage(message, data) {
  if (memberBypassesModeration(message)) return false;
  if (containsSevereLanguage(message.content, data, message.guild.id)) return punishAndLog(message, data, 'Prohibited slur or severe abusive language');
  const attachmentReason = dangerousAttachmentReason(message);
  if (attachmentReason) return punishAndLog(message, data, attachmentReason);
  const violation = getMessageRuleViolation(message);
  if (violation) return punishAndLog(message, data, violation.reason, violation.messages);
  if (message.attachments.size > 0 && await containsNsfwImage(message)) {
    return punishAndLog(message, data, 'NSFW or sexually explicit image');
  }
  return false;
}

// Re-check edited messages so users cannot edit safe text into prohibited text.
client.on('messageUpdate', async (_oldMessage, newMessage) => {
  try {
    if (newMessage.partial) newMessage = await newMessage.fetch();
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (!newMessage.content?.trim() && newMessage.attachments.size === 0) return;
    await moderateMessage(newMessage, loadData());
  } catch (error) { console.error('Edited-message moderation error:', error); }
});

// Basic anti-raid detection. Set RAID_QUARANTINE_ROLE_ID to automatically
// place very new accounts into a restricted role during a join spike.
client.on('guildMemberAdd', async member => {
  const now = Date.now();
  const joins = (recentGuildJoins.get(member.guild.id) || []).filter(t => now - t < 20_000);
  joins.push(now); recentGuildJoins.set(member.guild.id, joins);
  const accountAge = now - member.user.createdTimestamp;
  const raidDetected = joins.length >= 8;
  const veryNew = accountAge < 3 * 24 * 60 * 60_000;
  if (!raidDetected) return;
  let action = 'Raid spike detected';
  const quarantineRoleId = process.env.RAID_QUARANTINE_ROLE_ID;
  if (veryNew && quarantineRoleId) {
    const role = member.guild.roles.cache.get(quarantineRoleId);
    if (role && member.manageable) {
      await member.roles.add(role, 'Automod raid quarantine').catch(() => {});
      action = 'Very new account quarantined during join spike';
    }
  }
  await sendModLog(member.guild, {
    title: 'Possible raid detected',
    description: `${joins.length} members joined within 20 seconds.\n**Action:** ${action}`,
    user: member.user,
    color: 0xfee75c,
  });
});

// ======================================================
// MESSAGE AUTO-REPLIES
// ======================================================

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content?.trim() && message.attachments.size === 0) return;
  try {
    const data = loadData();

    if (await moderateMessage(message, data)) return;

    // Attachment-only messages have nothing to auto-reply to.
    if (!message.content?.trim()) return;

    const guildReplies = data.replies.filter(reply => reply.guildId === message.guild.id);
    for (const replyRule of guildReplies) {
      if (!triggerMatches(message.content, replyRule)) continue;
      if (isReplyOnCooldown(message.guild.id, message.channel.id, replyRule.id)) continue;
      await message.reply({ content: replyRule.response, allowedMentions: { repliedUser: false, parse: [] } });
      return;
    }
    const configBefore = JSON.stringify(data.chatbot[message.guild.id] || null);
    await handleLocalConversation(message, data);
    if (JSON.stringify(data.chatbot[message.guild.id] || null) !== configBefore) saveData(data);
  } catch (error) { console.error('Message handling error:', error); }
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

    if (interaction.commandName === 'blacklist') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'remove') {
        const results = getGuildBlacklist(data, interaction.guildId)
          .filter(word => word.toLowerCase().includes(searchText))
          .slice(0, 25)
          .map(word => ({ name: word.slice(0, 100), value: word }));
        await interaction.respond(results);
        return;
      }
    }

    if (interaction.commandName === 'removereply') {
      const results = data.replies
        .filter(
          (reply) =>
            reply.guildId === interaction.guildId &&
            reply.trigger.toLowerCase().includes(searchText)
        )
        .slice(0, 25)
        .map((reply) => ({
          name: `${reply.trigger} (${reply.matchType})`.slice(0, 100),
          value: reply.id,
        }));

      await interaction.respond(results);
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
// SLASH COMMAND HANDLER
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'bing') {
      await interaction.reply('bong');
      return;
    }

    if (interaction.commandName === 'warnings') {
      const target = interaction.options.getUser('user', true);
      const data = loadData();
      const record = data.moderation?.warnings?.[warningKey(interaction.guildId, target.id)] || { count: 0, history: [] };
      const history = Array.isArray(record.history) ? record.history.slice(-10).reverse() : [];

      const historyText = history.length
        ? history.map((entry, index) => {
            const timestamp = entry.at ? `<t:${Math.floor(entry.at / 1000)}:R>` : 'Unknown time';
            const channel = entry.channelId ? `<#${entry.channelId}>` : 'Unknown channel';
            return `**${index + 1}. ${safeLogText(entry.reason || 'Automod warning', 120)}**\n${channel} • ${timestamp}`;
          }).join('\n\n').slice(0, 3900)
        : '*This member has no saved warnings.*';

      const embed = new EmbedBuilder()
        .setColor(record.count > 0 ? 0xed4245 : 0x57f287)
        .setAuthor({
          name: 'BKD • MODERATION WARNINGS',
          iconURL: target.displayAvatarURL({ extension: 'png', size: 128 }),
        })
        .setTitle(`${target.username}'s warnings`)
        .setDescription(historyText)
        .addFields({ name: 'Total warnings', value: `\`${Number(record.count) || 0}\``, inline: true })
        .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 256 }))
        .setFooter({ text: `User ID: ${target.id} • Showing the latest ${history.length} warning${history.length === 1 ? '' : 's'}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.commandName === 'blacklist') {
      const data = loadData();
      const words = getGuildBlacklist(data, interaction.guildId);
      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const rawWord = interaction.options.getString('word', true).trim();
        const normalised = normaliseModerationText(rawWord).trim();
        if (!normalised) {
          await interaction.reply({ content: 'That word is not valid.', flags: MessageFlags.Ephemeral });
          return;
        }
        const exists = words.some(word => normaliseModerationText(word) === normalised);
        if (exists) {
          await interaction.reply({ content: `\`${rawWord}\` is already blacklisted.`, flags: MessageFlags.Ephemeral });
          return;
        }
        words.push(rawWord);
        words.sort((a, b) => a.localeCompare(b));
        saveData(data);
        await interaction.reply({ content: `✅ Added \`${rawWord}\` to the blacklist. Messages containing it will be deleted and warned.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (sub === 'remove') {
        const rawWord = interaction.options.getString('word', true);
        const index = words.findIndex(word => word.toLowerCase() === rawWord.toLowerCase());
        if (index < 0) {
          await interaction.reply({ content: `\`${rawWord}\` is not blacklisted.`, flags: MessageFlags.Ephemeral });
          return;
        }
        const [removed] = words.splice(index, 1);
        saveData(data);
        await interaction.reply({ content: `✅ Removed \`${removed}\` from the blacklist.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const shown = words.length
        ? words.map((word, index) => `\`${index + 1}.\` ${word}`).join('\n').slice(0, 3900)
        : '*No custom blacklisted words yet.*';
      const embed = new EmbedBuilder()
        .setColor(0xf08a24)
        .setTitle('Server Word Blacklist')
        .setDescription(shown)
        .setFooter({ text: `${words.length} custom blocked word${words.length === 1 ? '' : 's'}` });
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.commandName === 'chatbot') {
      const data = loadData();
      const config = getChatConfig(data, interaction.guildId);
      const sub = interaction.options.getSubcommand();
      if (sub === 'enable') config.enabled = true;
      if (sub === 'disable') config.enabled = false;
      if (sub === 'chance') config.chance = interaction.options.getInteger('percent', true);
      if (sub === 'personality') config.personality = interaction.options.getString('style', true);
      if (sub === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        const index = config.channels.indexOf(channel.id);
        if (index >= 0) config.channels.splice(index, 1); else config.channels.push(channel.id);
      }
      if (sub === 'nickname') {
        const target = interaction.options.getUser('user', true);
        config.nicknames[target.id] = interaction.options.getString('name', true).trim();
      }
      if (sub === 'ignore') {
        const target = interaction.options.getUser('user', true);
        const index = config.ignoredUsers.indexOf(target.id);
        if (index >= 0) config.ignoredUsers.splice(index, 1); else config.ignoredUsers.push(target.id);
      }
      saveData(data);
      const channelText = config.channels.length ? config.channels.map(id => `<#${id}>`).join(', ') : 'All text channels';
      const embed = new EmbedBuilder().setColor(0xf08a24).setTitle('BKD Conversation System').setDescription('Local rule-based chat. No OpenAI or external AI API is used.').addFields(
        {name:'Status',value:config.enabled?'🟢 Enabled':'🔴 Disabled',inline:true},
        {name:'Personality',value:`\`${config.personality}\``,inline:true},
        {name:'Random reply chance',value:`\`${config.chance}%\``,inline:true},
        {name:'Channels',value:channelText.slice(0,1024),inline:false},
        {name:'Ignored members',value:`\`${config.ignoredUsers.length}\``,inline:true},
        {name:'Saved nicknames',value:`\`${Object.keys(config.nicknames).length}\``,inline:true}
      ).setFooter({text:'Mentions and replies always have priority over random chat.'});
      await interaction.reply({embeds:[embed], flags: sub === 'status' ? undefined : MessageFlags.Ephemeral});
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

    if (interaction.commandName === 'addreply') {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const trigger = normaliseTrigger(
        interaction.options.getString('trigger', true)
      );

      const response = interaction.options
        .getString('response', true)
        .trim();

      const matchType =
        interaction.options.getString('matching') || 'contains';

      if (!trigger) {
        await interaction.editReply({
          content: 'Please enter a valid trigger.',
        });
        return;
      }

      const data = loadData();

      const duplicate = data.replies.some(
        (reply) =>
          reply.guildId === interaction.guild.id &&
          reply.trigger.toLowerCase() === trigger &&
          reply.matchType === matchType
      );

      if (duplicate) {
        await interaction.editReply({
          content:
            `A **${matchType}** reply already exists for \`${trigger}\`.`,
        });
        return;
      }

      const replyRule = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        guildId: interaction.guild.id,
        trigger,
        response,
        matchType,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString(),
      };

      data.replies.push(replyRule);
      saveData(data);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf08a24)
            .setTitle('Automatic Reply Added')
            .addFields(
              {
                name: 'Trigger',
                value: `\`${trigger}\``,
                inline: true,
              },
              {
                name: 'Matching',
                value:
                  matchType === 'exact'
                    ? 'Exact message'
                    : 'Contains trigger',
                inline: true,
              },
              {
                name: 'Bot response',
                value: response,
                inline: false,
              }
            )
            .setFooter({
              text: `Added by ${interaction.user.username}`,
            }),
        ],
      });

      return;
    }

    if (interaction.commandName === 'removereply') {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const ruleId = interaction.options.getString(
        'trigger',
        true
      );

      const data = loadData();

      const ruleIndex = data.replies.findIndex(
        (reply) =>
          reply.id === ruleId &&
          reply.guildId === interaction.guild.id
      );

      if (ruleIndex === -1) {
        await interaction.editReply({
          content: 'I could not find that automatic reply.',
        });
        return;
      }

      const [removedRule] = data.replies.splice(ruleIndex, 1);
      saveData(data);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Automatic Reply Removed')
            .setDescription(
              `Removed the trigger \`${removedRule.trigger}\`.`
            ),
        ],
      });

      return;
    }

    if (interaction.commandName === 'listreplies') {
      const data = loadData();

      const guildReplies = data.replies.filter(
        (reply) => reply.guildId === interaction.guild.id
      );

      if (guildReplies.length === 0) {
        await interaction.reply({
          content: 'There are no automatic replies set up yet.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const shownReplies = guildReplies.slice(0, 20);

      const description = shownReplies
        .map((reply, index) => {
          const mode =
            reply.matchType === 'exact' ? 'exact' : 'contains';

          const shortenedResponse =
            reply.response.length > 90
              ? `${reply.response.slice(0, 87)}...`
              : reply.response;

          return (
            `**${index + 1}.** \`${reply.trigger}\` ` +
            `• ${mode}\n↳ ${shortenedResponse}`
          );
        })
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0xf08a24)
        .setTitle('BKD Automatic Replies')
        .setDescription(description)
        .setFooter({
          text:
            guildReplies.length > shownReplies.length
              ? `Showing 20 of ${guildReplies.length} replies`
              : `${guildReplies.length} automatic ${
                  guildReplies.length === 1 ? 'reply' : 'replies'
                }`,
        });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
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
