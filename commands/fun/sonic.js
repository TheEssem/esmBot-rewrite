//import wrap from "../../utils/wrap.js";
import ImageCommand from "../../classes/imageCommand.js";

class SonicCommand extends ImageCommand {
  params() {
    const cleanedMessage = (this.options.text ?? this.args.join(" ")).replaceAll("&", "&amp;").replaceAll(">", "&gt;").replaceAll("<", "&lt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;").replaceAll("\\n", "\n");
    return {
      text: cleanedMessage
    };
  }

  static description = "Creates a Sonic speech bubble image";
  static arguments = ["[text]"];

  static requiresImage = false;
  static requiresText = true;
  static noText = "You need to provide some text to make a Sonic meme!";
  static command = "sonic";
}

export default SonicCommand;