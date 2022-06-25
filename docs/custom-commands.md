# Custom Commands
esmBot has a flexible command handler, allowing you to create new commands and categories simply by creating new files. This page will provide a reference for creating new commands.

## Directory Structure
The bot loads commands from subdirectories inside of the `commands` directory, which looks something like this by default:
```
commands
  - fun
    > cat.js
    > ...
  - general
    > help.js
    > ping.js
    > ...
  - image-editing
    > caption.js
    > speed.js
    > ...
```
As you can see, each command is grouped into categories, which are represented by subdirectories. To create a new category, you can simply create a new directory inside of the `commands` directory, and to create a new command, you can create a new JS file under one of those subdirectories.

## Commnand Structure
It's recommended to use the `Command` class located in `classes/command.js` to create a new command in most cases. This class provides various parameters and fields that will likely be useful when creating a command. Here is a simple example of a working command file:
```js
import Command from "../../classes/command.js";

class HelloCommand extends Command {
  async run() {
    return "Hello world!";
  }

  static description = "A simple command example";
  static aliases = ["helloworld"];
}

export default HelloCommand;
```
As you can see, the first thing we do is import the Command class. We then create a new class for the command that extends that class to provide the needed parameters. We then define the command function, which is named `run`. Some static parameters, including the command description and an alias for the command, `helloworld`, are also defined. Finally, once everything in the command class is defined, we export the new class to be loaded as a module by the command handler.

The default command name is the same as the filename that you save it as, excluding the `.js` file extension. If you ever want to change the name of the command, just rename the file.

The parameters available to your command consist of the following:
- `this.client`: An instance of an Eris [`Client`](https://abal.moe/Eris/docs/Client), useful for getting info or performing lower-level communication with the Discord API.
- `this.cluster`: The ID of the eris-fleet cluster that the command is being run from. This should be a number greater than or equal to 0.
- `this.worker`: The ID of the current eris-fleet worker. This should be a number greater than or equal to 0.
- `this.ipc`: An eris-fleet [`IPC`](https://danclay.github.io/eris-fleet/classes/IPC.html) instance, useful for communication between worker processes.
- `this.origOptions`: The raw options object provided to the command by the command handler.
- `this.type`: The type of message that activated the command. Can be "classic" (a regular message) or "application" (slash commands).
- `this.channel`: An Eris [`TextChannel`](https://abal.moe/Eris/docs/TextChannel) object of the channel that the command was run in, useful for getting info about a server and how to respond to a message.
- `this.author`: An Eris [`User`](https://abal.moe/Eris/docs/User) object of the user who ran the command, or a [`Member`](https://abal.moe/Eris/docs/Member) object identical to `this.member` if run in a server as a slash command.
- `this.member`: An Eris [`Member`](https://abal.moe/Eris/docs/Member) object of the server member who ran the command. When running the command outside of a server, this parameter is undefined when run as a "classic" command or a [`User`](https://abal.moe/Eris/docs/User) object identical to `this.author` when run as a slash command.
- `this.options`: When run as a "classic" command, this is an object of special arguments (e.g. `--argument=true`) passed to the command. These arguments are stored in a key/value format, so following the previous example, `this.options.argument` would return true. When run as a slash command, this is an object of every argument passed to the command.

Some options are only available depending on the context/original message type, which can be checked with `this.type`. The options only available with "classic" messages are listed below:
- `this.message`: An Eris [`Message`](https://abal.moe/Eris/docs/Message) object of the message that the command was run from, useful for interaction.
- `this.args`: An array of text arguments passed to the command.
- `this.content`: A string of the raw content of the command message, excluding the prefix and command name.
- `this.reference`: An object that's useful if you ever decide to reply to a user inside the command. You can use [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign) to combine your message content with this parameter.

The options only available with "application"/slash commands are listed below:
- `this.interaction`: An Eris [`CommandInteraction`](https://abal.moe/Eris/docs/CommandInteraction) object of the incoming slash command data. 
- `this.optionsArray`: A raw array of command options. Should rarely be used.

Some static fields are also available and can be set depending on your command. These fields are listed below:
- `description`: Your command's description, which is shown in the help command.
- `aliases`: An array of command aliases. People will be able to run the command using these as well as the normal command name.
- `arguments`: An array of command argument types, which are shown in the help command.
- `flags`: An array of objects specifying command flags, or special arguments, that will be shown when running `help <command>` or a slash command. Example:
```js
static flags = [{
  name: "argument",
  type: Constants.ApplicationCommandOptionTypes.STRING, // translates to 3, see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
  description: "Does a thing",
  ...
}];
```
- `slashAllowed`: Specifies whether or not the command is available via slash commands.

## The `run` Function
The main JS code of your command is specified in the `run` function. This function should return a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) of your command output, which is why the `run` function [is an async function by default](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function). The return value inside the `Promise` should be either a string or an object; you should return a string whenever you intend to reply with plain text, or an object if you intend to reply with something else, such as an embed or attachment.