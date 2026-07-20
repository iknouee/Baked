const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder()
    .setName('bing')
    .setDescription('Replies with bong')
    .toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    throw error;
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'bing') {
    await interaction.reply('bong');
  }
});

registerCommands()
  .then(() => client.login(token))
  .catch(() => process.exit(1));
