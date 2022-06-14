import * as logger from "./logger.js";
import fetch from "node-fetch";
import fs from "fs";
import format from "format-duration";
import { Manager, Rest } from "lavacord";

let nodes;

export const players = new Map();
export const queues = new Map();
export const skipVotes = new Map();

export let manager;
export let status = false;
export let connected = false;

export async function checkStatus() {
  const json = await fs.promises.readFile(new URL("../servers.json", import.meta.url), { encoding: "utf8" });
  nodes = JSON.parse(json).lava;
  const newNodes = [];
  for (const node of nodes) {
    try {
      const response = await fetch(`http://${node.host}:${node.port}/version`, { headers: { Authorization: node.password } }).then(res => res.text());
      if (response) newNodes.push(node);
    } catch {
      logger.error(`Failed to get status of Lavalink node ${node.host}.`);
    }
  }
  nodes = newNodes;
  status = newNodes.length === 0 ? true : false;
  return status;
}

export async function connect(client) {
  manager = new Manager(nodes, {
    user: client.user.id,
    shards: client.shards.size || 1,
    send: (packet) => {
      const guild = client.guilds.get(packet.d.guild_id);
      if (!guild) return;
      return guild.shard.sendWS(packet.op, packet.d);
    }
  });
  const { length } = await manager.connect();
  logger.log(`Successfully connected to ${length} Lavalink node(s).`);
  connected = true;
  manager.on("error", (error, node) => {
    logger.error(`An error occurred on Lavalink node ${node}: ${error}`);
  });
  return length;
}

