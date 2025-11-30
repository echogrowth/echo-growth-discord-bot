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

// Individual user IDs for mentions in welcome message
const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID || "1361785718900396315";
const CSM1_USER_ID = process.env.CSM1_USER_ID || "1018939468763373589";
const CSM2_USER_ID = process.env.CSM2_USER_ID || "1322178805359706213";
const FULFILMENT_USER_ID = process.env.FULFILMENT_USER_ID || "1394372856128733305";
const OPERATIONS_USER_ID = process.env.OPERATIONS_USER_ID || "775132202022600724";

// Hardcoded start-here channel ID (clickable)
const START_HERE_CHANNEL = "<#1431246046041997344>";

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
// READY EVENT
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
        console.log(`⚠ No firstname mapped for invite ${inviteCode}, fallback to displayName.`);
        firstname = member.displayName || member.user.username || "Client";
      } else {
        console.log(`Invite ${usedInvite.code} matched to firstname: ${firstname}`);
      }
    } else {
      console.log(`⚠ No used invite found for ${member.user.tag}.`);
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

    // Permissions
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      // Allow the bot itself
      {
        id: client.user.id,
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
    // CHANNEL TEMPLATE 
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

    let teamChatChannel = null;

    for (let name of channelNames) {
      const finalName = name.replace("name", firstname.toLowerCase());

      const createdChannel = await guild.channels.create({
        name: finalName,
        type: ChannelType.GuildText,
        parent: category.id
      });

      if (finalName.includes("team-chat")) {
        teamChatChannel = createdChannel;
      }
    }

    // ========================
// SEND ONBOARDING MESSAGE (ONE MESSAGE)
if (teamChatChannel) {
  const newMemberMention = `<@${member.id}>`;

  const founder = `<@1361785718900396315>`;
  const csm1 = `<@1018939468763373589>`;
  const csm2 = `<@1322178805359706213>`;
  const fulfilment = `<@1394372856128733305>`;
  const operations = `<@775132202022600724>`;
  const startHere = `<#1431246046041997344>`;

  const message = `
#✨ **Welcome to Echo Growth!**

Hey ${newMemberMention}, we’re genuinely excited to have you here.  
By joining this community, you’ve partnered with a team dedicated to helping you scale your agency, coaching, or consulting business — faster, smoother, and with a lot less stress.

From here on out, we’ll work with you to refine your offer, build your ads and funnel, set up the right automations, and launch campaigns that actually move the needle. You’re not just working with an agency — you’ve got a real growth partner.

⸻

👥 **Meet Your Team**

${founder} – **Founder**  
Guides your strategy, offer, and overall growth direction.

${csm1} & ${csm2} – **Client Success Managers**  
Your day-to-day support. If you need clarity, direction, or help getting unstuck, they’ve got you.

${fulfilment} – **Fulfilment Manager**  
Oversees scripts, ads, funnels, and creative to ensure everything we launch is high-quality.

${operations} – **Operations Manager**  
Keeps the entire process running smoothly so onboarding and fulfilment feel seamless.

**Creative & Tech Team**  
Handles editing, building, automations, optimisation, and all behind-the-scenes execution.

⸻

You’ve now got a full team backing you.  
Ask questions anytime, drop updates as you go, and use this Discord as your direct line to us.

**Next step:** Head over to ${startHere} and complete your intake form — this gives us everything we need to tailor your onboarding and hit the ground running.

We’re really looking forward to growing with you. 🚀
  `.trim();

  await teamChatChannel.send(message);
}

// ========================
// LOGIN BOT
// ========================
client.login(DISCORD_TOKEN);
