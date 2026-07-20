# Bing Bong Discord Bot

A simple Discord.js starter bot for Render.

## Command

- `/bing` replies with `bong`

## Discord Developer Portal Setup

1. Create an application in the Discord Developer Portal.
2. Open the **Bot** page and create a bot.
3. Copy the bot token and save it as `DISCORD_TOKEN` in Render.
4. Copy the application ID from **General Information** and save it as `CLIENT_ID` in Render.
5. In **OAuth2 > URL Generator**, select:
   - `bot`
   - `applications.commands`
6. Under bot permissions, select **Send Messages**.
7. Use the generated URL to invite the bot to your server.

## GitHub Setup

1. Upload all files in this folder to a GitHub repository.
2. Do not upload your bot token.

## Render Setup

1. Create a new **Background Worker** on Render.
2. Connect your GitHub repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add these environment variables:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
6. Deploy the worker.

The slash command is registered globally when the bot starts. Global Discord commands can sometimes take a little while to appear.
