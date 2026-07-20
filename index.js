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
  drops: {},
};

function cloneDefaultData() {
  return {
    members: [...defaultData.members],
    panels: [],
    replies: [],
    economy: {},
    drops: {},
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

    if (!parsedData.economy || typeof parsedData.economy !== 'object') parsedData.economy = {};
    if (!parsedData.drops || typeof parsedData.drops !== 'object') parsedData.drops = {};

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

const COIN = '🪙';
const STARTING_WALLET = 500;
const SHOP = {
  fishing_rod: { name: 'Fishing Rod', emoji: '🎣', price: 2500, description: 'Improves fishing rewards.', usable: false },
  pickaxe: { name: 'Pickaxe', emoji: '⛏️', price: 3200, description: 'Improves mining rewards.', usable: false },
  axe: { name: 'Axe', emoji: '🪓', price: 2800, description: 'Improves chopping rewards.', usable: false },
  lucky_charm: { name: 'Lucky Charm', emoji: '🍀', price: 7500, description: 'Small gambling luck boost.', usable: false },
  bank_note: { name: 'Bank Note', emoji: '💵', price: 5000, description: 'Use it to raise bank capacity by 10,000.', usable: true },
  loot_box: { name: 'Loot Box', emoji: '📦', price: 4000, description: 'Use it for a random coin reward.', usable: true },
};

const ACHIEVEMENTS = {
  first_job: ['Clocked In', 'Complete your first work shift.'],
  first_win: ['First Win', 'Win your first gamble.'],
  high_roller: ['High Roller', 'Place a bet of 10,000 coins.'],
  millionaire: ['Millionaire', 'Reach 1,000,000 total coins.'],
  collector: ['Collector', 'Own five different items.'],
  streak7: ['Committed', 'Reach a seven-day daily streak.'],
};

function economyKey(guildId, userId) { return `${guildId}:${userId}`; }
function newEconomyUser() {
  return { wallet: STARTING_WALLET, bank: 0, bankCapacity: 25000, xp: 0, level: 1, inventory: {}, achievements: [], stats: { earned: 0, lost: 0, wins: 0, losses: 0, worked: 0 }, cooldowns: {}, dailyStreak: 0, lastDailyDay: '', lastInterestAt: Date.now() };
}
function getEconomyUser(data, guildId, userId) {
  const key = economyKey(guildId, userId);
  if (!data.economy[key]) data.economy[key] = newEconomyUser();
  const u = data.economy[key];
  u.inventory ||= {}; u.achievements ||= []; u.stats ||= { earned:0,lost:0,wins:0,losses:0,worked:0 }; u.cooldowns ||= {}; u.bankCapacity ||= 25000; u.level ||= 1; u.xp ||= 0; u.lastInterestAt ||= Date.now();
  applyInterest(u);
  return u;
}
function applyInterest(u) {
  const now=Date.now(), day=86400000, elapsed=Math.floor((now-u.lastInterestAt)/day);
  if (elapsed>0 && u.bank>0) { u.bank=Math.min(u.bankCapacity, u.bank + Math.floor(u.bank*0.005*elapsed)); u.lastInterestAt += elapsed*day; }
}
function money(n) { return `${COIN} ${Math.floor(n).toLocaleString('en-GB')}`; }
function randomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function cooldownLeft(u,name,ms){ const left=(u.cooldowns[name]||0)+ms-Date.now(); return Math.max(0,left); }
function setCooldown(u,name){ u.cooldowns[name]=Date.now(); }
function duration(ms){ const s=Math.ceil(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60); return h?`${h}h ${m%60}m`:m?`${m}m ${s%60}s`:`${s}s`; }
function addXp(u, amount) { u.xp += amount; let leveled=false; while(u.xp >= u.level*250){u.xp-=u.level*250;u.level++;leveled=true;} return leveled; }
function unlock(u,id){ if(!u.achievements.includes(id)){u.achievements.push(id);return true;} return false; }
function checkAchievements(u){ const out=[]; if(u.stats.worked>=1&&unlock(u,'first_job'))out.push('Clocked In'); if(u.stats.wins>=1&&unlock(u,'first_win'))out.push('First Win'); if(u.wallet+u.bank>=1000000&&unlock(u,'millionaire'))out.push('Millionaire'); if(Object.keys(u.inventory).filter(k=>u.inventory[k]>0).length>=5&&unlock(u,'collector'))out.push('Collector'); if(u.dailyStreak>=7&&unlock(u,'streak7'))out.push('Committed'); return out; }
function parseAmount(raw, available, min=1){ const v=String(raw).toLowerCase().trim(); let n=v==='all'||v==='max'?available:v==='half'?Math.floor(available/2):Number(v.replace(/,/g,'')); return Number.isSafeInteger(n)&&n>=min&&n<=available?n:null; }
function betOption(o){ return o.setName('bet').setDescription('Amount, all, or half').setRequired(true).setMinLength(1).setMaxLength(20); }
function econEmbed(title, desc){ return new EmbedBuilder().setColor(0xf08a24).setTitle(title).setDescription(desc).setFooter({text:'BKD Economy • Play smart'}); }
function handValue(hand){ let total=hand.reduce((a,c)=>a+(c==='A'?11:['K','Q','J'].includes(c)?10:Number(c)),0), aces=hand.filter(c=>c==='A').length; while(total>21&&aces--){total-=10;} return total; }
function drawCard(){ return ['A','2','3','4','5','6','7','8','9','10','J','Q','K'][randomInt(0,12)]; }
function cardsText(cards, hide=false){ return cards.map((c,i)=>hide&&i===1?'❓':`\`${c}\``).join(' '); }
async function updateRichestRole(guild,data){ try { const entries=Object.entries(data.economy).filter(([k])=>k.startsWith(`${guild.id}:`)); if(!entries.length)return; entries.sort((a,b)=>(b[1].wallet+b[1].bank)-(a[1].wallet+a[1].bank)); const richestId=entries[0][0].split(':')[1]; let role=guild.roles.cache.find(r=>r.name==='Richest'); if(!role) role=await guild.roles.create({name:'Richest',color:0xf1c40f,reason:'BKD Economy richest member role'}); for(const member of role.members.values()) if(member.id!==richestId) await member.roles.remove(role).catch(()=>{}); const winner=await guild.members.fetch(richestId).catch(()=>null); if(winner&&!winner.roles.cache.has(role.id)) await winner.roles.add(role).catch(()=>{}); } catch(e){ console.error('Richest role update:',e.message); } }

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

  new SlashCommandBuilder().setName('economy').setDescription('Shows the complete BKD economy guide').setDMPermission(false),
  new SlashCommandBuilder().setName('balance').setDescription('View a balance').addUserOption(o=>o.setName('user').setDescription('Member to view')).setDMPermission(false),
  new SlashCommandBuilder().setName('profile').setDescription('View an economy profile').addUserOption(o=>o.setName('user').setDescription('Member to view')).setDMPermission(false),
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily coins').setDMPermission(false),
  new SlashCommandBuilder().setName('work').setDescription('Work a shift for coins').setDMPermission(false),
  new SlashCommandBuilder().setName('beg').setDescription('Beg for a few coins').setDMPermission(false),
  new SlashCommandBuilder().setName('fish').setDescription('Go fishing for coins and items').setDMPermission(false),
  new SlashCommandBuilder().setName('mine').setDescription('Mine for coins and gems').setDMPermission(false),
  new SlashCommandBuilder().setName('chop').setDescription('Chop wood for coins').setDMPermission(false),
  new SlashCommandBuilder().setName('pay').setDescription('Pay another member').addUserOption(o=>o.setName('user').setDescription('Who to pay').setRequired(true)).addStringOption(o=>o.setName('amount').setDescription('Amount, all, or half').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('deposit').setDescription('Deposit coins into your bank').addStringOption(o=>o.setName('amount').setDescription('Amount, all, or half').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('withdraw').setDescription('Withdraw coins from your bank').addStringOption(o=>o.setName('amount').setDescription('Amount, all, or half').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View the richest members').setDMPermission(false),
  new SlashCommandBuilder().setName('rob').setDescription('Try to rob another member').addUserOption(o=>o.setName('user').setDescription('Member to rob').setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('coinflip').setDescription('Bet on a coin flip').addStringOption(o=>betOption(o)).addStringOption(o=>o.setName('side').setDescription('Heads or tails').addChoices({name:'Heads',value:'heads'},{name:'Tails',value:'tails'}).setRequired(true)).setDMPermission(false),
  new SlashCommandBuilder().setName('dice').setDescription('Bet that your roll beats the bot').addStringOption(o=>betOption(o)).setDMPermission(false),
  new SlashCommandBuilder().setName('slots').setDescription('Play the BKD slot machine').addStringOption(o=>betOption(o)).setDMPermission(false),
  new SlashCommandBuilder().setName('blackjack').setDescription('Play interactive blackjack').addStringOption(o=>betOption(o)).setDMPermission(false),
  new SlashCommandBuilder().setName('shop').setDescription('View the economy shop').setDMPermission(false),
  new SlashCommandBuilder().setName('buy').setDescription('Buy an item').addStringOption(o=>o.setName('item').setDescription('Shop item').setRequired(true).addChoices(...Object.entries(SHOP).map(([value,x])=>({name:`${x.emoji} ${x.name}`,value})))).addIntegerOption(o=>o.setName('quantity').setDescription('Quantity').setMinValue(1).setMaxValue(25)).setDMPermission(false),
  new SlashCommandBuilder().setName('inventory').setDescription('View an inventory').addUserOption(o=>o.setName('user').setDescription('Member to view')).setDMPermission(false),
  new SlashCommandBuilder().setName('use').setDescription('Use an item').addStringOption(o=>o.setName('item').setDescription('Usable item').setRequired(true).addChoices({name:'💵 Bank Note',value:'bank_note'},{name:'📦 Loot Box',value:'loot_box'})).setDMPermission(false),

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

    const dropKey = `${message.guild.id}:${message.channel.id}`;
    const lastDrop = data.drops[dropKey] || 0;
    if (Date.now() - lastDrop > 3600000 && Math.random() < 0.012) {
      const amount = randomInt(250, 1200);
      data.drops[dropKey] = Date.now();
      saveData(data);
      const dropId = `drop:${message.guild.id}:${amount}:${Date.now()}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(dropId).setLabel('Claim coins').setEmoji('🪙').setStyle(ButtonStyle.Success)
      );
      const dropMessage = await message.channel.send({
        embeds: [econEmbed('Coin Drop', `Someone dropped **${money(amount)}**. First person to claim it keeps it.`)],
        components: [row],
      });
      setTimeout(() => dropMessage.edit({ components: [] }).catch(() => {}), 60000).unref?.();
    }
  } catch (error) {
    console.error('Automatic reply error:', error);
  }
});


// ======================================================
// ECONOMY DROP BUTTONS
// ======================================================

const claimedDrops = new Set();
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || !interaction.customId.startsWith('drop:')) return;
  if (claimedDrops.has(interaction.customId)) {
    return interaction.reply({ content: 'Someone already claimed this drop.', flags: MessageFlags.Ephemeral });
  }
  const [, guildIdFromButton, amountText] = interaction.customId.split(':');
  if (interaction.guildId !== guildIdFromButton) return;
  claimedDrops.add(interaction.customId);
  const amount = Number(amountText);
  const data = loadData();
  const user = getEconomyUser(data, interaction.guildId, interaction.user.id);
  user.wallet += amount;
  user.stats.earned += amount;
  addXp(user, 10);
  checkAchievements(user);
  saveData(data);
  await updateRichestRole(interaction.guild, data);
  await interaction.update({
    embeds: [econEmbed('Coin Drop Claimed', `${interaction.user} grabbed **${money(amount)}**.`)],
    components: [],
  });
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

    // ---------------- ECONOMY ----------------
    const economyCommands = ['economy','balance','profile','daily','work','beg','fish','mine','chop','pay','deposit','withdraw','leaderboard','rob','coinflip','dice','slots','blackjack','shop','buy','inventory','use'];
    if (economyCommands.includes(interaction.commandName)) {
      const data=loadData(), user=getEconomyUser(data,interaction.guild.id,interaction.user.id), name=interaction.commandName;
      const finish=async(payload)=>{ saveData(data); await updateRichestRole(interaction.guild,data); return interaction.reply(payload); };
      if(name==='economy') return interaction.reply({embeds:[econEmbed('BKD Economy','Earn coins, build your inventory and climb the server rankings.\n\n**Earn**\n`/daily` `/work` `/beg` `/fish` `/mine` `/chop`\n\n**Money**\n`/balance` `/profile` `/pay` `/deposit` `/withdraw` `/leaderboard`\n\n**Gamble**\n`/coinflip` `/dice` `/slots` `/blackjack`\n\n**Items**\n`/shop` `/buy` `/inventory` `/use`\n\n**Risk**\n`/rob`\n\nDaily rewards build a streak. Activities give XP. Bank balances earn **0.5% daily interest** up to your capacity. Random coin drops can appear in active chat.')],flags:MessageFlags.Ephemeral});
      if(name==='balance'||name==='profile'||name==='inventory'){
        const target=interaction.options.getUser('user')||interaction.user, u=getEconomyUser(data,interaction.guild.id,target.id);
        if(name==='balance') return finish({embeds:[econEmbed(`${target.username}'s Balance`, `**Wallet** ${money(u.wallet)}\n**Bank** ${money(u.bank)} / ${money(u.bankCapacity)}\n**Total** ${money(u.wallet+u.bank)}`).setThumbnail(target.displayAvatarURL())]});
        if(name==='inventory'){ const rows=Object.entries(u.inventory).filter(([,q])=>q>0).map(([id,q])=>`${SHOP[id]?.emoji||'•'} **${SHOP[id]?.name||id}** ×${q}`); return finish({embeds:[econEmbed(`${target.username}'s Inventory`,rows.join('\n')||'This inventory is empty.')]}); }
        const ach=u.achievements.map(id=>`🏅 ${ACHIEVEMENTS[id]?.[0]||id}`).join('\n')||'None yet';
        return finish({embeds:[econEmbed(`${target.username}'s Economy Profile`, `**Level ${u.level}** • ${u.xp}/${u.level*250} XP\n**Total wealth** ${money(u.wallet+u.bank)}\n**Daily streak** 🔥 ${u.dailyStreak}\n**Gambling** ${u.stats.wins}W / ${u.stats.losses}L\n\n**Achievements**\n${ach}`).setThumbnail(target.displayAvatarURL())]});
      }
      if(name==='daily'){
        const left=cooldownLeft(user,'daily',86400000); if(left) return interaction.reply({content:`Your daily is ready in **${duration(left)}**.`,flags:MessageFlags.Ephemeral});
        const today=new Date().toISOString().slice(0,10), yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10); user.dailyStreak=user.lastDailyDay===yesterday?user.dailyStreak+1:1; user.lastDailyDay=today; const reward=750+Math.min(user.dailyStreak,14)*75; user.wallet+=reward; user.stats.earned+=reward; setCooldown(user,'daily'); addXp(user,35); const a=checkAchievements(user); return finish({embeds:[econEmbed('Daily Claimed',`You received **${money(reward)}**.\nStreak: **${user.dailyStreak} days** 🔥${a.length?`\nUnlocked: ${a.join(', ')}`:''}`)]});
      }
      const activities={work:[3600000,randomInt(450,900),['worked a café shift','delivered packages','helped moderate the server']],beg:[300000,randomInt(30,180),['A stranger felt generous.','Someone tossed you spare change.','You found coins near the pavement.']],fish:[900000,randomInt(250,650),['You caught a fat salmon.','You sold a crate of fish.','You pulled up an old treasure tin.']],mine:[1200000,randomInt(350,800),['You uncovered iron ore.','You found a bright gemstone.','You sold a haul from the mine.']],chop:[900000,randomInt(280,620),['You sold a stack of oak.','You cleared a woodland trail.','You supplied timber to a builder.']]};
      if(activities[name]){ let [cd,reward,msgs]=activities[name]; const left=cooldownLeft(user,name,cd); if(left)return interaction.reply({content:`You can ${name} again in **${duration(left)}**.`,flags:MessageFlags.Ephemeral}); if(name==='fish'&&user.inventory.fishing_rod)reward=Math.floor(reward*1.35); if(name==='mine'&&user.inventory.pickaxe)reward=Math.floor(reward*1.35); if(name==='chop'&&user.inventory.axe)reward=Math.floor(reward*1.35); user.wallet+=reward;user.stats.earned+=reward;if(name==='work')user.stats.worked++;setCooldown(user,name);addXp(user,randomInt(15,35));const a=checkAchievements(user);return finish({embeds:[econEmbed(name[0].toUpperCase()+name.slice(1),`${msgs[randomInt(0,msgs.length-1)]}\nYou earned **${money(reward)}**.${a.length?`\nUnlocked: ${a.join(', ')}`:''}`)]}); }
      if(name==='deposit'||name==='withdraw') { const source=name==='deposit'?user.wallet:user.bank, amt=parseAmount(interaction.options.getString('amount'),source); if(!amt)return interaction.reply({content:'Enter a valid amount you can afford.',flags:MessageFlags.Ephemeral}); if(name==='deposit'&&user.bank+amt>user.bankCapacity)return interaction.reply({content:`Your bank only has room for ${money(user.bankCapacity-user.bank)}.`,flags:MessageFlags.Ephemeral}); if(name==='deposit'){user.wallet-=amt;user.bank+=amt;}else{user.bank-=amt;user.wallet+=amt;} return finish({embeds:[econEmbed(name==='deposit'?'Deposit Complete':'Withdrawal Complete',`${money(amt)} moved successfully.\nWallet: **${money(user.wallet)}**\nBank: **${money(user.bank)}**`)]}); }
      if(name==='pay'){ const target=interaction.options.getUser('user',true); if(target.bot||target.id===interaction.user.id)return interaction.reply({content:'Choose another real member.',flags:MessageFlags.Ephemeral}); const amt=parseAmount(interaction.options.getString('amount'),user.wallet); if(!amt)return interaction.reply({content:'Enter a valid amount you can afford.',flags:MessageFlags.Ephemeral}); const other=getEconomyUser(data,interaction.guild.id,target.id);user.wallet-=amt;other.wallet+=amt;return finish({embeds:[econEmbed('Payment Sent',`You sent ${target} **${money(amt)}**.`)]}); }
      if(name==='leaderboard'){ const rows=Object.entries(data.economy).filter(([k])=>k.startsWith(`${interaction.guild.id}:`)).sort((a,b)=>(b[1].wallet+b[1].bank)-(a[1].wallet+a[1].bank)).slice(0,10); const lines=await Promise.all(rows.map(async([k,u],i)=>{const id=k.split(':')[1],m=await interaction.guild.members.fetch(id).catch(()=>null);return `**${i+1}.** ${m||`<@${id}>`} — ${money(u.wallet+u.bank)}`;}));return finish({embeds:[econEmbed('Richest Members',lines.join('\n')||'No economy users yet.')]}); }
      if(name==='rob'){ const target=interaction.options.getUser('user',true); if(target.bot||target.id===interaction.user.id)return interaction.reply({content:'Choose another real member.',flags:MessageFlags.Ephemeral}); const left=cooldownLeft(user,'rob',14400000);if(left)return interaction.reply({content:`You can rob again in **${duration(left)}**.`,flags:MessageFlags.Ephemeral});const victim=getEconomyUser(data,interaction.guild.id,target.id);if(victim.wallet<500)return interaction.reply({content:'That member does not have enough wallet cash to rob.',flags:MessageFlags.Ephemeral});setCooldown(user,'rob');if(Math.random()<0.42){const stolen=Math.min(victim.wallet,randomInt(150,Math.max(151,Math.floor(victim.wallet*.25))));victim.wallet-=stolen;user.wallet+=stolen;user.stats.earned+=stolen;return finish({embeds:[econEmbed('Robbery Successful',`You stole **${money(stolen)}** from ${target}.`)]});}const fine=Math.min(user.wallet,randomInt(100,400));user.wallet-=fine;user.stats.lost+=fine;return finish({embeds:[econEmbed('Robbery Failed',`You were caught and fined **${money(fine)}**.`)]}); }
      if(name==='shop') return interaction.reply({embeds:[econEmbed('BKD Shop',Object.entries(SHOP).map(([id,x])=>`${x.emoji} **${x.name}** — ${money(x.price)}\n${x.description}\nBuy: \`/buy item:${id}\``).join('\n\n'))]});
      if(name==='buy'){const id=interaction.options.getString('item',true),q=interaction.options.getInteger('quantity')||1,item=SHOP[id],cost=item.price*q;if(user.wallet<cost)return interaction.reply({content:`You need ${money(cost)} in your wallet.`,flags:MessageFlags.Ephemeral});user.wallet-=cost;user.inventory[id]=(user.inventory[id]||0)+q;const a=checkAchievements(user);return finish({embeds:[econEmbed('Purchase Complete',`${item.emoji} Bought **${q}× ${item.name}** for ${money(cost)}.${a.length?`\nUnlocked: ${a.join(', ')}`:''}`)]});}
      if(name==='use'){const id=interaction.options.getString('item',true),item=SHOP[id];if(!user.inventory[id])return interaction.reply({content:`You do not own a ${item.name}.`,flags:MessageFlags.Ephemeral});user.inventory[id]--;let text='';if(id==='bank_note'){user.bankCapacity+=10000;text=`Bank capacity increased to **${money(user.bankCapacity)}**.`;}else{const reward=randomInt(1200,9000);user.wallet+=reward;user.stats.earned+=reward;text=`The box contained **${money(reward)}**.`;}return finish({embeds:[econEmbed(`Used ${item.name}`,text)]});}
      if(['coinflip','dice','slots','blackjack'].includes(name)){
        const bet=parseAmount(interaction.options.getString('bet'),user.wallet,10);if(!bet)return interaction.reply({content:'Enter a valid bet of at least 10 coins that you can afford.',flags:MessageFlags.Ephemeral});user.wallet-=bet;if(bet>=10000)unlock(user,'high_roller');
        const settle=async(win,payout,text)=>{if(win){user.wallet+=payout;user.stats.wins++;user.stats.earned+=Math.max(0,payout-bet);}else{user.stats.losses++;user.stats.lost+=bet;}addXp(user,randomInt(5,18));checkAchievements(user);return finish({embeds:[econEmbed(text,`${win?'You won':'You lost'} **${money(win?payout-bet:bet)}**.\nWallet: **${money(user.wallet)}**`)]});};
        if(name==='coinflip'){const pick=interaction.options.getString('side',true),result=Math.random()<.5?'heads':'tails',win=pick===result;return settle(win,bet*2,`${result==='heads'?'🪙 Heads':'🪙 Tails'}`);}
        if(name==='dice'){const you=randomInt(1,6),bot=randomInt(1,6),win=you>bot,payout=you===bot?bet:win?bet*2:0;if(you===bot){user.wallet+=bet;saveData(data);return interaction.reply({embeds:[econEmbed('Dice Draw',`You rolled **${you}**. The bot rolled **${bot}**.\nYour bet was returned.`)]});}return settle(win,payout,`Dice • ${you} vs ${bot}`);}
        if(name==='slots'){const icons=['🍒','🍋','🍇','🔔','💎','7️⃣'],r=[icons[randomInt(0,5)],icons[randomInt(0,5)],icons[randomInt(0,5)]],three=r[0]===r[1]&&r[1]===r[2],two=r[0]===r[1]||r[1]===r[2]||r[0]===r[2],multi=three?(r[0]==='7️⃣'?12:r[0]==='💎'?8:5):two?1.5:0;return settle(multi>0,Math.floor(bet*multi),`┃ ${r.join(' │ ')} ┃`);}
        const player=[drawCard(),drawCard()],dealer=[drawCard(),drawCard()],gameId=`bj:${interaction.id}`;const row=(disabled=false)=>new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${gameId}:hit`).setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(disabled),new ButtonBuilder().setCustomId(`${gameId}:stand`).setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(disabled));const gameEmbed=(hide=true,note='Choose Hit or Stand.')=>econEmbed('Blackjack',`**Dealer** ${cardsText(dealer,hide)}${hide?` + ?`:` = ${handValue(dealer)}`}\n**You** ${cardsText(player)} = ${handValue(player)}\n\n${note}`);await interaction.reply({embeds:[gameEmbed()],components:[row()]});const msg=await interaction.fetchReply();const collector=msg.createMessageComponentCollector({filter:i=>i.user.id===interaction.user.id&&i.customId.startsWith(gameId),time:60000});collector.on('collect',async i=>{if(i.customId.endsWith(':hit'))player.push(drawCard());if(handValue(player)>21){collector.stop('bust');return i.update({embeds:[gameEmbed(false,`Bust. You lost ${money(bet)}.`)],components:[row(true)]});}if(i.customId.endsWith(':stand')){while(handValue(dealer)<17)dealer.push(drawCard());collector.stop('stand');const pv=handValue(player),dv=handValue(dealer),win=dv>21||pv>dv,draw=pv===dv;if(draw){user.wallet+=bet;}else if(win){user.wallet+=bet*2;user.stats.wins++;user.stats.earned+=bet;}else{user.stats.losses++;user.stats.lost+=bet;}saveData(data);await updateRichestRole(interaction.guild,data);return i.update({embeds:[gameEmbed(false,draw?'Push — your bet was returned.':win?`You win ${money(bet)}.`:`Dealer wins. You lost ${money(bet)}.`)],components:[row(true)]});}await i.update({embeds:[gameEmbed()],components:[row()]});});collector.on('end',(_,reason)=>{if(reason==='time')msg.edit({embeds:[gameEmbed(false,`Game expired. You lost ${money(bet)}.`)],components:[row(true)]}).catch(()=>{});saveData(data);});return;
      }
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
