import ImageCommand from "#cmd-classes/imageCommand.js";

class QrCreateCommand extends ImageCommand {
  async criteria(text, _url) {
    // assuming a character uses at most 4 bytes
    if (text.length < QrCreateCommand.maxBytes / 4) {
      return true;
    }
    if (QrCreateCommand.textEncoder.encode(text).length > QrCreateCommand.maxBytes) {
      return false;
    }
    return true;
  }

  params() {
    const inputText = this.getOptionString("text") ?? this.args.join(" ");
    return {
      text: this.clean(inputText)
    };
  }

  static init() {
    super.init();
    this.flags.find((v) => v.name === "text").maxLength = QrCreateCommand.maxBytes;
    return this;
  }

  static description = "Generates a QR code";

  static requiresImage = false;
  static requiresText = true;
  static noText = "You need to provide some text that is less than 2953 bytes to generate a QR code!";
  static command = "qrcreate";

  static textEncoder = new TextEncoder();
  static maxBytes = 2952;     // a QR code can only encode up to 2953 bytes
}

export default QrCreateCommand;
