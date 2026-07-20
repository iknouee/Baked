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
};

function cloneDefaultData() {
  return {
    members: [...defaultData.members],
    panels: [],
    replies: [],
    economy: {},
    chatbot: {},
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

const chatBanks = {
  greetings: [
    'yo {name}', 'what you saying {name}', 'wassup {name}', 'im here 😭',
    'hello troublemaker', 'look who finally showed up', 'yo gang', 'sup bro',
  ],
  howAreYou: [
    'im chilling, watching this server fall apart', 'alive somehow 😭',
    'better now that somebody remembered i exist', 'good until one of you starts drama',
    'running on render and bad decisions', 'im calm for now',
  ],
  thanks: [
    'anytime', 'got you', 'you already know', 'rare moment of appreciation',
    'dont get emotional now', 'welcome gang',
  ],
  insults: [
    'that was weak, try again', 'you typed that with confidence too 😭',
    'im not arguing with someone whose profile picture looks like that',
    'bro rehearsed that insult and still missed', 'delete this before people wake up',
    'you are fighting a javascript file and losing',
  ],
  compliments: [
    'finally someone with taste', 'you are not too bad yourself', 'real recognises real',
    'say it louder for the people ignoring me', 'common {name} W',
  ],
  yes: ['yeah probably', '100%', 'obviously', 'id say yes', 'for sure', 'without a doubt'],
  no: ['nah', 'absolutely not 😭', 'not happening', 'i doubt it', 'no chance', 'probably not'],
  maybe: ['maybe', 'depends who is asking', 'could go either way', 'ask me again when the server is less chaotic'],
  confused: ['what are you waffling about', 'run that back in english', 'you lost me halfway through', 'bro what 😭'],
  laugh: ['😭', 'nahhh 😭', 'im crying', 'you lot are finished', 'that did not need to be said', 'foul 😭'],
  boredom: [
    'start some harmless drama then', 'go use /slots and lose your money',
    'someone run smash or pass', 'talk to each other instead of staring at the member list',
    'make a terrible confession, liven the place up',
  ],
  goodnight: ['night {name}', 'sleep well gang', 'dont let discord notifications wake you up', 'finally some peace and quiet'],
  goodbye: ['later {name}', 'bye gang', 'see you when you get bored again', 'do not come back with drama'],
  whoAreYou: [
    'im BKD, unfortunately the smartest member here',
    'the only member of this server who never sleeps',
    'your favourite badly behaved discord bot',
  ],
  genericQuestions: [
    'honestly, probably', 'i would not trust that', 'ask {other}, they act like they know everything',
    'give me more context bro', 'my professional opinion is: chaos', 'that sounds suspicious',
    'depends how brave you are', 'i have seen worse ideas in here',
  ],
  genericReplies: [
    'real', 'fair enough', 'you might be onto something', 'that is crazy icl', 'noted 😭',
    'why would you admit this publicly', 'this server needs supervision', 'say less',
    'i was literally thinking that', 'some things should stay in drafts', 'big if true',
  ],
  callbacks: [
    'we are still talking about {topic}?', 'not {topic} again 😭',
    '{name} has been on about {topic} all day', 'the {topic} agenda continues',
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
  while (history.length > 18) history.shift();
  conversationState.set(key, history);
  return history;
}
function extractTopic(history) {
  const stop = new Set(['this','that','with','have','what','when','where','your','youre','they','them','just','like','really','about','from','been','were','will','would','could','should','bro','lol','lmao','nah','yeah']);
  const counts = new Map();
  for (const item of history.slice(-8)) {
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
  if (/\b(hi|hey|hello|yo|sup|wassup|wsg)\b/.test(content)) return 'greetings';
  if (/how (are|r) (you|u)|you good|u good/.test(content)) return 'howAreYou';
  if (/\b(thanks|thank you|ty|appreciate)\b/.test(content)) return 'thanks';
  if (/\b(stupid|dumb|idiot|shut up|ugly|useless|hate you|trash|mid bot)\b/.test(content)) return 'insults';
  if (/\b(good bot|love you|best bot|funny bot|smart bot|w bot)\b/.test(content)) return 'compliments';
  if (/\b(im bored|i am bored|dead chat|boring)\b/.test(content)) return 'boredom';
  if (/\b(goodnight|good night|gn)\b/.test(content)) return 'goodnight';
  if (/\b(bye|goodbye|later|cya)\b/.test(content)) return 'goodbye';
  if (/who are you|what are you|who r u/.test(content)) return 'whoAreYou';
  if (/\b(lol|lmao|lmfao|haha|😭|💀)\b/.test(content)) return 'laugh';
  if (/\b(yes or no|should i|do you think|is .*\?|are .*\?|can .*\?|will .*\?)\b/.test(content) || content.endsWith('?')) return 'genericQuestions';
  if (content.length < 3) return 'confused';
  return 'genericReplies';
}
function createLocalReply(message, config, history, direct) {
  const content = cleanForChat(message.content);
  let category = classifyChat(content);
  if (!direct && extractTopic(history) && chance(22)) category = 'callbacks';
  let reply = fillChatTemplate(choice(chatBanks[category] || chatBanks.genericReplies), message, config, history);
  if (config.personality === 'dry' && reply.length > 25) reply = choice(['real', 'fair', 'nah', 'crazy', '😭']);
  if (config.personality === 'friendly' && category === 'insults') reply = choice(['be nice 😭', 'we can do better than that', 'love you too bro']);
  return reply;
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
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      {
        body: commands,
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
  console.log(`Connected to ${client.guilds.cache.size} server(s).`);
});

// ======================================================
// MESSAGE AUTO-REPLIES
// ======================================================

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot || !message.content?.trim()) return;
  try {
    const data = loadData();
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
