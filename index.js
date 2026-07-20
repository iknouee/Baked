const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');

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
  intents: [GatewayIntentBits.Guilds],
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
// UPDATE ALL POSTED EMBEDS
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
// SLASH COMMANDS
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
].map((command) => command.toJSON());

// ======================================================
// REGISTER COMMANDS
// ======================================================

async function registerCommands() {
  const rest = new REST({
    version: '10',
  }).setToken(token);

  try {
    console.log('Registering slash commands...');

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

      console.log('Global slash commands registered.');
    }
  } catch (error) {
    console.error(
      'Failed to register slash commands:',
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
// COMMAND HANDLER
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

      const panelAlreadyExists = data.panels.some(
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
          `The Baked member roster was posted in ` +
          `${selectedChannel}.`,
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
            `**${formattedName}** is already on the ` +
            'Baked roster.',
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
            `I could not find **${selectedMember}** ` +
            'on the Baked roster.',
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
