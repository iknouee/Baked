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
  GlobalFonts,
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
const port = process.env.PORT || 10000;

if (!token || !clientId) {
  console.error(
    'Missing DISCORD_TOKEN or CLIENT_ID environment variable.'
  );

  process.exit(1);
}

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
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
};

function createDataFile() {
  if (fs.existsSync(dataFile)) return;

  fs.writeFileSync(
    dataFile,
    JSON.stringify(defaultData, null, 2),
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

    return parsedData;
  } catch (error) {
    console.error('Failed to read baked-data.json:', error);

    const restoredData = {
      members: [...defaultData.members],
      panels: [],
    };

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
// MEMBER NAME FORMATTING
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

// ======================================================
// MEMBER EMBED
// ======================================================

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
    if (memberList.length === 0) {
      return '—';
    }

    return memberList
      .map((member, index) => {
        const number = String(startIndex + index + 1).padStart(
          2,
          '0'
        );

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
    .setDescription(
      [
        'The official people representing **Baked**.',
        '',
        '━━━━━━━━━━━━━━━━━━━━',
      ].join('\n')
    )
    .addFields(
      {
        name: 'MEMBERS',
        value: formatMemberColumn(leftMembers, 0),
        inline: true,
      },
      {
        name: '\u200B',
        value: formatMemberColumn(
          rightMembers,
          midpoint
        ),
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

// ======================================================
// UPDATE ALL POSTED ROSTER EMBEDS
// ======================================================

async function updateAllMemberPanels(guild) {
  const data = loadData();
  const activePanels = [];

  for (const panel of data.panels) {
    if (panel.guildId !== guild.id) {
      activePanels.push(panel);
      continue;
    }

    try {
      const channel = await guild.channels.fetch(
        panel.channelId
      );

      if (!channel || !channel.isTextBased()) {
        continue;
      }

      const message = await channel.messages.fetch(
        panel.messageId
      );

      await message.edit({
        embeds: [createBakedMembersEmbed(guild)],
      });

      activePanels.push(panel);
    } catch (error) {
      console.log(
        `Removing expired member panel ${panel.messageId}.`
      );
    }
  }

  data.panels = activePanels;
  saveData(data);
}

// ======================================================
// QUOTE IMAGE HELPERS
// ======================================================

function roundedRectangle(
  context,
  x,
  y,
  width,
  height,
  radius
) {
  const safeRadius = Math.min(
    radius,
    width / 2,
    height / 2
  );

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius
  );
  context.lineTo(
    x + width,
    y + height - safeRadius
  );
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - safeRadius
  );
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y
  );
  context.closePath();
}

function drawCircleImage(
  context,
  image,
  x,
  y,
  size
) {
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
  if (!content) {
    return '';
  }

  return content
    .replace(
      /<a?:([a-zA-Z0-9_]+):\d+>/g,
      ':$1:'
    )
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

function splitLongWord(
  context,
  word,
  maximumWidth
) {
  const pieces = [];
  let currentPiece = '';

  for (const character of word) {
    const testPiece = currentPiece + character;

    if (
      context.measureText(testPiece).width >
        maximumWidth &&
      currentPiece
    ) {
      pieces.push(currentPiece);
      currentPiece = character;
    } else {
      currentPiece = testPiece;
    }
  }

  if (currentPiece) {
    pieces.push(currentPiece);
  }

  return pieces;
}

function wrapText(
  context,
  text,
  maximumWidth
) {
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
      if (
        context.measureText(word).width >
        maximumWidth
      ) {
        words.push(
          ...splitLongWord(
            context,
            word,
            maximumWidth
          )
        );
      } else {
        words.push(word);
      }
    }

    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine
        ? `${currentLine} ${word}`
        : word;

      if (
        context.measureText(testLine).width >
          maximumWidth &&
        currentLine
      ) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function truncateLines(
  context,
  lines,
  maximumLines,
  maximumWidth
) {
  if (lines.length <= maximumLines) {
    return lines;
  }

  const shortenedLines = lines.slice(0, maximumLines);
  let finalLine = shortenedLines[maximumLines - 1];

  while (
    context.measureText(`${finalLine}…`).width >
      maximumWidth &&
    finalLine.length > 0
  ) {
    finalLine = finalLine.slice(0, -1);
  }

  shortenedLines[maximumLines - 1] =
    `${finalLine.trim()}…`;

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

function getFirstImageAttachment(message) {
  return message.attachments.find((attachment) => {
    const contentType =
      attachment.contentType?.toLowerCase() || '';

    return (
      contentType.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif)$/i.test(
        attachment.name || ''
      )
    );
  });
}

async function safelyLoadImage(url) {
  if (!url) return null;

  try {
    return await loadImage(url);
  } catch (error) {
    console.error(
      `Unable to load image ${url}:`,
      error.message
    );

    return null;
  }
}

async function createQuoteImage(
  message,
  guild
) {
  const canvasWidth = 1200;
  const horizontalPadding = 78;
  const contentWidth =
    canvasWidth - horizontalPadding * 2;

  const authorMember = message.member;

  const displayName =
    authorMember?.displayName ||
    message.author.globalName ||
    message.author.username;

  const username = `@${message.author.username}`;

  let messageContent = cleanMessageContent(
    message.content
  );

  if (!messageContent) {
    if (message.stickers.size > 0) {
      messageContent = `[Sticker: ${
        message.stickers.first().name
      }]`;
    } else if (message.attachments.size > 0) {
      messageContent = 'Shared an attachment';
    } else {
      messageContent = 'No text content';
    }
  }

  const avatarUrl =
    message.author.displayAvatarURL({
      extension: 'png',
      size: 256,
      forceStatic: true,
    });

  const guildIconUrl = guild.iconURL({
    extension: 'png',
    size: 256,
  });

  const imageAttachment =
    getFirstImageAttachment(message);

  const avatarImage =
    await safelyLoadImage(avatarUrl);

  const guildIcon =
    await safelyLoadImage(guildIconUrl);

  const attachedImage = imageAttachment
    ? await safelyLoadImage(imageAttachment.url)
    : null;

  const measurementCanvas = createCanvas(
    canvasWidth,
    500
  );

  const measurementContext =
    measurementCanvas.getContext('2d');

  measurementContext.font =
    '600 40px Arial, sans-serif';

  let messageLines = wrapText(
    measurementContext,
    messageContent,
    contentWidth - 100
  );

  messageLines = truncateLines(
    measurementContext,
    messageLines,
    attachedImage ? 8 : 12,
    contentWidth - 100
  );

  const lineHeight = 58;
  const textAreaHeight = Math.max(
    100,
    messageLines.length * lineHeight
  );

  let attachmentHeight = 0;
  let attachmentWidth = 0;

  if (attachedImage) {
    const maximumAttachmentWidth =
      contentWidth - 100;

    const maximumAttachmentHeight = 470;

    const imageRatio =
      attachedImage.width / attachedImage.height;

    attachmentWidth = maximumAttachmentWidth;
    attachmentHeight =
      attachmentWidth / imageRatio;

    if (
      attachmentHeight >
      maximumAttachmentHeight
    ) {
      attachmentHeight =
        maximumAttachmentHeight;
      attachmentWidth =
        attachmentHeight * imageRatio;
    }
  }

  const headerHeight = 190;
  const quoteTopPadding = 45;
  const quoteBottomPadding = 55;

  const imageSpacing =
    attachedImage ? 35 : 0;

  const cardHeight =
    headerHeight +
    quoteTopPadding +
    textAreaHeight +
    imageSpacing +
    attachmentHeight +
    quoteBottomPadding;

  const footerHeight = 105;
  const canvasHeight =
    cardHeight + footerHeight + 80;

  const canvas = createCanvas(
    canvasWidth,
    canvasHeight
  );

  const context = canvas.getContext('2d');

  // ----------------------------------------------------
  // BACKGROUND
  // ----------------------------------------------------

  const backgroundGradient =
    context.createLinearGradient(
      0,
      0,
      canvasWidth,
      canvasHeight
    );

  backgroundGradient.addColorStop(
    0,
    '#09090b'
  );

  backgroundGradient.addColorStop(
    0.55,
    '#111114'
  );

  backgroundGradient.addColorStop(
    1,
    '#1f130b'
  );

  context.fillStyle = backgroundGradient;
  context.fillRect(
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  // Decorative glow
  const glow = context.createRadialGradient(
    canvasWidth - 130,
    80,
    0,
    canvasWidth - 130,
    80,
    480
  );

  glow.addColorStop(
    0,
    'rgba(240, 138, 36, 0.24)'
  );

  glow.addColorStop(
    1,
    'rgba(240, 138, 36, 0)'
  );

  context.fillStyle = glow;
  context.fillRect(
    0,
    0,
    canvasWidth,
    canvasHeight
  );

  // Subtle background texture
  context.globalAlpha = 0.045;
  context.fillStyle = '#ffffff';

  for (let x = -canvasHeight; x < canvasWidth; x += 52) {
    context.save();
    context.translate(x, 0);
    context.rotate(-0.35);
    context.fillRect(
      0,
      0,
      2,
      canvasHeight * 2
    );
    context.restore();
  }

  context.globalAlpha = 1;

  // ----------------------------------------------------
  // MAIN CARD SHADOW
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // MAIN CARD
  // ----------------------------------------------------

  roundedRectangle(
    context,
    42,
    38,
    canvasWidth - 84,
    cardHeight,
    32
  );

  const cardGradient =
    context.createLinearGradient(
      42,
      38,
      canvasWidth - 42,
      cardHeight
    );

  cardGradient.addColorStop(
    0,
    '#1c1c21'
  );

  cardGradient.addColorStop(
    1,
    '#141417'
  );

  context.fillStyle = cardGradient;
  context.fill();

  context.strokeStyle =
    'rgba(255, 255, 255, 0.08)';

  context.lineWidth = 2;
  context.stroke();

  // Accent bar
  const accentGradient =
    context.createLinearGradient(
      42,
      0,
      canvasWidth - 42,
      0
    );

  accentGradient.addColorStop(
    0,
    '#f08a24'
  );

  accentGradient.addColorStop(
    0.55,
    '#ffb45f'
  );

  accentGradient.addColorStop(
    1,
    '#f08a24'
  );

  context.save();

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
  context.restore();

  // ----------------------------------------------------
  // AUTHOR HEADER
  // ----------------------------------------------------

  const avatarSize = 94;
  const avatarX = 92;
  const avatarY = 92;

  if (avatarImage) {
    context.save();

    context.shadowColor =
      'rgba(240, 138, 36, 0.45)';
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
  } else {
    context.beginPath();
    context.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2
    );

    context.fillStyle = '#2b2b31';
    context.fill();

    context.fillStyle = '#f08a24';
    context.font =
      '700 38px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    context.fillText(
      displayName.charAt(0).toUpperCase(),
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2 + 2
    );

    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
  }

  context.fillStyle = '#ffffff';
  context.font =
    '700 38px Arial, sans-serif';

  context.fillText(
    displayName,
    avatarX + avatarSize + 28,
    avatarY + 38
  );

  context.fillStyle = '#9b9ba5';
  context.font =
    '500 25px Arial, sans-serif';

  context.fillText(
    username,
    avatarX + avatarSize + 28,
    avatarY + 76
  );

  // QUOTED badge
  const badgeText = 'QUOTED';
  context.font =
    '700 18px Arial, sans-serif';

  const badgeWidth =
    context.measureText(badgeText).width + 34;

  const badgeX =
    canvasWidth - 92 - badgeWidth;

  roundedRectangle(
    context,
    badgeX,
    106,
    badgeWidth,
    40,
    20
  );

  context.fillStyle =
    'rgba(240, 138, 36, 0.14)';
  context.fill();

  context.strokeStyle =
    'rgba(240, 138, 36, 0.45)';
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = '#ffac58';
  context.fillText(
    badgeText,
    badgeX + 17,
    133
  );

  // ----------------------------------------------------
  // DIVIDER
  // ----------------------------------------------------

  context.beginPath();
  context.moveTo(
    horizontalPadding,
    headerHeight + 24
  );

  context.lineTo(
    canvasWidth - horizontalPadding,
    headerHeight + 24
  );

  context.strokeStyle =
    'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 2;
  context.stroke();

  // ----------------------------------------------------
  // QUOTE MARK
  // ----------------------------------------------------

  context.fillStyle =
    'rgba(240, 138, 36, 0.24)';

  context.font =
    '700 105px Georgia, serif';

  context.fillText(
    '“',
    horizontalPadding + 5,
    headerHeight + 118
  );

  // ----------------------------------------------------
  // MESSAGE TEXT
  // ----------------------------------------------------

  const textX = horizontalPadding + 80;
  let textY =
    headerHeight + quoteTopPadding + 50;

  context.fillStyle = '#f3f3f5';
  context.font =
    '600 40px Arial, sans-serif';

  for (const line of messageLines) {
    context.fillText(
      line,
      textX,
      textY
    );

    textY += lineHeight;
  }

  // ----------------------------------------------------
  // ATTACHED IMAGE
  // ----------------------------------------------------

  if (attachedImage) {
    const imageX =
      horizontalPadding +
      (contentWidth - attachmentWidth) / 2;

    const imageY =
      headerHeight +
      quoteTopPadding +
      textAreaHeight +
      imageSpacing;

    context.save();

    roundedRectangle(
      context,
      imageX,
      imageY,
      attachmentWidth,
      attachmentHeight,
      24
    );

    context.clip();

    context.drawImage(
      attachedImage,
      imageX,
      imageY,
      attachmentWidth,
      attachmentHeight
    );

    context.restore();

    roundedRectangle(
      context,
      imageX,
      imageY,
      attachmentWidth,
      attachmentHeight,
      24
    );

    context.strokeStyle =
      'rgba(255, 255, 255, 0.10)';

    context.lineWidth = 2;
    context.stroke();
  }

  // ----------------------------------------------------
  // FOOTER
  // ----------------------------------------------------

  const footerY = cardHeight + 75;

  if (guildIcon) {
    drawCircleImage(
      context,
      guildIcon,
      67,
      footerY - 18,
      46
    );
  }

  context.fillStyle = '#eeeeef';
  context.font =
    '700 22px Arial, sans-serif';

  const serverTextX = guildIcon
    ? 128
    : 72;

  context.fillText(
    guild.name,
    serverTextX,
    footerY + 13
  );

  context.fillStyle = '#85858f';
  context.font =
    '500 20px Arial, sans-serif';

  const channelName =
    message.channel?.name || 'unknown-channel';

  context.fillText(
    `#${channelName}  •  ${formatQuoteDate(
      message.createdAt
    )}`,
    serverTextX,
    footerY + 45
  );

  context.textAlign = 'right';

  context.fillStyle = '#f08a24';
  context.font =
    '800 25px Arial, sans-serif';

  context.fillText(
    'BKD',
    canvasWidth - 70,
    footerY + 10
  );

  context.fillStyle = '#85858f';
  context.font =
    '600 18px Arial, sans-serif';

  context.fillText(
    'BAKED QUOTES',
    canvasWidth - 70,
    footerY + 41
  );

  context.textAlign = 'left';

  return canvas.toBuffer('image/png');
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
        .setDescription(
          'Choose where the member roster should be posted'
        )
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
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
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
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
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
    .setDMPermission(false),

  new ContextMenuCommandBuilder()
    .setName('Make Quote')
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),
].map((command) => command.toJSON());

// ======================================================
// REGISTER COMMANDS
// ======================================================

async function registerCommands() {
  const rest = new REST({
    version: '10',
  }).setToken(token);

  try {
    console.log('Registering application commands...');

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(
          clientId,
          guildId
        ),
        {
          body: commands,
        }
      );

      console.log(
        `Commands registered in server ${guildId}.`
      );
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        {
          body: commands,
        }
      );

      console.log(
        'Global application commands registered.'
      );
    }
  } catch (error) {
    console.error(
      'Failed to register application commands:',
      error
    );

    throw error;
  }
}

