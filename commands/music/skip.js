import { skipVotes } from "../../utils/soundplayer.js";
import MusicCommand from "../../classes/musicCommand.js";

class SkipCommand extends MusicCommand {
  async run() {
    if (!this.channel.guild) return "This command only works in servers!";
    if (!this.member.voiceState.channelID) return "You need to be in a voice channel first!";
    if (!this.channel.guild.members.get(this.client.user.id).voiceState.channelID) return "I'm not in a voice channel!";
    const player = this.connection;
    if (player.host !== this.author.id && !this.member.permissions.has("manageChannels")) {
      const votes = skipVotes.get(this.channel.guild.id) ?? { count: 0, ids: [], max: Math.min(3, player.voiceChannel.voiceMembers.filter((i) => i.id !== this.client.user.id && !i.bot).length) };
      if (votes.ids.includes(this.author.id)) return "You've already voted to skip!";
      const newObject = {
        count: votes.count + 1,
        ids: [...votes.ids, this.author.id].filter(item => !!item),
        max: votes.max
      };
      if (votes.count + 1 === votes.max) {
        await player.player.stop(this.channel.guild.id);
        skipVotes.set(this.channel.guild.id, { count: 0, ids: [], max: Math.min(3, player.voiceChannel.voiceMembers.filter((i) => i.id !== this.client.user.id && !i.bot).length) });
        if (this.type === "application") return "🔊 The current song has been skipped.";
      } else {
        skipVotes.set(this.channel.guild.id, newObject);
        return `🔊 Voted to skip song (${votes.count + 1}/${votes.max} people have voted).`;
      }
    } else {
      await player.player.stop(this.channel.guild.id);
      if (this.type === "application") return "🔊 The current song has been skipped.";
    }
  }

  static description = "Skips the current song";
  static aliases = ["forceskip"];
}

export default SkipCommand;
