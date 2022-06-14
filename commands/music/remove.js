import { Rest } from "lavacord";
import { queues } from "../../utils/soundplayer.js";
import MusicCommand from "../../classes/musicCommand.js";

class RemoveCommand extends MusicCommand {
  async run() {
    if (!this.channel.guild) return "This command only works in servers!";
    if (!this.member.voiceState.channelID) return "You need to be in a voice channel first!";
    if (!this.channel.guild.members.get(this.client.user.id).voiceState.channelID) return "I'm not in a voice channel!";
    if (this.connection.host !== this.author.id) return "Only the current voice session host can remove songs from the queue!";
    const pos = parseInt(this.options.position ?? this.args[0]);
    if (isNaN(pos) || pos > this.queue.length || pos < 1) return "That's not a valid position!";
    const removed = this.queue.splice(pos, 1);
    const track = await Rest.decode(this.connection.player.node, removed[0]);
    queues.set(this.channel.guild.id, this.queue);
    return `🔊 The song \`${track.title ? track.title : "(blank)"}\` has been removed from the queue.`;
  }

  static flags = [{
    name: "position",
    type: 4,
    description: "The queue position you want to remove",
    min_value: 1,
    required: true
  }];
  static description = "Removes a song from the queue";
  static aliases = ["rm"];
}

export default RemoveCommand;
