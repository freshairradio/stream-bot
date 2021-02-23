const { spawn } = require("child_process");
const Discord = require("discord.js");
const client = new Discord.Client();
const fetch = require('node-fetch');
var AudioMixer = require("audio-mixer");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const streamOutput = process.env.STREAM;
const broadcastChannel = "listen";
const controlChannel = "studio3";

let mixer;

client.once("ready", () => {
  console.log("Ready!");
});

function spawnFfmpeg() {
  var args = [
    "-hide_banner",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-i",
    "pipe:0",
    "-f",
    "mp3",
    "-reconnect_at_eof",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect",
    "1",
    "-reconnect_delay_max",
    "1000",
    "-content_type",
    "audio/mpeg",
    streamOutput
  ];

  var ffmpeg = spawn("ffmpeg", args);

  console.log("Spawning ffmpeg " + args.join(" "));

  ffmpeg.on("exit", function (code) {
    console.log("FFMPEG child process exited with code " + code);
  });

  ffmpeg.stderr.on("data", function (data) {
    console.log("Incoming data: " + data);
  });

  ffmpeg.stderr.on("error", function (error) {
    console.log("Error" + error);
  });

  return ffmpeg;
}
var ffmpeg;
client.on("message", async (message) => {
  // Ignore bot messages
  if (message.member.user.bot) {
    return;
  }

  // Only allow control from one channel
  if (message.channel.name !== controlChannel) {
    console.log("Incorrect control channel used");
    message.channel.send("You can't add me from here! Use #" + controlChannel);
    return;
  }

  // User must be in the correct channel
  if ((message.content === "!listen" || message.content === "!disconnect") && (message.member.voice.channel.name !== broadcastChannel)) {
    console.log("Users not in broadcast channel");
    message.channel.send("You need to be in #" + broadcastChannel);
    return;
  }

  // Join the same voice channel of the author of the message
  if (message.content === "!listen" && message.member.voice.channel) {
    if (!ffmpeg) {
      ffmpeg = spawnFfmpeg();
    }
    if (!mixer) {
      mixer = new AudioMixer.Mixer({
        channels: 2,
        bitDepth: 16,
        sampleRate: 48000,
        clearInterval: 250
      });
      mixer.pipe(ffmpeg.stdin).on("error", () => {
        console.log("Mixer error");
      });
    }
    const connection = await message.member.voice.channel.join();

    let usersJoined = [];

    console.log("User started stream: " + message.member.user.username);

    message.member.voice.channel.members.forEach((member) => {
      // Skip the streaming bot - don't skip the silence bot!
      if (member.user.username === "icecast-bot") {
        return;
      }

      usersJoined.push(member);
      const audio = connection.receiver.createStream(member, {
        mode: "pcm",
        end: "manual"
      });
      // audio.pipe(fs.createWriteStream("user_audio"));
      let input = mixer.input({
        channels: 2,
        volume: 100
      });
      audio.pipe(input).on("error", () => {
        console.log("Discord error from join through !listen");
      });

      console.log(
        "User connection added " +
          member.user.username +
          " with id " +
          member.user.id
      );
    });

    message.channel.send("Users added to stream: " + usersJoined.join(", "));
  }
});

// Function for auto joining if a user joins a specific channel

// client.on("voiceStateUpdate", (oldMember, newMember) => {
//     if (newMember == null) { return; }

//     // If a user disconnects from a channel or joins a voice channel from a text channel
//     const newUserChannelName = ((newMember.channel == null) ? "" : newMember.channel.name);
//     const oldUserChannelName = ((oldMember.channel == null) ? "" : oldMember.channel.name);

//     if (newUserChannelName === broadcastChannel && oldUserChannelName !== broadcastChannel) {
//         newMember.channel.join()
//         .then(connection => {
//             const audio = connection.receiver.createStream(newMember.member, {
//                 mode: "pcm",
//                 end: "manual"
//             });

//             // audio.pipe(fs.createWriteStream("user_audio"));
//             let input = mixer.input({
//                 channels: 2,
//                 volume: 75
//             });

//             audio.pipe(input).on("error", () => {console.log("Discord error from auto join")});

//             console.log(newMember.member.user.username);
//         });
//     }
// });

client.on("message", async (message) => {
  // Disconnect from the same voice channel of the author of the message
  if (message.content === "!disconnect" && message.member.voice.channel) {
    if (ffmpeg) {
      ffmpeg.kill();
      ffmpeg = null;
    }
    if (mixer) {
      mixer = null;
    }
    const connection = await message.member.voice.channel.join();
    connection.disconnect();

    fetch("https://ctrl.freshair.radio/disconnect", {method: 'POST', body: 'Disconnect'});

    console.log("Disconnected from: " + message.channel.name);
  }
});

// ffmpeg.stdout.pipe(fs.createWriteStream("user_audio.mp3"));
client.login(DISCORD_TOKEN);
