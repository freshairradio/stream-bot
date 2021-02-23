const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();
const { Readable } = require("stream");

const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

const DISCORD_TOKEN = process.env.DISCORD_TOKEN_SILENCE;
const controlChannel = "studio3";
const broadcastChannel = "listen";

class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
  }
}

client.once("ready", () => {
  console.log("Ready!");
});

client.on("message", async (message) => {

  // Ignore bot messages
  if (message.member.user.bot) {
    return;
  }

  // Only allow control from one channel
  if (message.channel.name !== controlChannel) {
    console.log("Incorrect control channel used");
    return;
  }

  // User must be in the correct channel
  if (message.member.voice.channel.name !== broadcastChannel) {
    console.log("Users not in broadcast channel");
    return;
  }

  if (message.content === "!listen" && message.member.voice.channel) {
    const connection = await message.member.voice.channel.join();
    const audio = connection.receiver.createStream(message.member, {
      mode: "pcm",
      end: "manual"
    });
    audio.pipe(fs.createWriteStream("user_audio"));

    connection.play(new Silence(), { type: "opus" });
    console.log("Joined channel: " + message.member.voice.channel.name);
  }
});

client.on("message", async (message) => {
    // Disconnect from the same voice channel of the author of the message
    if (message.content === "!disconnect-silence" && message.member.voice.channel) {
      const connection = await message.member.voice.channel.join();
      connection.disconnect();
      console.log("Disconnected from: " + message.channel.name);
    }
});

client.login(DISCORD_TOKEN);