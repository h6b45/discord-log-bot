const { Client, IntentsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = 'bot_token'; //use the public token for the bot
const SPEED_MULTIPLIER = 1;

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent
  ]
});

function parseLogContent(content) {
  
  const lines = content.split(/\r?\n/); // handles both \n and \r\n

  const parsed = [];
  for (const line of lines) {
    const match = line.match(/^(\d{2}):(\d{2}):(\d{2})([ap])\s*\|\s*(.+)$/i);
    if (!match) continue;

    let [_, hour, minute, second, meridiem, text] = match;

    hour = parseInt(hour, 10);
    minute = parseInt(minute, 10);
    second = parseInt(second, 10);

    // Handle AM/PM
    if (meridiem.toLowerCase() === 'p' && hour < 12) hour += 12;
    if (meridiem.toLowerCase() === 'a' && hour === 12) hour = 0;

    const timestamp = new Date();
    timestamp.setHours(hour, minute, second, 0);

    parsed.push({ timestamp, content: text });
  }

  console.log(`Parsed ${parsed.length} lines.`); // helpful debug
  return parsed;
}

async function downloadAttachment(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function replayLog(channel, filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const parsed = parseLogContent(content);
  if (parsed.length === 0) return channel.send("The uploaded log is empty or invalid.");

  const groupedMessages = [];
  let lastTimestamp = null;
  let currentBatch = [];

  // Group messages by timestamp
  parsed.forEach(({ timestamp, content }) => {
    if (lastTimestamp && timestamp.getTime() === lastTimestamp.getTime()) {
      // Same timestamp, add to the batch
      currentBatch.push(content);
    } else {
      // New timestamp, save the previous batch if it exists
      if (currentBatch.length > 0) {
        groupedMessages.push({ timestamp: lastTimestamp, messages: currentBatch });
      }
      currentBatch = [content]; // Start a new batch
      lastTimestamp = timestamp;
    }
  });

  // Add the last batch
  if (currentBatch.length > 0) {
    groupedMessages.push({ timestamp: lastTimestamp, messages: currentBatch });
  }

  // Replay grouped messages
  for (const group of groupedMessages) {
    const timestamp = group.timestamp;
    const messages = group.messages.join('\n'); // Combine messages in the batch

    setTimeout(() => {
      channel.send(messages); // Send batch as a single message
    }, timestamp.getTime() - Date.now());
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.content === '!replaylog') {
    const attachment = message.attachments.first();

    if (!attachment) {
      return message.reply("Please attach a log file with your command.");
    }

    const tempPath = path.join(__dirname, 'uploaded_log.txt');
    await downloadAttachment(attachment.url, tempPath);

    await message.channel.send("Starting log replay...");
    replayLog(message.channel, tempPath);
  }
});

client.login(TOKEN);