// ======================================================
// BOT READY
// ======================================================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  console.log(
    `Connected to ${client.guilds.cache.size} server(s).`
  );
});

// ======================================================
// AUTOCOMPLETE
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  if (
    interaction.commandName !== 'removebakedmember'
  ) {
    return;
  }

  try {
    const searchText = interaction.options
      .getFocused()
      .toUpperCase();

    const data = loadData();

    const results = data.members
      .filter((member) =>
        member.toUpperCase().includes(searchText)
      )
      .slice(0, 25)
      .map((member) => ({
        name: member,
        value: member,
      }));

    await interaction.respond(results);
  } catch (error) {
    console.error('Autocomplete error:', error);

    await interaction.respond([]).catch(() => {});
  }
});

// ======================================================
// MESSAGE CONTEXT MENU: MAKE QUOTE
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand()) {
    return;
  }

  if (interaction.commandName !== 'Make Quote') {
    return;
  }

  await interaction.deferReply();

  try {
    const message = interaction.targetMessage;

    if (!interaction.guild) {
      await interaction.editReply({
        content:
          'Quotes can only be created inside a server.',
      });

      return;
    }

    if (message.author.bot) {
      await interaction.editReply({
        content:
          'You cannot create a quote from a bot message.',
      });

      return;
    }

    const hasUsefulContent =
      Boolean(message.content?.trim()) ||
      message.attachments.size > 0 ||
      message.stickers.size > 0;

    if (!hasUsefulContent) {
      await interaction.editReply({
        content:
          'That message does not contain anything I can quote.',
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

    const quoteAttachment =
      new AttachmentBuilder(quoteBuffer, {
        name: `quote-${safeUsername || 'member'}.png`,
        description:
          `A quote from ${message.author.username}`,
      });

    const messageLinkButton =
      new ButtonBuilder()
        .setLabel('View Original')
        .setStyle(ButtonStyle.Link)
        .setURL(message.url);

    const row = new ActionRowBuilder().addComponents(
      messageLinkButton
    );

    await interaction.editReply({
      files: [quoteAttachment],
      components: [row],
    });
  } catch (error) {
    console.error(
      'Failed to create quote:',
      error
    );

    await interaction.editReply({
      content:
        'I could not create that quote image. Check the Render logs for the error.',
      files: [],
      components: [],
    });
  }
});

// ======================================================
// SLASH COMMAND HANDLER
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    // --------------------------------------------------
    // /bing
    // --------------------------------------------------

    if (interaction.commandName === 'bing') {
      await interaction.reply('bong');
      return;
    }

    // --------------------------------------------------
    // /bakedmembers
    // --------------------------------------------------

    if (interaction.commandName === 'bakedmembers') {
      const selectedChannel =
        interaction.options.getChannel(
          'channel',
          true
        );

      if (!selectedChannel.isTextBased()) {
        await interaction.reply({
          content:
            'That channel cannot receive messages.',
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      const botMember = interaction.guild.members.me;

      const permissions =
        selectedChannel.permissionsFor(botMember);

      const missingPermissions = [];

      if (
        !permissions?.has(
          PermissionFlagsBits.ViewChannel
        )
      ) {
        missingPermissions.push('View Channel');
      }

      if (
        !permissions?.has(
          PermissionFlagsBits.SendMessages
        )
      ) {
        missingPermissions.push('Send Messages');
      }

      if (
        !permissions?.has(
          PermissionFlagsBits.EmbedLinks
        )
      ) {
        missingPermissions.push('Embed Links');
      }

      if (missingPermissions.length > 0) {
        await interaction.reply({
          content:
            `I cannot post in ${selectedChannel}.\n` +
            `Missing permissions: **${missingPermissions.join(
              ', '
            )}**`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      const postedMessage =
        await selectedChannel.send({
          embeds: [
            createBakedMembersEmbed(
              interaction.guild
            ),
          ],
        });

      const data = loadData();

      const panelAlreadyExists =
        data.panels.some(
          (panel) =>
            panel.messageId === postedMessage.id
        );

      if (!panelAlreadyExists) {
        data.panels.push({
          guildId: interaction.guild.id,
          channelId: selectedChannel.id,
          messageId: postedMessage.id,
        });

        saveData(data);
      }

      await interaction.reply({
        content:
          `The Baked member roster was posted in ${selectedChannel}.`,
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    // --------------------------------------------------
    // /addbakedmember
    // --------------------------------------------------

    if (
      interaction.commandName === 'addbakedmember'
    ) {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const providedName =
        interaction.options.getString(
          'name',
          true
        );

      const formattedName =
        formatMemberName(providedName);

      if (
        formattedName === 'BKD' ||
        formattedName.length < 4
      ) {
        await interaction.editReply({
          content:
            'Please enter a valid member name.',
        });

        return;
      }

      const data = loadData();

      const alreadyExists = data.members.some(
        (member) =>
          member.toUpperCase() ===
          formattedName.toUpperCase()
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

      await updateAllMemberPanels(
        interaction.guild
      );

      const confirmationEmbed =
        new EmbedBuilder()
          .setColor(0x57f287)
          .setAuthor({
            name: 'BKD • ROSTER UPDATED',
            iconURL:
              interaction.guild.iconURL({
                extension: 'png',
                size: 256,
              }) || undefined,
          })
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
          });

      await interaction.editReply({
        embeds: [confirmationEmbed],
      });

      return;
    }

    // --------------------------------------------------
    // /removebakedmember
    // --------------------------------------------------

    if (
      interaction.commandName ===
      'removebakedmember'
    ) {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const selectedMember =
        interaction.options.getString(
          'member',
          true
        );

      const data = loadData();

      const memberIndex = data.members.findIndex(
        (member) =>
          member.toUpperCase() ===
          selectedMember.toUpperCase()
      );

      if (memberIndex === -1) {
        await interaction.editReply({
          content:
            `I could not find **${selectedMember}** on the Baked roster.`,
        });

        return;
      }

      const [removedMember] = data.members.splice(
        memberIndex,
        1
      );

      saveData(data);

      await updateAllMemberPanels(
        interaction.guild
      );

      const confirmationEmbed =
        new EmbedBuilder()
          .setColor(0xed4245)
          .setAuthor({
            name: 'BKD • ROSTER UPDATED',
            iconURL:
              interaction.guild.iconURL({
                extension: 'png',
                size: 256,
              }) || undefined,
          })
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
          });

      await interaction.editReply({
        embeds: [confirmationEmbed],
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

const server = http.createServer(
  (request, response) => {
    response.writeHead(200, {
      'Content-Type': 'text/plain',
    });

    response.end(
      client.isReady()
        ? `BKD bot is online as ${client.user.tag}.`
        : 'BKD bot is starting...'
    );
  }
);

server.listen(port, '0.0.0.0', () => {
  console.log(
    `Web server listening on port ${port}.`
  );
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
