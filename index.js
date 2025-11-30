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

// Optional: individual user IDs for mentions in welcome message
const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID || null;        // @echogrowth
const CSM1_USER_ID = process.env.CSM1_USER_ID || null;              // @odlyons
const CSM2_USER_ID = process.env.CSM2_USER_ID || null;              // @leovumanskiy1_62675
const FULFILMENT_USER_ID = process.env.FULFILMENT_USER_ID || null;  // @alexgrahamm
const OPERATIONS_USER_ID = process.env.OPERATIONS_USER_ID || null;  // @anton_9808

// Optional: #start-here channel ID for mention
const START_HERE_CHANNEL_ID = process.env.START_HERE_CHANNEL_ID || null;

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

    // ✅ Explicitly allow the bot itself so it can see/send in these channels
    overwrites.push({
      id: client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    });

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

    let teamChatChannel = null;

    for (let name of channelNames) {
      // Replace the literal word "name" with the client's firstname (lowercased)
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
// SEND ONBOARDING MESSAGE (SPLIT INTO 2 MESSAGES EXACTLY AS REQUESTED)
// ========================
if (teamChatChannel) {

  const clientMention = `<@${member.id}>`;

  const founderMention = FOUNDER_USER_ID ? `<@${FOUNDER_USER_ID}>` : "@echogrowth";
  const csm1Mention = CSM1_USER_ID ? `<@${CSM1_USER_ID}>` : "@odlyons";
  const csm2Mention = CSM2_USER_ID ? `<@${CSM2_USER_ID}>` : "@leovumanskiy1_62675";
  const fulfilmentMention = FULFILMENT_USER_ID ? `<@${FULFILMENT_USER_ID}>` : "@alexgrahamm";
  const opsMention = OPERATIONS_USER_ID ? `<@${OPERATIONS_USER_ID}>` : "@anton_9808";

  const startHereMention = START_HERE_CHANNEL_ID ? `<#${START_HERE_CHANNEL_ID}>` : "#📍│start-here";

  // -------------------------
  // MESSAGE 1 (FULL TEAM SECTION)
  // -------------------------
  const onboardingPart1 = `
✨ **Welcome to Echo Growth!**

Hey ${clientMention}! We’re genuinely excited to have you here.
By joining this community, you’ve partnered with a team that’s fully committed to helping you scale your agency, coaching, or consulting business, faster, smoother, and with way less stress.

From here on out, we’ll be working alongside you to fine-tune your offer, build your ads and funnel, set up the right automations, and launch campaigns that actually move the needle. You’re not just working with an agency — you’ve got a real growth partner in your corner.

⸻

👥 **Meet Your Team**

${founderMention} – **Founder**  
I’ll be guiding your overall strategy, shaping your offer, and helping you scale. Think of me as your go-to for anything big-picture.

${csm1Mention} and ${csm2Mention} – **Client Success Managers**  
Your CSMs, Oliver and Leo, are here to support you day-to-day. Anytime you need clarity, direction, or help getting unstuck, they’ve got you. They’ll walk you through each step, keep everything moving, and support you with campaign decisions.

${fulfilmentMention} – **Fulfilment Manager**  
Alex oversees all the building work — your scripts, ads, funnel, creative… everything. He makes sure whatever we launch is tight, polished, and high-quality.

${opsMention} – **Operations Manager**  
Anton keeps the entire engine running smoothly behind the scenes, making your onboarding and fulfillment feel seamless.

**Our Creative & Tech Team**  
These are the people handling editing, building, automations, and ongoing optimisation. You might not always see them, but you’ll definitely feel their work.
  `.trim();

  // -------------------------
  // MESSAGE 2 (CLOSING + START HERE)
  // -------------------------
  const onboardingPart2 = `
⸻

You’ve got a full team backing you now.  
Ask questions anytime, drop updates as you go, and use this Discord as your direct line to us.

Now let’s get started.  
Head over to ${startHereMention} and complete your intake form — this gives us everything we need to prep for your next call and hit the ground running.

We’re really looking forward to growing with you. 🚀
  `.trim();

  await teamChatChannel.send(onboardingPart1);
  await teamChatChannel.send(onboardingPart2);
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
