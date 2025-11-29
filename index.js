const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require("discord.js");
const express = require("express");

// ---- CONFIG FROM ENVIRONMENT VARIABLES ----
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;         // your server ID
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null; // your internal team role (optional)

// ---- SIMPLE EXPRESS APP SO RENDER HAS A WEB SERVER ----
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Map: inviteCode => firstname
const inviteMap = new Map();

app.get("/", (req, res) => {
  res.send("Echo Growth Discord bot is running.");
});

// Zapier will POST here with { inviteCode, firstname }
app.post("/invite-map", (req, res) => {
  const { inviteCode, firstname } = req.body;

  if (!inviteCode || !firstname) {
    console.log("Bad /invite-map payload:", req.body);
    return res.status(400).send("inviteCode and firstname are required");
  }

  inviteMap.set(inviteCode, firstname);
  console.log(`Mapped invite ${inviteCode} -> ${firstname}`);
  return res.send("ok");
});

app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// ---- DISCORD BOT SETUP ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
});

// Track invite uses so we can see which invite was used
const inviteUses = new Map();

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const invites = await guild.invites.fetch();

    invites.forEach(inv => inviteUses.set(inv.code, inv.uses));
    console.log("Cached existing invites");
  } catch (err) {
    console.error("Error caching invites on ready:", err);
  }
});

// When someone joins the server
client.on("guildMemberAdd", async (member) => {
  try {
    const guild = member.guild;
    const newInvites = await guild.invites.fetch();

    // Find which invite increased its "uses"
    const usedInvite = newInvites.find(inv => {
      const previous = inviteUses.get(inv.code) || 0;
      return inv.uses > previous;
    });

    newInvites.forEach(inv => inviteUses.set(inv.code, inv.uses));

    if (!usedInvite) {
      console.log(`Could not determine used invite for ${member.user.tag}`);
      return;
    }

    const inviteCode = usedInvite.code;
    const firstname = inviteMap.get(inviteCode) || member.displayName;

    console.log(`Member ${member.user.tag} joined with invite ${inviteCode} mapped to ${firstname}`);

    const categoryName = `${firstname} - Echo Growth`;

    // Create the private category
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory
    });

    // Lock category so only this member + staff role can see
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }
    ];

    if (STAFF_ROLE_ID) {
      overwrites.push({
        id: STAFF_ROLE_ID,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      });
    }

    await category.permissionOverwrites.set(overwrites);

    // Create your 3 channels inside the category
    const channelNames = ["team-chat", "resources", "support"];

    for (const name of channelNames) {
      await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category.id
      });
    }

    console.log(`Created category "${categoryName}" with channels for ${member.user.tag}`);
  } catch (err) {
    console.error("Error handling guildMemberAdd:", err);
  }
});

client.login(DISCORD_TOKEN);
