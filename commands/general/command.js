import db from "../../utils/database.js";
import Command from "../../classes/command.js";
import * as collections from "../../utils/collections.js";

class CommandCommand extends Command {
  async run() {
    this.success = false;
    if (!this.guild) return this.getString("guildOnly");
    const owners = process.env.OWNER.split(",");
    if (!this.memberPermissions.has("ADMINISTRATOR") && !owners.includes(this.member.id)) return this.getString("commands.responses.command.adminOnly");
    if (this.args.length === 0) return this.getString("commands.responses.command.noCmd");
    if (this.args[0] !== "disable" && this.args[0] !== "enable") return this.getString("commands.responses.command.invalid");
    if (!this.args[1]) return this.getString("commands.responses.command.noInput");
    if (!collections.commands.has(this.args[1].toLowerCase()) && !collections.aliases.has(this.args[1].toLowerCase())) return this.getString("commands.responses.command.invalidCmd");

    const guildDB = await db.getGuild(this.guild.id);
    const disabled = guildDB.disabled_commands ?? guildDB.disabledCommands;
    const command = collections.aliases.get(this.args[1].toLowerCase()) ?? this.args[1].toLowerCase();

    if (this.args[0].toLowerCase() === "disable") {
      if (command === "command") return this.getString("commands.responses.command.cannotDisable");
      if (disabled?.includes(command)) return this.getString("commands.responses.command.alreadyDisabled");

      await db.disableCommand(this.guild.id, command);
      this.success = true;
      return this.getString("commands.responses.command.disabled", {
        params: {
          command,
          prefix: guildDB.prefix
        }
      });
    }
    if (this.args[0].toLowerCase() === "enable") {
      if (!disabled?.includes(command)) return this.getString("commands.responses.command.notDisabled");

      await db.enableCommand(this.guild.id, command);
      this.success = true;
      return this.getString("commands.responses.command.reEnabled", { params: { command } });
    }
  }

  static description = "Enables/disables a classic command for a server (use server settings for slash commands)";
  static aliases = ["cmd"];
  static flags = [{
    name: "enable",
    type: 1,
    description: "Enables a classic command",
    options: [{
      name: "text",
      type: 3,
      description: "The text to decode",
      classic: true,
      required: true
    }]
  }, {
    name: "disable",
    type: 1,
    description: "Disables a classic command",
    options: [{
      name: "text",
      type: 3,
      description: "The text to encode",
      classic: true,
      required: true
    }]
  }];
  static slashAllowed = false;
  static directAllowed = false;
  static dbRequired = true;
}

export default CommandCommand;
