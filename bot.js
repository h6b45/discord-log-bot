const { Client, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { token } = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
  if (!message.attachments.size || message.author.bot) return;

  const attachment = message.attachments.first();
  if (!attachment.name.endsWith('.txt')) return;

  try {
    const response = await fetch(attachment.url);
    const text = await response.text();

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      message.reply('The uploaded log is empty or invalid.');
      return;
    }

    // Parse and group by timestamp
    const timestampGroups = [];
    let currentGroup = null;

    for (const line of lines) {
      const match = line.match(/^(\d{2}:\d{2}:\d{2}[ap]) \| (.*)$/);
      if (!match) continue;

      const [_, timestamp, content] = match;

      if (!currentGroup || currentGroup.timestamp !== timestamp) {
        if (currentGroup) timestampGroups.push(currentGroup);
        currentGroup = { timestamp, messages: [] };
      }

      currentGroup.messages.push(content);
    }
    if (currentGroup) timestampGroups.push(currentGroup);

    // Send messages in sequence
    for (const group of timestampGroups) {
      const combined = group.messages.join('\n');
      await message.channel.send(`\n${combined}`);
      await new Promise(res => setTimeout(res, 1000)); // wait 1s between groups
    }

  } catch (err) {
    console.error('Error processing log file:', err);
    message.reply('There was an error processing the log.');
  }
});

client.login(token);