export async function play(client, sound, options, music = false) {
  if (!manager) return "The sound commands are still starting up!";
  if (!options.channel.guild) return "This command only works in servers!";
  if (!options.member.voiceState.channelID) return "You need to be in a voice channel first!";
  if (!options.channel.guild.permissionsOf(client.user.id).has("voiceConnect")) return "I can't join this voice channel!";
  const voiceChannel = options.channel.guild.channels.get(options.member.voiceState.channelID);
  if (!voiceChannel.permissionsOf(client.user.id).has("voiceConnect")) return "I don't have permission to join this voice channel!";
  const player = players.get(options.channel.guild.id);
  if (!music && manager.voiceStates.has(options.channel.guild.id) && (player && player.type === "music")) return "I can't play a sound effect while playing music!";
  let node = manager.idealNodes[0];
  if (!node) {
    const status = await checkStatus();
    if (!status) {
      await connect(client);
      node = manager.idealNodes[0];
    }
  }
  if (!music && !nodes.filter(obj => obj.host === node.host)[0].local) {
    sound = sound.replace(/\.\//, "https://raw.githubusercontent.com/esmBot/esmBot/master/");
  }
  let tracks, playlistInfo;
  try {
    ({ tracks, playlistInfo } = await Rest.load(node, sound));
  } catch {
    return "🔊 Hmmm, seems that all of the audio servers are down. Try again in a bit.";
  }
  const oldQueue = queues.get(voiceChannel.guild.id);
  if (!tracks || tracks.length === 0) return "I couldn't find that song!";
  if (music) {
    const sortedTracks = tracks.map((val) => { return val.track; });
    const playlistTracks = playlistInfo.selectedTrack ? sortedTracks : [sortedTracks[0]];
    queues.set(voiceChannel.guild.id, oldQueue ? [...oldQueue, ...playlistTracks] : playlistTracks);
  }
  const connection = await manager.join({
    guild: voiceChannel.guild.id,
    channel: voiceChannel.id,
    node: node.id
  }, { selfdeaf: true });

  if (oldQueue && oldQueue.length !== 0 && music) {
    return `Your ${playlistInfo.name ? "playlist" : "tune"} \`${playlistInfo.name ? playlistInfo.name.trim() : (tracks[0].info.title !== "" ? tracks[0].info.title.trim() : "(blank)")}\` has been added to the queue!`;
  } else {
    nextSong(client, options, connection, tracks[0].track, tracks[0].info, music, voiceChannel, player ? player.host : options.member.id, player ? player.loop : false, player ? player.shuffle : false);
    return;
  }
}

export async function nextSong(client, options, connection, track, info, music, voiceChannel, host, loop = false, shuffle = false, lastTrack = null) {
  skipVotes.delete(voiceChannel.guild.id);
  const parts = Math.floor((0 / info.length) * 10);
  let playingMessage;
  if (!music && players.has(voiceChannel.guild.id)) {
    const playMessage = players.get(voiceChannel.guild.id).playMessage;
    try {
      players.delete(voiceChannel.guild.id);
      await playMessage.delete();
    } catch {
      // no-op
    }
  }
  if (music && lastTrack === track && players.has(voiceChannel.guild.id)) {
    playingMessage = players.get(voiceChannel.guild.id).playMessage;
  } else {
    try {
      const content = !music ? "🔊 Playing sound..." : {
        embeds: [{
          color: 16711680,
          author: {
            name: "Now Playing",
            icon_url: client.user.avatarURL
          },
          fields: [{
            name: "ℹ️ Title:",
            value: info.title && info.title.trim() !== "" ? info.title : "(blank)"
          },
          {
            name: "🎤 Artist:",
            value: info.title && info.author.trim() !== "" ? info.author : "(blank)"
          },
          {
            name: "💬 Channel:",
            value: voiceChannel.name
          },
          {
            name: `${"▬".repeat(parts)}🔘${"▬".repeat(10 - parts)}`,
            value: `0:00/${info.isStream ? "∞" : format(info.length)}`
          }]
        }]
      };
      if (options.type === "classic") {
        playingMessage = await client.createMessage(options.channel.id, content);
      } else {
        await options.interaction[options.interaction.acknowledged ? "editOriginalMessage" : "createMessage"](content);
        playingMessage = await options.interaction.getOriginalMessage();
      }
    } catch {
      // no-op
    }
  }
  connection.removeAllListeners("error");
  connection.removeAllListeners("end");
  await connection.play(track);
  players.set(voiceChannel.guild.id, { player: connection, type: music ? "music" : "sound", host: host, voiceChannel: voiceChannel, originalChannel: options.channel, loop: loop, shuffle: shuffle, playMessage: playingMessage });
  connection.once("error", async (error) => {
    try {
      if (playingMessage.channel.messages.has(playingMessage.id)) await playingMessage.delete();
      const playMessage = players.get(voiceChannel.guild.id).playMessage;
      if (playMessage.channel.messages.has(playMessage.id)) await playMessage.delete();
    } catch {
      // no-op
    }
    try {
      await manager.leave(voiceChannel.guild.id);
      await connection.destroy();
    } catch {
      // no-op
    }
    connection.removeAllListeners("end");
    players.delete(voiceChannel.guild.id);
    queues.delete(voiceChannel.guild.id);
    logger.error(error);
    const content = `🔊 Looks like there was an error regarding sound playback:\n\`\`\`${error.type}: ${error.error}\`\`\``;
    if (options.type === "classic") {
      await client.createMessage(options.channel.id, content);
    } else {
      await options.interaction.createMessage(content);
    }
  });
  connection.on("end", async (data) => {
    if (data.reason === "REPLACED") return;
    let queue = queues.get(voiceChannel.guild.id);
    const player = players.get(voiceChannel.guild.id);
    if (player && process.env.STAYVC === "true") {
      player.type = "idle";
      players.set(voiceChannel.guild.id, player);
    }
    let newQueue;
    if (player && player.shuffle) {
      if (player.loop) {
        queue.push(queue.shift());
      } else {
        queue = queue.slice(1);
      }
      queue.unshift(queue.splice(Math.floor(Math.random() * queue.length), 1)[0]);
      newQueue = queue;
    } else if (player && player.loop) {
      queue.push(queue.shift());
      newQueue = queue;
    } else {
      newQueue = queue ? queue.slice(1) : [];
    }
    queues.set(voiceChannel.guild.id, newQueue);
    if (newQueue.length !== 0) {
      const newTrack = await Rest.decode(connection.node, newQueue[0]);
      nextSong(client, options, connection, newQueue[0], newTrack, music, voiceChannel, host, player.loop, player.shuffle, track);
      try {
        if (newQueue[0] !== track && playingMessage.channel.messages.has(playingMessage.id)) await playingMessage.delete();
        if (newQueue[0] !== track && player.playMessage.channel.messages.has(player.playMessage.id)) await player.playMessage.delete();
      } catch {
        // no-op
      }
    } else if (process.env.STAYVC !== "true") {
      await manager.leave(voiceChannel.guild.id);
      await connection.destroy();
      players.delete(voiceChannel.guild.id);
      queues.delete(voiceChannel.guild.id);
      skipVotes.delete(voiceChannel.guild.id);
      const content = "🔊 The current voice channel session has ended.";
      if (options.type === "classic") {
        await client.createMessage(options.channel.id, content);
      } else {
        await options.interaction.createMessage(content);
      }
      try {
        if (playingMessage.channel.messages.has(playingMessage.id)) await playingMessage.delete();
        if (player && player.playMessage.channel.messages.has(player.playMessage.id)) await player.playMessage.delete();
      } catch {
        // no-op
      }
    } else {
      try {
        if (playingMessage.channel.messages.has(playingMessage.id)) await playingMessage.delete();
        if (player && player.playMessage.channel.messages.has(player.playMessage.id)) await player.playMessage.delete();
      } catch {
        // no-op
      }
    }
  });
}
