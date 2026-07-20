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
};

function cloneDefaultData() {
  return {
    members: [...defaultData.members],
    panels: [],
    replies: [],
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

    if (!Array.isArray(parsedData.replies)) {
      parsedData.replies = [];
    }

    if (!parsedData.economy || typeof parsedData.economy !== 'object' || Array.isArray(parsedData.economy)) {
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
// ECONOMY HELPERS
// ======================================================

const ECONOMY_COLOR = 0xf0a020;
const COIN = '🍪';
const blackjackSessions = new Map();

function economyKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getEconomyUser(data, guildId, userId) {
  const key = economyKey(guildId, userId);

  if (!data.economy[key]) {
    data.economy[key] = {
      wallet: 500,
      bank: 0,
      totalEarned: 500,
      totalLost: 0,
      wins: 0,
      losses: 0,
      dailyAt: 0,
      workAt: 0,
      createdAt: new Date().toISOString(),
    };
  }

  return data.economy[key];
}

function formatCoins(amount) {
  return `${COIN} **${Math.max(0, Math.floor(amount)).toLocaleString('en-GB')}**`;
}

function parseBet(raw, wallet) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'all' || value === 'max') return wallet;
  if (value === 'half') return Math.floor(wallet / 2);

  const amount = Number(value.replace(/,/g, ''));
  if (!Number.isSafeInteger(amount)) return null;
  return amount;
}

function timeRemaining(milliseconds) {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function economyEmbed(user, title, description) {
  return new EmbedBuilder()
    .setColor(ECONOMY_COLOR)
    .setAuthor({
      name: 'BKD ECONOMY',
      iconURL: user.displayAvatarURL({ extension: 'png', size: 128 }),
    })
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Play smart. Don’t go broke.' });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffledDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) deck.push({ rank, suit });
  }

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function handValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      value += 11;
      aces += 1;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += Number(card.rank);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

function cardText(card) {
  return `\`${card.rank}${card.suit}\``;
}

function blackjackEmbed(session, revealDealer = false, result = null) {
  const playerValue = handValue(session.player);
  const dealerValue = handValue(session.dealer);
  const dealerCards = revealDealer
    ? session.dealer.map(cardText).join(' ')
    : `${cardText(session.dealer[0])} \`??\``;

  const embed = new EmbedBuilder()
    .setColor(result?.color || ECONOMY_COLOR)
    .setAuthor({ name: 'BKD CASINO • BLACKJACK' })
    .setTitle(result?.title || `Bet: ${formatCoins(session.bet)}`)
    .addFields(
      {
        name: `Dealer${revealDealer ? ` • ${dealerValue}` : ''}`,
        value: dealerCards,
      },
      {
        name: `Your hand • ${playerValue}`,
        value: session.player.map(cardText).join(' '),
      }
    )
    .setFooter({ text: result?.footer || 'Hit for another card or stand to hold.' });

  if (result?.description) embed.setDescription(result.description);
  return embed;
}

function blackjackButtons(sessionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit:${sessionId}`)
      .setLabel('Hit')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`bj_stand:${sessionId}`)
      .setLabel('Stand')
      .setEmoji('✋')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
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
    .setName('balance')
    .setDescription('Shows an economy balance')
    .addUserOption((option) =>
      option.setName('user').setDescription('Member to view').setRequired(false)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claims your daily coin reward')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Works a random job for coins')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Sends coins to another member')
    .addUserOption((option) =>
      option.setName('user').setDescription('Member receiving the coins').setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('amount').setDescription('Amount to send').setMinValue(1).setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Moves wallet coins into your bank')
    .addStringOption((option) =>
      option.setName('amount').setDescription('Number, half, or all').setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Moves bank coins into your wallet')
    .addStringOption((option) =>
      option.setName('amount').setDescription('Number, half, or all').setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Shows the richest members in the server')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Bet coins on heads or tails')
    .addStringOption((option) =>
      option.setName('side').setDescription('Choose a side').addChoices(
        { name: 'Heads', value: 'heads' },
        { name: 'Tails', value: 'tails' }
      ).setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('bet').setDescription('Number, half, or all').setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll against the dealer; highest roll wins')
    .addStringOption((option) =>
      option.setName('bet').setDescription('Number, half, or all').setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Spin the BKD slot machine')
    .addStringOption((option) =>
      option.setName('bet').setDescription('Number, half, or all').setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play blackjack against the dealer')
    .addStringOption((option) =>
      option.setName('bet').setDescription('Number, half, or all').setRequired(true)
    )
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
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content?.trim()) return;

  try {
    const data = loadData();

    const guildReplies = data.replies.filter(
      (reply) => reply.guildId === message.guild.id
    );

    for (const replyRule of guildReplies) {
      if (!triggerMatches(message.content, replyRule)) {
        continue;
      }

      if (
        isReplyOnCooldown(
          message.guild.id,
          message.channel.id,
          replyRule.id
        )
      ) {
        continue;
      }

      await message.reply({
        content: replyRule.response,
        allowedMentions: {
          repliedUser: false,
          parse: [],
        },
      });

      break;
    }
  } catch (error) {
    console.error('Automatic reply error:', error);
  }
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
// ECONOMY COMMAND HANDLER
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const economyCommands = new Set([
    'balance', 'daily', 'work', 'pay', 'deposit', 'withdraw',
    'leaderboard', 'coinflip', 'dice', 'slots', 'blackjack',
  ]);

  if (!economyCommands.has(interaction.commandName)) return;

  try {
    const data = loadData();
    const account = getEconomyUser(data, interaction.guild.id, interaction.user.id);

    if (interaction.commandName === 'balance') {
      const target = interaction.options.getUser('user') || interaction.user;
      const targetAccount = getEconomyUser(data, interaction.guild.id, target.id);
      saveData(data);

      const netWorth = targetAccount.wallet + targetAccount.bank;
      const embed = economyEmbed(
        target,
        `${target.username}'s balance`,
        [
          `**Wallet**\n${formatCoins(targetAccount.wallet)}`,
          `\n**Bank**\n${formatCoins(targetAccount.bank)}`,
          `\n**Net worth**\n${formatCoins(netWorth)}`,
        ].join('\n')
      ).addFields(
        { name: 'Casino record', value: `\`${targetAccount.wins}W / ${targetAccount.losses}L\``, inline: true },
        { name: 'Lifetime earned', value: formatCoins(targetAccount.totalEarned), inline: true }
      );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'daily') {
      const cooldown = 24 * 60 * 60 * 1000;
      const remaining = cooldown - (Date.now() - account.dailyAt);

      if (remaining > 0) {
        await interaction.reply({
          content: `You already claimed your daily. Come back in **${timeRemaining(remaining)}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const reward = randomInt(750, 1250);
      account.wallet += reward;
      account.totalEarned += reward;
      account.dailyAt = Date.now();
      saveData(data);

      await interaction.reply({
        embeds: [economyEmbed(interaction.user, 'Daily claimed', `You collected ${formatCoins(reward)}.\n\nWallet: ${formatCoins(account.wallet)}`)],
      });
      return;
    }

    if (interaction.commandName === 'work') {
      const cooldown = 15 * 60 * 1000;
      const remaining = cooldown - (Date.now() - account.workAt);

      if (remaining > 0) {
        await interaction.reply({
          content: `You need a break. Work again in **${timeRemaining(remaining)}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const jobs = [
        ['edited a montage', 180, 420],
        ['delivered suspicious parcels', 220, 500],
        ['moderated the server', 150, 360],
        ['won a Roblox tournament', 240, 560],
        ['sold rare snacks', 170, 440],
        ['cleaned the group chat', 130, 330],
      ];
      const [job, min, max] = jobs[randomInt(0, jobs.length - 1)];
      const reward = randomInt(min, max);

      account.wallet += reward;
      account.totalEarned += reward;
      account.workAt = Date.now();
      saveData(data);

      await interaction.reply({
        embeds: [economyEmbed(interaction.user, 'Shift complete', `You **${job}** and earned ${formatCoins(reward)}.\n\nWallet: ${formatCoins(account.wallet)}`)],
      });
      return;
    }

    if (interaction.commandName === 'pay') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);

      if (target.bot || target.id === interaction.user.id) {
        await interaction.reply({ content: 'Choose another real member.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (amount > account.wallet) {
        await interaction.reply({ content: `You only have ${formatCoins(account.wallet)} in your wallet.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const receiver = getEconomyUser(data, interaction.guild.id, target.id);
      account.wallet -= amount;
      receiver.wallet += amount;
      saveData(data);

      await interaction.reply({
        embeds: [economyEmbed(interaction.user, 'Payment sent', `You sent ${formatCoins(amount)} to ${target}.\n\nWallet: ${formatCoins(account.wallet)}`)],
      });
      return;
    }

    if (interaction.commandName === 'deposit' || interaction.commandName === 'withdraw') {
      const depositing = interaction.commandName === 'deposit';
      const available = depositing ? account.wallet : account.bank;
      const amount = parseBet(interaction.options.getString('amount', true), available);

      if (!amount || amount < 1 || amount > available) {
        await interaction.reply({ content: `Enter a valid amount. You have ${formatCoins(available)} available.`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (depositing) {
        account.wallet -= amount;
        account.bank += amount;
      } else {
        account.bank -= amount;
        account.wallet += amount;
      }
      saveData(data);

      await interaction.reply({
        embeds: [economyEmbed(interaction.user, depositing ? 'Deposit complete' : 'Withdrawal complete', `${formatCoins(amount)} moved ${depositing ? 'into your bank' : 'into your wallet'}.\n\nWallet: ${formatCoins(account.wallet)}\nBank: ${formatCoins(account.bank)}`)],
      });
      return;
    }

    if (interaction.commandName === 'leaderboard') {
      const entries = Object.entries(data.economy)
        .filter(([key]) => key.startsWith(`${interaction.guild.id}:`))
        .map(([key, value]) => ({ userId: key.split(':')[1], worth: (value.wallet || 0) + (value.bank || 0) }))
        .sort((a, b) => b.worth - a.worth)
        .slice(0, 10);

      if (!entries.length) {
        await interaction.reply({ content: 'Nobody has an economy account yet.', flags: MessageFlags.Ephemeral });
        return;
      }

      const lines = entries.map((entry, index) => `${index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `\`${index + 1}.\``} <@${entry.userId}> — ${formatCoins(entry.worth)}`);
      await interaction.reply({ embeds: [economyEmbed(interaction.user, 'Richest in BKD', lines.join('\n\n'))] });
      return;
    }

    const rawBet = interaction.options.getString('bet', true);
    const bet = parseBet(rawBet, account.wallet);

    if (!bet || bet < 10) {
      await interaction.reply({ content: 'The minimum bet is **10 coins**.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (bet > account.wallet) {
      await interaction.reply({ content: `You only have ${formatCoins(account.wallet)} in your wallet.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.commandName === 'coinflip') {
      const chosen = interaction.options.getString('side', true);
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = chosen === result;

      account.wallet += won ? bet : -bet;
      won ? (account.wins += 1) : (account.losses += 1);
      if (won) account.totalEarned += bet;
      else account.totalLost += bet;
      saveData(data);

      const embed = economyEmbed(
        interaction.user,
        won ? 'You called it' : 'Wrong side',
        `The coin landed **${result.toUpperCase()}**.\n\n${won ? `You won ${formatCoins(bet)}` : `You lost ${formatCoins(bet)}`}\nWallet: ${formatCoins(account.wallet)}`
      ).setColor(won ? 0x57f287 : 0xed4245);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'dice') {
      const playerRoll = randomInt(1, 6);
      const dealerRoll = randomInt(1, 6);
      let outcome = 'draw';
      if (playerRoll > dealerRoll) outcome = 'win';
      if (playerRoll < dealerRoll) outcome = 'loss';

      if (outcome === 'win') {
        account.wallet += bet;
        account.wins += 1;
        account.totalEarned += bet;
      } else if (outcome === 'loss') {
        account.wallet -= bet;
        account.losses += 1;
        account.totalLost += bet;
      }
      saveData(data);

      const title = outcome === 'win' ? 'You rolled higher' : outcome === 'loss' ? 'Dealer rolled higher' : 'Push';
      const color = outcome === 'win' ? 0x57f287 : outcome === 'loss' ? 0xed4245 : ECONOMY_COLOR;
      await interaction.reply({
        embeds: [economyEmbed(interaction.user, title, `You rolled **${playerRoll}** 🎲\nDealer rolled **${dealerRoll}** 🎲\n\n${outcome === 'win' ? `Won ${formatCoins(bet)}` : outcome === 'loss' ? `Lost ${formatCoins(bet)}` : 'Your bet was returned.'}\nWallet: ${formatCoins(account.wallet)}`).setColor(color)],
      });
      return;
    }

    if (interaction.commandName === 'slots') {
      const symbols = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
      const reels = [symbols[randomInt(0, symbols.length - 1)], symbols[randomInt(0, symbols.length - 1)], symbols[randomInt(0, symbols.length - 1)]];
      let multiplier = 0;

      if (reels.every((symbol) => symbol === '7️⃣')) multiplier = 8;
      else if (reels.every((symbol) => symbol === '💎')) multiplier = 6;
      else if (reels[0] === reels[1] && reels[1] === reels[2]) multiplier = 4;
      else if (new Set(reels).size === 2) multiplier = 1.5;

      const payout = Math.floor(bet * multiplier);
      const profit = payout - bet;
      account.wallet += profit;

      if (profit > 0) {
        account.wins += 1;
        account.totalEarned += profit;
      } else {
        account.losses += 1;
        account.totalLost += bet;
      }
      saveData(data);

      const won = profit > 0;
      const embed = economyEmbed(
        interaction.user,
        multiplier >= 6 ? 'JACKPOT' : won ? 'Winner' : 'No luck',
        `╭────────────╮\n│  ${reels.join('  ')}  │\n╰────────────╯\n\n${won ? `Payout: ${formatCoins(payout)}\nProfit: ${formatCoins(profit)}` : `Lost ${formatCoins(bet)}`}\nWallet: ${formatCoins(account.wallet)}`
      ).setColor(won ? 0x57f287 : 0xed4245);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'blackjack') {
      account.wallet -= bet;
      saveData(data);

      const deck = shuffledDeck();
      const sessionId = `${interaction.id}-${Math.random().toString(36).slice(2, 7)}`;
      const session = {
        id: sessionId,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        bet,
        deck,
        player: [deck.pop(), deck.pop()],
        dealer: [deck.pop(), deck.pop()],
        createdAt: Date.now(),
      };
      blackjackSessions.set(sessionId, session);

      const playerBlackjack = handValue(session.player) === 21;
      if (playerBlackjack) {
        const fresh = loadData();
        const freshAccount = getEconomyUser(fresh, session.guildId, session.userId);
        const payout = Math.floor(bet * 2.5);
        freshAccount.wallet += payout;
        freshAccount.wins += 1;
        freshAccount.totalEarned += payout - bet;
        saveData(fresh);
        blackjackSessions.delete(sessionId);

        await interaction.reply({
          embeds: [blackjackEmbed(session, true, { title: 'Natural blackjack', description: `Paid ${formatCoins(payout)}.`, color: 0x57f287, footer: 'Blackjack pays 3:2.' })],
          components: [blackjackButtons(sessionId, true)],
        });
        return;
      }

      await interaction.reply({
        embeds: [blackjackEmbed(session)],
        components: [blackjackButtons(sessionId)],
      });
    }
  } catch (error) {
    console.error('Economy command error:', error);
    const payload = { content: 'The economy command failed. Check the Render logs.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

// ======================================================
// BLACKJACK BUTTONS
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('bj_')) return;

  const [action, sessionId] = interaction.customId.split(':');
  const session = blackjackSessions.get(sessionId);

  if (!session) {
    await interaction.reply({ content: 'That blackjack game has expired.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.user.id !== session.userId) {
    await interaction.reply({ content: 'This is not your blackjack hand.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (Date.now() - session.createdAt > 5 * 60 * 1000) {
    blackjackSessions.delete(sessionId);
    await interaction.update({ components: [blackjackButtons(sessionId, true)] });
    return;
  }

  if (action === 'bj_hit') {
    session.player.push(session.deck.pop());
    const value = handValue(session.player);

    if (value > 21) {
      const data = loadData();
      const account = getEconomyUser(data, session.guildId, session.userId);
      account.losses += 1;
      account.totalLost += session.bet;
      saveData(data);
      blackjackSessions.delete(sessionId);

      await interaction.update({
        embeds: [blackjackEmbed(session, true, { title: 'Bust', description: `You lost ${formatCoins(session.bet)}.`, color: 0xed4245, footer: 'Better luck next hand.' })],
        components: [blackjackButtons(sessionId, true)],
      });
      return;
    }

    await interaction.update({
      embeds: [blackjackEmbed(session)],
      components: [blackjackButtons(sessionId)],
    });
    return;
  }

  if (action === 'bj_stand') {
    while (handValue(session.dealer) < 17) session.dealer.push(session.deck.pop());

    const playerValue = handValue(session.player);
    const dealerValue = handValue(session.dealer);
    const data = loadData();
    const account = getEconomyUser(data, session.guildId, session.userId);
    let result;

    if (dealerValue > 21 || playerValue > dealerValue) {
      account.wallet += session.bet * 2;
      account.wins += 1;
      account.totalEarned += session.bet;
      result = { title: 'You win', description: `Profit: ${formatCoins(session.bet)}.`, color: 0x57f287, footer: `Wallet: ${account.wallet.toLocaleString('en-GB')} coins` };
    } else if (playerValue === dealerValue) {
      account.wallet += session.bet;
      result = { title: 'Push', description: 'Your bet was returned.', color: ECONOMY_COLOR, footer: `Wallet: ${account.wallet.toLocaleString('en-GB')} coins` };
    } else {
      account.losses += 1;
      account.totalLost += session.bet;
      result = { title: 'Dealer wins', description: `You lost ${formatCoins(session.bet)}.`, color: 0xed4245, footer: `Wallet: ${account.wallet.toLocaleString('en-GB')} coins` };
    }

    saveData(data);
    blackjackSessions.delete(sessionId);

    await interaction.update({
      embeds: [blackjackEmbed(session, true, result)],
      components: [blackjackButtons(sessionId, true)],
    });
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
