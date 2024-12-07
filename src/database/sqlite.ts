import { commands, messageCommands, disabledCache, disabledCmdCache, prefixCache } from "#utils/collections.js";
import type { Guild, GuildChannel } from "oceanic.js";
import type { Logger } from "#utils/logger.js";
import type { DBGuild, Tag } from "#utils/types.js";
import type { Database as BSQLite3Database, Statement as BSQLite3Statement } from "better-sqlite3";
import { Database as BunDatabase, type Statement as BunStatement } from "bun:sqlite";

// bun:sqlite is mostly compatible with better-sqlite3, but has a few minor type differences that don't really matter in our case
// here we attempt to bring the two closer together
let connection: {
  prepare: (query: string) => BSQLite3Statement | BunStatement;
  transaction: (func: () => void) => CallableFunction;
} & (BSQLite3Database | BunDatabase);

if (process.versions.bun) {
  const { Database } = await import("bun:sqlite");
  connection = new Database((process.env.DB as string).replace("sqlite://", ""), { create: true, readwrite: true, strict: true });
} else {
  const { default: sqlite3 } = await import("better-sqlite3");
  connection = sqlite3((process.env.DB as string).replace("sqlite://", ""));
}

const schema = `
CREATE TABLE guilds (
  guild_id VARCHAR(30) NOT NULL PRIMARY KEY,
  prefix VARCHAR(15) NOT NULL,
  disabled text NOT NULL,
  disabled_commands text NOT NULL
);
CREATE TABLE counts (
  command VARCHAR NOT NULL PRIMARY KEY,
  count integer NOT NULL
);
CREATE TABLE tags (
  guild_id VARCHAR(30) NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  author VARCHAR(30) NOT NULL,
  UNIQUE(guild_id, name)
);
CREATE TABLE settings (
  id smallint PRIMARY KEY,
  broadcast VARCHAR,
  CHECK(id = 1)
);
INSERT INTO settings (id) VALUES (1);
`;

const updates = [
  "", // reserved
  "ALTER TABLE guilds ADD COLUMN accessed int",
  "ALTER TABLE guilds DROP COLUMN accessed",
  `CREATE TABLE settings (
    id smallint PRIMARY KEY,
    broadcast VARCHAR,
    CHECK(id = 1)
  );
  INSERT INTO settings (id) VALUES (1);`,
];

export async function setup() {
  const existingCommands = (connection.prepare("SELECT command FROM counts").all() as { command: string }[]).map(x => x.command);
  const commandNames = [...commands.keys(), ...messageCommands.keys()];
  for (const command of existingCommands) {
    if (!commandNames.includes(command)) {
      connection.prepare("DELETE FROM counts WHERE command = ?").run(command);
    }
  }
  for (const command of commandNames) {
    if (!existingCommands.includes(command)) {
      connection.prepare("INSERT INTO counts (command, count) VALUES (?, ?)").run(command, 0);
    }
  }
}

export async function stop() {
  connection.close();
}

export async function upgrade(logger: Logger) {
  if (connection instanceof BunDatabase) {
    connection.exec("PRAGMA journal_mode = WAL;");
  } else {
    connection.pragma("journal_mode = WAL");
  }
  try {
    connection.transaction(() => {
      let version: number;
      if (connection instanceof BunDatabase) {
        const { user_version } = connection.prepare<{ user_version: number }, []>("PRAGMA user_version").get();
        version = user_version;
      } else {
        version = connection.pragma("user_version", { simple: true }) as number;
      }
      const latestVersion = updates.length - 1;
      if (version === 0) {
        logger.info("Initializing SQLite database...");
        connection.exec(schema);
      } else if (version < latestVersion) {
        logger.info(`Migrating SQLite database at ${process.env.DB}, which is currently at version ${version}...`);
        while (version < latestVersion) {
          version++;
          logger.info(`Running version ${version} update script...`);
          connection.exec(updates[version]);
        }
      } else if (version > latestVersion) {
        throw new Error(`SQLite database is at version ${version}, but this version of the bot only supports up to version ${latestVersion}.`);
      }
      // prepared statements don't seem to work here
      if (connection instanceof BunDatabase) {
        connection.exec(`PRAGMA user_version = ${latestVersion}`);
      } else {
        connection.pragma(`user_version = ${latestVersion}`);
      }
    })();
  } catch (e) {
    logger.error(`SQLite migration failed: ${e}`);
    logger.error("Unable to start the bot, quitting now.");
    return 1;
  }
}

export async function addCount(command: string) {
  connection.prepare("UPDATE counts SET count = count + 1 WHERE command = ?").run(command);
}

