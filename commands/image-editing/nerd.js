import { Constants } from "oceanic.js";
import ImageCommand from "../../classes/imageCommand.js";

class NerdCommand extends ImageCommand {
  params() {
    const resize = this.options.resize ?? false;
    return {
      resize: typeof resize === "boolean" ? resize : false
    };
  }

  static init() {
    super.init();
    this.flags.push({
      name: "resize",
      type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
      description: "Resize the image to fit completely inside the speech bubble (default: false)",
    });
    return this;
  }

  static description = "Makes nerd say an image";
  static aliases = ["says"];

  static noImage = "You need to provide an image/GIF for nerd to say!";
  static command = "nerd";
}

export default NerdCommand;
