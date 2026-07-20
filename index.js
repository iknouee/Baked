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
// BAKED DATA
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

  /*
   * Every embed posted with /bakedmembers is stored here.
   * When someone is added or removed, these embeds update.
   */
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
    const fileContents = fs.readFileSync(dataFile, 'utf8');
    const parsedData = JSON.parse(fileContents);

    if (!Array.isArray(parsedData.members)) {
      parsedData.members = [...defaultData.members];
    }

    if (!Array.isArray(parsedData.panels)) {
      parsedData.panels = [];
    }

    return parsedData;
  } catch (error) {
    console.error('Failed to read baked-data.json:', error);

    saveData(defaultData);

    return {
      members: [...defaultData.members],
      panels: [],
    };
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
// EMBED
// ======================================================

function createBakedMembersEmbed(guild) {
  const data = loadData();
  const members = data.members;

  const memberList =
    members.length > 0
      ? members
          .map((member, index) => {
            const number = String(index + 1).padStart(2, '0');

            return `\`${number}\`  **${member}**`;
          })
          .join('\n')
      : '*No members have been added yet.*';

  const guildIcon = guild.iconURL({
    extension: 'png',
    size: 512,
  });

  const embed = new EmbedBuilder()
    .setColor(0xe78b32)
    .setAuthor({
      name: 'BAKED',
      iconURL: guildIcon || undefined,
    })
    .setTitle('Official BKD Members')
    .setDescription(
      [
        'The official member list for **Baked**.',
        '',
        memberList,
      ].join('\n')
    )
    .setFooter({
      text: `${members.length} ${
        members.length === 1 ? 'member' : 'members'
      } • BKD stands for Baked`,
    })
    .setTimestamp();

  if (guildIcon) {
    embed.setThumbnail(guildIcon);
  }

  return embed;
}

// ======================================================
// UPDATE ALL POSTED MEMBER EMBEDS
// ======================================================

async function updateAllMemberPanels(guild) {
  const data = loadData();
  const workingPanels = [];

  for (const panel of data.panels) {
    try {
      const channel = await guild.channels.fetch(panel.channelId);

      if (!channel || !channel.isTextBased()) {
        continue;
      }

      const message = await channel.messages.fetch(panel.messageId);

      await message.edit({
        embeds: [createBakedMembersEmbed(guild)],
      });

      workingPanels.push(panel);
    } catch (error) {
      /*
       * The channel or message may have been deleted.
       * Dead panel entries are automatically removed.
       */
      console.log(
        `Removing an expired member panel: ${panel.messageId}`
      );
    }
  }

  data.panels = workingPanels;
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
    .setDescription('Posts the official Baked member list')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Where should the member list be posted?')
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
    .setDescription('Adds someone to the Baked member list')
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
    .setDescription('Removes someone from the Baked member list')
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
// COMMAND REGISTRATION
// ======================================================

async function registerCommands() {
  const rest = new REST({
    version: '10',
  }).setToken(token);

  try {
    console.log('Registering slash commands...');

    if (guildId) {
      /*
       * Guild commands normally appear within seconds.
       * Recommended while testing.
       */
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        {
          body: commands,
        }
      );

      console.log(
        `Slash commands registered in server ${guildId}.`
      );
    } else {
      /*
       * Global commands can take longer to refresh.
       */
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });

      console.log('Global slash commands registered.');
    }
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    throw error;
  }
}

// ======================================================
// BOT READY
// ======================================================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Connected to ${client.guilds.cache.size} server(s).`);
});

// ======================================================
// AUTOCOMPLETE
// ======================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  if (interaction.commandName !== 'removebakedmember') return;

  try {
    const focusedValue = interaction.options
      .getFocused()
      .toUpperCase();

    const data = loadData();

    const choices = data.members
      .filter((member) =>
        member.toUpperCase().includes(focusedValue)
      )
      .slice(0, 25)
      .map((member) => ({
        name: member,
        value: member,
      }));

    await interaction.respond(choices);
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
        interaction.options.getChannel('channel', true);

      if (!selectedChannel.isTextBased()) {
        await interaction.reply({
          content:
            'That channel cannot receive the member embed.',
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      const botMember = interaction.guild.members.me;

      const permissions =
        selectedChannel.permissionsFor(botMember);

      const missingPermissions = [];

      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel)
      ) {
        missingPermissions.push('View Channel');
      }

      if (
        !permissions?.has(PermissionFlagsBits.SendMessages)
      ) {
        missingPermissions.push('Send Messages');
      }

      if (
        !permissions?.has(PermissionFlagsBits.EmbedLinks)
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

      const postedMessage = await selectedChannel.send({
        embeds: [
          createBakedMembersEmbed(interaction.guild),
        ],
      });

      const data = loadData();

      const alreadyStored = data.panels.some(
        (panel) => panel.messageId === postedMessage.id
      );

      if (!alreadyStored) {
        data.panels.push({
          guildId: interaction.guild.id,
          channelId: selectedChannel.id,
          messageId: postedMessage.id,
        });

        saveData(data);
      }

      await interaction.reply({
        content:
          `The Baked member list has been posted in ` +
          `${selectedChannel}.`,
        flags: MessageFlags.Ephemeral,
      });

      return;
    }

    // --------------------------------------------------
    // /addbakedmember
    // --------------------------------------------------

    if (interaction.commandName === 'addbakedmember') {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const providedName =
        interaction.options.getString('name', true);

      const formattedName =
        formatMemberName(providedName);

      if (
        formattedName === 'BKD' ||
        formattedName.length < 4
      ) {
        await interaction.editReply({
          content: 'Please enter a valid member name.',
        });

        return;
      }

      const data = loadData();

      const memberAlreadyExists = data.members.some(
        (member) =>
          member.toUpperCase() ===
          formattedName.toUpperCase()
      );

      if (memberAlreadyExists) {
        await interaction.editReply({
          content:
            `**${formattedName}** is already on the ` +
            'Baked member list.',
        });

        return;
      }

      data.members.push(formattedName);
      saveData(data);

      await updateAllMemberPanels(interaction.guild);

      const confirmationEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Member Added')
        .setDescription(
          `**${formattedName}** has been added to Baked.`
        )
        .addFields({
          name: 'Total Members',
          value: String(data.members.length),
          inline: true,
        })
        .setFooter({
          text: `Added by ${interaction.user.username}`,
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [confirmationEmbed],
      });

      return;
    }

    // --------------------------------------------------
    // /removebakedmember
    // --------------------------------------------------

    if (
      interaction.commandName === 'removebakedmember'
    ) {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });

      const selectedMember =
        interaction.options.getString('member', true);

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
            'on the Baked member list.',
        });

        return;
      }

      const [removedMember] = data.members.splice(
        memberIndex,
        1
      );

      saveData(data);

      await updateAllMemberPanels(interaction.guild);

      const confirmationEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Member Removed')
        .setDescription(
          `**${removedMember}** has been removed from Baked.`
        )
        .addFields({
          name: 'Remaining Members',
          value: String(data.members.length),
          inline: true,
        })
        .setFooter({
          text: `Removed by ${interaction.user.username}`,
        })
        .setTimestamp();

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

    const errorResponse = {
      content:
        'Something went wrong while running that command. ' +
        'Check your Render logs for more information.',
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred) {
      await interaction
        .editReply({
          content: errorResponse.content,
          embeds: [],
        })
        .catch(() => {});

      return;
    }

    if (interaction.replied) {
      await interaction
        .followUp(errorResponse)
        .catch(() => {});

      return;
    }

    await interaction
      .reply(errorResponse)
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