export async function getCounts() {
  const counts = connection.prepare("SELECT * FROM counts").all() as { command: string, count: number}[];
  const countMap = new Map(counts.map(val => [val.command, val.count]));
  return countMap;
}

export async function disableCommand(guild: string, command: string) {
  const guildDB = await getGuild(guild);
  connection.prepare("UPDATE guilds SET disabled_commands = ? WHERE guild_id = ?").run(JSON.stringify((guildDB.disabled_commands ? [...guildDB.disabled_commands, command] : [command]).filter((v) => !!v)), guild);
  disabledCmdCache.set(guild, guildDB.disabled_commands ? [...guildDB.disabled_commands, command] : [command].filter((v) => !!v));
}

export async function enableCommand(guild: string, command: string) {
  const guildDB = await getGuild(guild);
  const newDisabled = guildDB.disabled_commands ? guildDB.disabled_commands.filter(item => item !== command) : [];
  connection.prepare("UPDATE guilds SET disabled_commands = ? WHERE guild_id = ?").run(JSON.stringify(newDisabled), guild);
  disabledCmdCache.set(guild, newDisabled);
}

export async function disableChannel(channel: GuildChannel) {
  const guildDB = await getGuild(channel.guildID);
  connection.prepare("UPDATE guilds SET disabled = ? WHERE guild_id = ?").run(JSON.stringify([...guildDB.disabled, channel.id]), channel.guildID);
  disabledCache.set(channel.guildID, [...guildDB.disabled, channel.id]);
}

export async function enableChannel(channel: GuildChannel) {
  const guildDB = await getGuild(channel.guildID);
  const newDisabled = guildDB.disabled.filter((item: string) => item !== channel.id);
  connection.prepare("UPDATE guilds SET disabled = ? WHERE guild_id = ?").run(JSON.stringify(newDisabled), channel.guildID);
  disabledCache.set(channel.guildID, newDisabled);
}

export async function getTag(guild: string, tag: string) {
  const tagResult = connection.prepare("SELECT * FROM tags WHERE guild_id = ? AND name = ?").get(guild, tag) as Tag;
  return tagResult ? { content: tagResult.content, author: tagResult.author } : undefined;
}

export async function getTags(guild: string) {
  const tagArray = connection.prepare("SELECT * FROM tags WHERE guild_id = ?").all(guild) as Tag[];
  const tags = new Map(tagArray.map(tag => [tag.name, { content: tag.content, author: tag.author }]));
  return tags;
}

export async function setTag(name: string, content: Tag, guild: Guild) {
  const tag = {
    guild_id: guild.id,
    name: name,
    content: content.content,
    author: content.author
  };
  connection.prepare("INSERT INTO tags (guild_id, name, content, author) VALUES (@guild_id, @name, @content, @author)").run(tag);
}

export async function removeTag(name: string, guild: Guild) {
  connection.prepare("DELETE FROM tags WHERE guild_id = ? AND name = ?").run(guild.id, name);
}

export async function editTag(name: string, content: { content: string, author: string }, guild: Guild) {
  connection.prepare("UPDATE tags SET content = ?, author = ? WHERE guild_id = ? AND name = ?").run(content.content, content.author, guild.id, name);
}

export async function setBroadcast(msg: string) {
  connection.prepare("UPDATE settings SET broadcast = ? WHERE id = 1").run(msg);
}

export async function getBroadcast() {
  const result = connection.prepare("SELECT broadcast FROM settings WHERE id = 1").get() as { broadcast: string | null };
  return result.broadcast;
}

export async function setPrefix(prefix: string, guild: Guild) {
  connection.prepare("UPDATE guilds SET prefix = ? WHERE guild_id = ?").run(prefix, guild.id);
  prefixCache.set(guild.id, prefix);
}

export async function getGuild(query: string): Promise<DBGuild> {
  let guild: DBGuild;
  connection.transaction(() => {   
    guild = connection.prepare("SELECT * FROM guilds WHERE guild_id = ?").get(query) as DBGuild;
    if (!guild) {
      const guild_id = query;
      const prefix = process.env.PREFIX ?? "&";
      connection.prepare("INSERT INTO guilds (guild_id, prefix, disabled, disabled_commands) VALUES (@guild_id, @prefix, @disabled, @disabled_commands)").run({
        guild_id,
        prefix,
        disabled: "[]",
        disabled_commands: "[]"
      });
      guild = {
        guild_id,
        prefix,
        disabled: [],
        disabled_commands: []
      };
    }
  })();
  return guild;
}