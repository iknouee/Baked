const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// Optional:
// Add GUILD_ID in Render to make command updates appear instantly while testing.
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error(
    'Missing DISCORD_TOKEN or CLIENT_ID environment variable.'
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// File used to save the BKD member list.
const membersFile = path.join(__dirname, 'baked-members.json');

const defaultMembers = [
  'BKDROME',
  'BKDMASON',
  'BKDBELLE',
  'BKDRAZE',
  'BKDBREE',
  'BKDCHELS',
  'BKDSPIDEY',
];

/**
 * Creates the member file if it does not exist.
 */
function createMembersFile() {
  if (fs.existsSync(membersFile)) return;

  fs.writeFileSync(
    membersFile,
    JSON.stringify(defaultMembers, null, 2),
    'utf8'
  );

  console.log('Created baked-members.json with the default members.');
}

/**
 * Reads the current BKD members.
 */
function getBakedMembers() {
  createMembersFile();

  try {
    const fileContents = fs.readFileSync(membersFile, 'utf8');
    const members = JSON.parse(fileContents);

    if (!Array.isArray(members)) {
      throw new Error('Member file does not contain an array.');
    }

    return members;
  } catch (error) {
    console.error('Failed to read baked member list:', error);

    // Restore the original list if the file becomes damaged.
    fs.writeFileSync(
      membersFile,
      JSON.stringify(defaultMembers, null, 2),
      'utf8'
    );

    return [...defaultMembers];
  }
}

/**
 * Saves the updated BKD members.
 */
function saveBakedMembers(members) {
  fs.writeFileSync(
    membersFile,
    JSON.stringify(members, null, 2),
    'utf8'
  );
}

/**
 * Formats a member name consistently.
 *
 * Examples:
 * rome    -> BKDROME
 * bkdrome -> BKDROME
 */
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

/**
 * Builds the official BKD members embed.
 */
function createBakedMembersEmbed(guild) {
  const members = getBakedMembers();

  const memberList = members
    .map((member, index) => {
      const number = String(index + 1).padStart(2, '0');
      return `\`${number}\`  **${member}**`;
    })
    .join('\n');

  return new EmbedBuilder()
    .setColor(0xf28c28)
    .setAuthor({
      name: 'BAKED',
      iconURL: guild.iconURL({ size: 256 }) || undefined,
    })
    .setTitle('Official BKD Member List')
    .setDescription(
      memberList || '*There are currently no members in the list.*'
    )
    .setThumbnail(guild.iconURL({ size: 512 }) || null)
    .setFooter({
      text: `${members.length} ${
        members.length === 1 ? 'member' : 'members'
      } • BKD stands for Baked`,
    })
    .setTimestamp();
}

const commands = [
  new SlashCommandBuilder()
    .setName('bing')
    .setDescription('Replies with bong')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('bakedmembers')
    .setDescription('Sends the official Baked member list')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Choose where the member list should be sent')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('addbakedmember')
    .setDescription('Adds someone to the Baked member list')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Member name, for example: ROMEO or BKDROMEO')
        .setMinLength(1)
        .setMaxLength(25)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');

    if (guildId) {
      // Guild commands update almost instantly.
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        {
          body: commands,
        }
      );

      console.log(
        `Slash commands registered in guild ${guildId}.`
      );
    } else {
      // Global commands can take some time to update on Discord.
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });

      console.log('Global slash commands registered successfully.');
    }
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    throw error;
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} server(s).`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    /*
     * /bing
     */
    if (interaction.commandName === 'bing') {
      await interaction.reply('bong');
      return;
    }

    /*
     * /bakedmembers
     *
     * Lets the person running the command select the channel.
     */
    if (interaction.commandName === 'bakedmembers') {
      const selectedChannel =
        interaction.options.getChannel('channel', true);

      if (!selectedChannel.isTextBased()) {
        await interaction.reply({
          content: 'That channel cannot receive messages.',
          ephemeral: true,
        });
        return;
      }

      const botMember = interaction.guild.members.me;

      const permissions = selectedChannel.permissionsFor(botMember);

      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions?.has(PermissionFlagsBits.SendMessages) ||
        !permissions?.has(PermissionFlagsBits.EmbedLinks)
      ) {
        await interaction.reply({
          content:
            `I cannot send the member list in ${selectedChannel}. ` +
            'Please give me View Channel, Send Messages and Embed Links permissions.',
          ephemeral: true,
        });
        return;
      }

      const embed = createBakedMembersEmbed(interaction.guild);

      await selectedChannel.send({
        embeds: [embed],
      });

      await interaction.reply({
        content: `The Baked member list was sent in ${selectedChannel}.`,
        ephemeral: true,
      });

      return;
    }

    /*
     * /addbakedmember
     *
     * Only members with Manage Server can use this command.
     */
    if (interaction.commandName === 'addbakedmember') {
      const providedName =
        interaction.options.getString('name', true);

      const formattedName = formatMemberName(providedName);

      if (formattedName === 'BKD') {
        await interaction.reply({
          content: 'Please enter a valid member name.',
          ephemeral: true,
        });
        return;
      }

      const members = getBakedMembers();

      const alreadyExists = members.some(
        (member) =>
          member.toUpperCase() === formattedName.toUpperCase()
      );

      if (alreadyExists) {
        await interaction.reply({
          content: `**${formattedName}** is already on the Baked member list.`,
          ephemeral: true,
        });
        return;
      }

      members.push(formattedName);
      saveBakedMembers(members);

      const confirmationEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Member Added')
        .setDescription(
          `**${formattedName}** has been added to the official Baked member list.`
        )
        .addFields({
          name: 'Total Members',
          value: String(members.length),
          inline: true,
        })
        .setFooter({
          text: `Added by ${interaction.user.username}`,
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [confirmationEmbed],
        ephemeral: true,
      });

      return;
    }
  } catch (error) {
    console.error(
      `Error handling /${interaction.commandName}:`,
      error
    );

    const errorMessage = {
      content:
        'Something went wrong while running that command. Check the Render logs for more information.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
});

createMembersFile();

registerCommands()
  .then(() => client.login(token))
  .catch((error) => {
    console.error('Bot startup failed:', error);
    process.exit(1);
  });
