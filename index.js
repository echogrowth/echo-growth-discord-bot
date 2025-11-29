// ========================
// IMPORTS
// ========================
const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionFlagsBits 
} = require("discord.js");

const express = require("express");

// ========================
// ENV VARIABLES
// ========================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || null;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;

// ========================
// EXPRESS SERVER FOR ZAPIER
// ========================
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// inviteCode → firstname
const inviteMap = new Map();

// simple check
app.get("/", (req, res) => {
  res.send("Echo Growth Discord Bot is running.");
});

// Zapier posts inviteCode + firstname here
app.post("/invite-map", (req, res) => {
  const { inviteCode, firstname } = req.body;

  if (!inviteCode || !firstname) {
    return res.status(400).send("inviteCode and firstname required");
  }

  inviteMap.set(inviteCode, firstname);
  console.log(`Mapped ${inviteCode} → ${firstname}`);

  return res.send("ok");
});

app.listen(PORT, () => {
  console.log("HTTP server listening on port " + PORT);
});

// ========================
// DISCORD BOT SETUP
// ========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
});

// Track invite usage
const inviteUses = new Map();

// ========================
// READY EVENT (v14 SAFE)
// ========================
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    let guild;

    if (GUILD_ID) {
      guild = await client.guilds.fetch(GUILD_ID);
    } else {
      guild = client.guilds.cache.first();
    }

    if (!guild) {
      console.log("⚠ No guild found. Invite caching skipped.");
      return;
    }

    const invites = await guild.invites.fetch();
    invites.forEach(inv => inviteUses.set(inv.code, inv.uses));

    console.log("Cached existing invites.");
  } catch (err) {
    console.error("Error caching invites:", err);
  }
});

// ========================
// MEMBER JOIN EVENT
// ========================
client.on("guildMemberAdd", async (member) => {
  try {
    const guild = member.guild;
    const newInvites = await guild.invites.fetch();

    // Try to detect which invite was used
    let usedInvite = null;

    newInvites.forEach(inv => {
      const prev = inviteUses.get(inv.code) || 0;
      if (inv.uses > prev) {
        usedInvite = inv;
      }
      inviteUses.set(inv.code, inv.uses);
    });

    let firstname;

    if (usedInvite) {
      const inviteCode = usedInvite.code;
      firstname = inviteMap.get(inviteCode);

      if (!firstname) {
        console.log(`⚠ No firstname mapped for invite ${inviteCode}, falling back to displayName.`);
        firstname = member.displayName || member.user.username || "Client";
      } else {
        console.log(`Invite ${usedInvite.code} matched to firstname: ${firstname}`);
      }
    } else {
      console.log(`⚠ Could not find used invite for ${member.user.tag}, falling back to displayName.`);
      firstname = member.displayName || member.user.username || "Client";
    }

    firstname = firstname.trim();
    console.log(`Creating channels for: ${firstname}`);

    const categoryName = `${firstname} - Echo Growth`;

    // Create category
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory
    });

    // Permission rules
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

    // ========================
    // CHANNEL TEMPLATE (ORDERED)
    // ========================
    const channelNames = [
      "🤝│team-chat",
      "🧲│new-leads-name",
      "ℹ️│typeform-name",
      "🗓│new-calls-name",
      "📈│performance-intelligence",
      "📊│ad-intelligence",
      "🧬│funnel-diagnostics",
      "🗂│swipe-vault"
    ];

    for (let name of channelNames) {
      // Replace the literal word "name" with the client's firstname (lowercased)
      const finalName = name.replace("name", firstname.toLowerCase());

      await guild.channels.create({
        name: finalName,
        type: ChannelType.GuildText,
        parent: category.id
      });
    }

    console.log(`Created category + channels for ${firstname}`);
  } catch (err) {
    console.error("Error in guildMemberAdd:", err);
  }
});

// ========================
// LOGIN BOT
// ========================
client.login(DISCORD_TOKEN);
