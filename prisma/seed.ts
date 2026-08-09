import "dotenv/config";
import { config as loadEnvLocal } from "dotenv";
// Next.js loads `.env.local` (gitignored, holds the staging Cognito pool + any
// local overrides) with higher precedence than `.env`. Mirror that here so
// `prisma db seed` reaches the same staging auth pool the app uses.
loadEnvLocal({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserMFAPreferenceCommand,
  ListUsersInGroupCommand,
  UsernameExistsException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import { getEventCoords } from "../lib/australia-coords";

function seedCoords(city: string, state: string, coords?: [number, number]) {
  const [latitude, longitude] = coords ?? getEventCoords(city, state);
  return { latitude, longitude };
}

// Tier close dates are relative to seed time so the seeded catalogue stays
// valid (open/closed tiers) no matter when the seed is (re)run.
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PASSWORD = "Password123!";

const region       = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId   = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const userPoolName = userPoolId.split("_").pop() ?? "unknown";

const cognito = new CognitoIdentityProviderClient({ region });

type SeedUser = {
  email: string;
  isAdmin: boolean;
  displayName: string;
};

const SEED_USERS: SeedUser[] = [
  // Core test identities — emails are relied on by e2e + auth bypass, don't change
  { email: "marcus.stirling@startline.test",       isAdmin: true,  displayName: "Marcus Stirling" },
  { email: "sarah.mitchell@startline.test",    isAdmin: false, displayName: "Sarah Mitchell" },
  { email: "jade.nguyen@startline.test",         isAdmin: false, displayName: "Jade Nguyen" },
  { email: "tom.whitfield@startline.test",       isAdmin: false, displayName: "Tom Whitfield" },
  // Apex Endurance Events co-managers
  { email: "jack.obrien@startline.test",  isAdmin: false, displayName: "Jack O'Brien" },
  { email: "priya.sharma@startline.test", isAdmin: false, displayName: "Priya Sharma" },
  // Coastal Fitness Collective co-managers
  { email: "liam.oconnor@startline.test", isAdmin: false, displayName: "Liam O'Connor" },
  { email: "chloe.bennett@startline.test", isAdmin: false, displayName: "Chloe Bennett" },
  // Manager on both Apex and Coastal
  { email: "avery.quinn@startline.test", isAdmin: false, displayName: "Avery Quinn" },
  // Regular athletes (no organiser membership)
  { email: "harper.jones@startline.test",  isAdmin: false, displayName: "Harper Jones" },
  { email: "mateo.silva@startline.test",   isAdmin: false, displayName: "Mateo Silva" },
  { email: "aria.kapoor@startline.test",   isAdmin: false, displayName: "Aria Kapoor" },
  { email: "oscar.ngata@startline.test",   isAdmin: false, displayName: "Oscar Ngata" },
  { email: "sophie.moreau@startline.test", isAdmin: false, displayName: "Sophie Moreau" },
  { email: "lucas.tan@startline.test",     isAdmin: false, displayName: "Lucas Tan" },
];

// Deterministic profile photos for each seed user (Unsplash portraits).
const PROFILE_PICS: Record<string, string> = {
  "marcus.stirling@startline.test":  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80",
  "sarah.mitchell@startline.test":   "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80",
  "jade.nguyen@startline.test":      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80",
  "tom.whitfield@startline.test":    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  "jack.obrien@startline.test":      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
  "priya.sharma@startline.test":     "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
  "liam.oconnor@startline.test":     "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
  "chloe.bennett@startline.test":    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
  "avery.quinn@startline.test":      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80",
  "harper.jones@startline.test":     "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80",
  "mateo.silva@startline.test":      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80",
  "aria.kapoor@startline.test":      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80",
  "oscar.ngata@startline.test":      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  "sophie.moreau@startline.test":    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80",
  "lucas.tan@startline.test":        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&q=80",
};

// Discipline-appropriate cover photos for events that don't have one set.
const DISCIPLINE_COVERS: Record<string, string> = {
  running:   "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80",
  cycling:   "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=1200&q=80",
  swimming:  "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80",
  triathlon: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80",
  crossfit:  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
  hybrid:    "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80",
  functional_fitness: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80",
};

// Photo galleries per discipline (reused across events).
const DISCIPLINE_PHOTOS: Record<string, string[]> = {
  running:   ["https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80", "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80", "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=1200&q=80"],
  cycling:   ["https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=1200&q=80", "https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=1200&q=80", "https://images.unsplash.com/photo-1534787238916-9ba6764efd4f?w=1200&q=80"],
  swimming:  ["https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80", "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=1200&q=80", "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=80"],
  triathlon: ["https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80", "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1200&q=80", "https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?w=1200&q=80"],
  crossfit:  ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80", "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1200&q=80", "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80"],
  hybrid:    ["https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80", "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80", "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80"],
  functional_fitness: ["https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80", "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80", "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80"],
};

// Emails removed from SEED_USERS over time — cleaned out of Cognito on reseed so
// the pool doesn't accumulate stale accounts (AGENTS.md: "old Cognito users not
// auto-removed"). Best-effort: missing users are ignored.
const LEGACY_SEED_EMAILS = [
  "alex.turner@startline.test",
  "emma.reid@startline.test",
  "noah.kim@startline.test",
  "zoe.anderson@startline.test",
  "riley.smith@startline.test",
  "isla.murphy@startline.test",
  // Core identities were renamed to name-based emails (issue #109)
  "admin@startline.test",
  "organiser@startline.test",
  "user@startline.test",
  "member@startline.test",
];

// Who manages each organiser. Keyed by the creator's email.
const MEMBER_ROSTER: Record<string, { email: string; role: "OWNER" | "MANAGER" }[]> = {
  "sarah.mitchell@startline.test": [
    { email: "sarah.mitchell@startline.test",    role: "OWNER" },
    { email: "tom.whitfield@startline.test",       role: "MANAGER" },
    { email: "jack.obrien@startline.test",  role: "MANAGER" },
    { email: "priya.sharma@startline.test", role: "MANAGER" },
    { email: "avery.quinn@startline.test", role: "MANAGER" },
  ],
  "jade.nguyen@startline.test": [
    { email: "jade.nguyen@startline.test",        role: "OWNER" },
    { email: "liam.oconnor@startline.test", role: "MANAGER" },
    { email: "chloe.bennett@startline.test", role: "MANAGER" },
    { email: "avery.quinn@startline.test", role: "MANAGER" },
  ],
};

async function ensureCognitoUsers(): Promise<void> {
  console.log("  Ensuring seed users exist in Cognito…");
  let created = 0;
  for (const user of SEED_USERS) {
    try {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        TemporaryPassword: PASSWORD,
        MessageAction: "SUPPRESS",
      }));
      created++;
    } catch (e) {
      if (!(e instanceof UsernameExistsException)) throw e;
    }

    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      Password: PASSWORD,
      Permanent: true,
    }));

    if (user.isAdmin) {
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        GroupName: "admins",
      }));
      // Best-effort: SOFTWARE_TOKEN_MFA needs pool-level delivery config that
      // may not be set on a given pool. Seeding must not fail because of it.
      try {
        await cognito.send(new AdminSetUserMFAPreferenceCommand({
          UserPoolId: userPoolId,
          Username: user.email,
          SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
        }));
      } catch (e) {
        console.warn(`  WARN: could not enable SOFTWARE_TOKEN_MFA for ${user.email}:`, (e as Error).message?.split("\n")[0]);
      }
    }
  }
  console.log(`  Cognito: ${created} created, ${SEED_USERS.length - created} already existed`);
}

// Deletes Cognito accounts for emails that were removed from SEED_USERS, so the
// pool doesn't keep stale seed identities (AGENTS.md: old Cognito users not
// auto-removed). Best-effort — missing users are ignored.
async function removeLegacyCognitoUsers(): Promise<void> {
  for (const email of LEGACY_SEED_EMAILS) {
    try {
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email }));
      console.log(`  Cognito: removed legacy seed user ${email}`);
    } catch (e) {
      if ((e as { name?: string }).name === "UserNotFoundException") continue;
      console.warn(`  WARN: could not remove legacy seed user ${email}:`, (e as Error).message?.split("\n")[0]);
    }
  }
}

async function fetchCognitoSubs(): Promise<{
  subsByEmail: Record<string, string>;
  adminSubs: string[];
}> {
  const subsByEmail: Record<string, string> = {};
  for (const user of SEED_USERS) {
    try {
      const result = await cognito.send(new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
      }));
      const email = result.UserAttributes?.find(a => a.Name === "email")?.Value;
      if (email && result.Username) subsByEmail[email] = result.Username;
    } catch (err) {
      if ((err as { name?: string }).name === "UserNotFoundException") {
        console.warn(`  WARN: Seed user ${user.email} not found in Cognito — skipping`);
      } else {
        throw err;
      }
    }
  }

  const adminResp = await cognito.send(new ListUsersInGroupCommand({
    UserPoolId: userPoolId,
    GroupName: "admins",
  }));
  const adminSubs = (adminResp.Users ?? []).map(u => u.Username!);

  return { subsByEmail, adminSubs };
}

async function main() {
  console.log("🌱 Seeding database…\n");

  // CI (e2e) uses the __e2e_bypass cookie keyed on mock subs — never touch
  // Cognito there.
  const forceMockSubs = process.env.CI === "true";

  if (!userPoolId) {
    console.warn("  NEXT_PUBLIC_COGNITO_USER_POOL_ID not set — skipping Cognito seeding");
  } else if (forceMockSubs) {
    console.log("  CI detected — skipping Cognito seeding (using mock e2e subs)");
  } else {
    try {
      await removeLegacyCognitoUsers();
      await ensureCognitoUsers();
    } catch (e) {
      console.warn("  Cognito seeding skipped — insufficient permissions or pool unavailable:", (e as Error).message?.split("\n")[0]);
    }
  }

  let subsByEmail: Record<string, string> = {};
  let adminSubs: string[] = [];
  // CI (e2e) runs against a real DB but uses the __e2e_bypass cookie, whose
  // identities are keyed on the mock `dev-bypass-*` subs. Force mock subs in
  // CI so the bypass users exist locally; only contact Cognito otherwise.
  if (userPoolId && !forceMockSubs) {
    try {
      const result = await fetchCognitoSubs();
      subsByEmail = result.subsByEmail;
      adminSubs = result.adminSubs;
    } catch (e) {
      console.warn("  Fetching Cognito subs skipped:", (e as Error).message?.split("\n")[0]);
    }
  }
  // When Cognito isn't reachable, use mock subs so seed still populates the DB
  if (Object.keys(subsByEmail).length === 0) {
    console.warn("  Using mock Cognito subs (no real Cognito pool reachable)");
    subsByEmail = {};
    // e2e bypass identities are keyed on these subs in lib/amplify-server.ts —
    // keep them stable regardless of the user's email address.
    const CORE_MOCK_SUBS: Record<string, string> = {
      "marcus.stirling@startline.test": "dev-bypass-admin",
      "sarah.mitchell@startline.test":  "dev-bypass-organiser",
      "jade.nguyen@startline.test":     "dev-bypass-user",
      "tom.whitfield@startline.test":   "dev-bypass-member",
    };
    for (const user of SEED_USERS) {
      subsByEmail[user.email] = CORE_MOCK_SUBS[user.email]
        ?? `dev-bypass-${user.email.split("@")[0].replace(/[^a-z0-9_-]/gi, "-")}`;
    }
    adminSubs = SEED_USERS.filter((u) => u.isAdmin)
      .map((u) => subsByEmail[u.email])
      .filter(Boolean) as string[];
  }
  console.log(`  Cognito users found: ${Object.keys(subsByEmail).length}`);

  await prisma.adminAuditLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.savedEvent.deleteMany();
  await prisma.organiserFollow.deleteMany();
  await prisma.review.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.event.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.organiserMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.waitlistSubscriber.deleteMany();
  await prisma.organiser.deleteMany();
  console.log("  Cleared existing data");

  // ── Admin ────────────────────────────────────────────────────────────
  const adminRecords: { id: string; email: string; name: string | null }[] = [];
  for (const user of SEED_USERS) {
    if (!user.isAdmin) continue;
    const sub = subsByEmail[user.email];
    if (!sub) continue;
    const record = await prisma.admin.create({
      data: { cognitoSub: sub, email: user.email, name: user.displayName },
    });
    adminRecords.push(record);
  }
  console.log(`  Admins: ${adminRecords.length}`);

  // ── Users ────────────────────────────────────────────────────────
  const userBySub: Record<string, string> = {};
  for (const user of SEED_USERS) {
    const sub = subsByEmail[user.email];
    if (!sub) {
      console.warn(`  WARN: Cognito user not found for ${user.email} — skipping`);
      continue;
    }
    const record = await prisma.user.upsert({
      where: { cognitoSub: sub },
      update: user.email === "jade.nguyen@startline.test"
        ? {
            name: user.displayName,
            username: "jade-nguyen",
            bio: "Hybrid athlete based in Sydney. Chasing PBs and start lines.",
            city: "Sydney",
            state: "nsw",
            isPublic: true,
            profilePicUrl: PROFILE_PICS[user.email] ?? null,
          }
        : { profilePicUrl: PROFILE_PICS[user.email] ?? null },
      create: {
        cognitoSub: sub,
        email: user.email,
        name: user.displayName,
        username: user.email === "jade.nguyen@startline.test"
          ? "jade-nguyen"
          : user.email.split("@")[0].replace(/[^a-z0-9]/gi, "-").toLowerCase().replace(/^-+|-+$/g, ""),
        profilePicUrl: PROFILE_PICS[user.email] ?? null,
        ...(user.isAdmin ? { mfaEnabled: true } : {}),
        ...(user.email === "jade.nguyen@startline.test"
          ? {
              bio: "Hybrid athlete based in Sydney. Chasing PBs and start lines.",
              city: "Sydney",
              state: "nsw",
              isPublic: true,
            }
          : {}),
      },
    });
    userBySub[sub] = record.id;
  }
  console.log(`  Users: ${SEED_USERS.length}`);

  // ── Organiser ────────────────────────────────────────────────────────
  const orgSub = subsByEmail["sarah.mitchell@startline.test"];
  let orgRecord: { id: string; email: string; orgName: string | null; instagram: string | null; facebook: string | null } | null = null;

  if (orgSub) {
    const userId = userBySub[orgSub];
    if (userId) {
      orgRecord = await prisma.organiser.create({
        data: {
          createdBy: userId,
          email: "sarah.mitchell@startline.test",
          verified: true,
          status: "APPROVED",
          orgName: "Apex Endurance Events",
          contactName: "Test Organiser",
          contactEmail: "sarah.mitchell@startline.test",
          phone: "+61 400 000 000",
          abn: "51 824 753 556",
          website: "https://startlineau.com",
          instagram: "apexenduranceevents",
          facebook: "apexenduranceevents",
          bio: "Melbourne-based crew behind The Apex Throwdown and the Hybrid Hustle Series. We've been putting on functional fitness and endurance events across Victoria since 2019 — athlete-first programming, tight heat schedules, and a finish-line party worth staying for.",
          logoUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80",
          coverImageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1600&q=80",
          photos: [],
        },
      });
      // Apex roster (includes creator as OWNER) — issue #109
      for (const m of MEMBER_ROSTER["sarah.mitchell@startline.test"]) {
        const memberUserId = userBySub[subsByEmail[m.email]];
        if (!memberUserId) continue;
        await prisma.organiserMember.create({
          data: { organiserId: orgRecord.id, userId: memberUserId, role: m.role },
        });
      }
    }
  }

  if (!orgRecord) {
    console.warn("  Organiser record not created — skipping events that depend on it");
  } else {
    console.log("  Organiser: 1 (Apex Endurance Events)");
  }

  const org = orgRecord;
  if (!org) {
    console.log("  Events: 0 (no organiser)");
    console.log("  Seed complete (DB-only, no auth)");
    return;
  }

  // Second organiser — links to the plain jade.nguyen@startline.test account so we
  // have more than one organiser to browse. No new Cognito user needed.
  const coastalUserId = userBySub[subsByEmail["jade.nguyen@startline.test"]];
  let coastalOrg: { id: string } | null = null;
  if (coastalUserId) {
    const coastalRecord = await prisma.organiser.create({
      data: {
        createdBy: coastalUserId,
        email: "jade.nguyen@startline.test",
        verified: true,
        status: "APPROVED",
        orgName: "Coastal Fitness Collective",
        contactName: "Test User",
        contactEmail: "jade.nguyen@startline.test",
        phone: "+61 400 000 001",
        abn: "12 345 678 901",
        website: "https://startlineau.com",
        instagram: "coastalfitnesscollective",
        facebook: "coastalfitnesscollective",
        bio: "Coastal race organisers running ocean swims, triathlons and running events up and down the east coast.",
        logoUrl: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80",
        coverImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80",
        photos: [],
      },
    });
    coastalOrg = { id: coastalRecord.id };
    // Coastal roster (includes creator as OWNER) — issue #109
    for (const m of MEMBER_ROSTER["jade.nguyen@startline.test"]) {
      const memberUserId = userBySub[subsByEmail[m.email]];
      if (!memberUserId) continue;
      await prisma.organiserMember.create({
        data: { organiserId: coastalRecord.id, userId: memberUserId, role: m.role },
      });
    }
  } else {
    console.warn("  Second organiser not created — no user record for jade.nguyen@startline.test");
  }
  if (coastalOrg) console.log("  Organiser: 2 (Coastal Fitness Collective)");

  const platformFeeCents = (amountCents: number) =>
    Math.round(amountCents * 0.0395) + 145;

  // ── Events ───────────────────────────────────────────────────────────

  // Fully populated example event — exercises every field the listing wizard
  // collects, so the public event page can be reviewed with realistic data.
  const apexThrowdown = {
    status: "APPROVED" as const,
    title: "The Apex Throwdown 2026",
    discipline: "crossfit",
    tagline: "Two days. One leaderboard. Every rep counts.",
    description: [
      "<p>Victoria's premier functional fitness competition returns for its fourth year. Six scored events across two days, programmed to test every energy system — raw strength, engine, and skill under fatigue. Whether you're chasing a podium or your first competition floor, there's a division for you.</p>",
      "<h3>The Format</h3>",
      "<ul>",
      "<li><b>Day 1 — Saturday:</b> Three scored events, including a max-lift ladder and a partner chipper</li>",
      "<li><b>Day 2 — Sunday:</b> Two scored events, then the finale — top 10 per division only</li>",
      "</ul>",
      "<h3>Divisions</h3>",
      "<p>Scaled, RX and Elite divisions for individual athletes, plus a Team-of-2 division (any gender mix). Every division gets its own podium and share of the prize pool.</p>",
      "<h3>What's Included</h3>",
      "<ul>",
      "<li>Event t-shirt and finisher medal</li>",
      "<li>Live leaderboard with online score tracking</li>",
      "<li>Athlete recovery zone with physios on site</li>",
      "<li>Post-event party at the venue bar</li>",
      "</ul>",
      "<h4>Athlete check-in</h4>",
      "<p>Check-in opens 6:45am at Gate 3, bag drop available. First heat briefing is 7:15am sharp — don't be late.</p>",
    ].join(""),
    eventDate: "2026-08-15", endDate: "2026-08-16", startTime: "07:30", endTime: "17:00",
    venue: "Melbourne Sports & Aquatic Centre", address: "30 Aughtie Drive, Albert Park",
    city: "Melbourne", state: "vic", ...seedCoords("Melbourne", "vic", [-37.8686, 144.9686]), format: "both", level: "high",
    categories: ["Individual Scaled", "Individual RX", "Individual Elite", "Team of 2"],
    cap: 320, minAge: 16,
    waves: [
      { label: "Early Bird", price: "95",  closes: isoDaysFromNow(-120), startTime: "",      qty: 80  },
      { label: "General",    price: "115", closes: isoDaysFromNow(-30),  startTime: "",      qty: 150 },
      { label: "Late Entry", price: "135", closes: isoDaysFromNow(14),   startTime: "09:00", qty: 90  },
    ],
    // Organiser-built start waves (heats) banded by estimated finish time.
    startWaves: [
      { id: "sw-a", label: "Wave A", startTime: "07:30", capacity: null, finishMin: null, finishMax: 50, genders: [], ageMin: null, ageMax: null },
      { id: "sw-b", label: "Wave B", startTime: "07:45", capacity: null, finishMin: 51, finishMax: 75, genders: [], ageMin: null, ageMax: null },
      { id: "sw-c", label: "Wave C", startTime: "08:00", capacity: null, finishMin: 76, finishMax: null, genders: [], ageMin: null, ageMax: null },
    ],
    inclusions: "Event t-shirt, finisher medal, post-event party, online score tracking",
    extras: "Prize pool: 8,000 — Awarded to podium finishers per division", activations: "Vendor expo Friday evening.",
    refundPolicy: "Full refund 30+ days out. 50% refund 14–30 days. Deferrals accepted. Free transfer to another athlete until 7 August 2026.",
    registrationType: "startline", feeStructure: "athlete",
    coverImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80",
    photos: [
      "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80",
      "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80",
      "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=1200&q=80",
      "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80",
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80",
      "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=1200&q=80",
    ],
    bagDrop: "Bag drop at Gate 3 from 6:45am.", parking: "MSAC car park $12/day.", accessibilityInfo: "Wheelchair accessible venue.",
  };

  const event1 = await prisma.event.upsert({
    where:  { id: "seed-event-001" },
    update: apexThrowdown,
    create: { id: "seed-event-001", organiserId: org.id, ...apexThrowdown },
  });

  // Mirror the event's JSON start waves into the StartWave table — the new source
  // of truth. Idempotent via the (eventId, label) unique key. Registrations below
  // link to these by id as well as carrying the denormalised label.
  const startWaveIdByLabel: Record<string, string> = {};
  for (let i = 0; i < apexThrowdown.startWaves.length; i++) {
    const w = apexThrowdown.startWaves[i];
    const swData = {
      startTime: w.startTime || null,
      capacity: w.capacity,
      finishMin: w.finishMin,
      finishMax: w.finishMax,
      genders: w.genders,
      ageMin: w.ageMin,
      ageMax: w.ageMax,
      sortOrder: i,
    };
    const sw = await prisma.startWave.upsert({
      where:  { eventId_label: { eventId: event1.id, label: w.label } },
      update: swData,
      create: { eventId: event1.id, label: w.label, ...swData },
    });
    startWaveIdByLabel[w.label] = sw.id;
  }

  const event2 = await prisma.event.upsert({
    where: { id: "seed-event-002" }, update: {},
    create: {
      id: "seed-event-002", organiserId: org.id, status: "PENDING", photos: DISCIPLINE_PHOTOS.hybrid,
      title: "Hybrid Hustle Series — Round 3", discipline: "hybrid",
      tagline: "Run. Lift. Repeat.",
      description: "Trail running, loaded carries, obstacle crawls, and a surprise finale.",
      eventDate: "2026-09-06", startTime: "08:00", endTime: "14:00",
      venue: "Kokoda Track Memorial Walkway", city: "Scoresby", state: "vic", ...seedCoords("Scoresby", "vic"),
      format: "individual", level: "open", categories: ["Open Male", "Open Female", "Masters 40+"],
      cap: 150, minAge: 16, waves: [{ label: "General Entry", date: "2026-07-01", price: "75", qty: 150 }],
      inclusions: "Race entry, finisher medal, recovery snack bag", refundPolicy: "Flexible",
      registrationType: "startline", feeStructure: "athlete",
      coverImageUrl: DISCIPLINE_COVERS.hybrid,
    },
  });

  const event3 = await prisma.event.upsert({
    where: { id: "seed-event-003" }, update: {},
    create: {
      id: "seed-event-003", organiserId: org.id, status: "DRAFT", photos: DISCIPLINE_PHOTOS.functional_fitness,
      title: "Team Throwdown Summer Series", discipline: "functional_fitness",
      tagline: "", description: "Draft — details TBC",
      eventDate: "2026-12-05", startTime: "09:00", endTime: "15:00",
      venue: "TBC", city: "Sydney", state: "nsw", ...seedCoords("Sydney", "nsw"), format: "team", level: "open",
      categories: [], waves: [], registrationType: "startline", feeStructure: "athlete",
      coverImageUrl: DISCIPLINE_COVERS.functional_fitness,
    },
  });

  const event4 = await prisma.event.upsert({
    where: { id: "seed-event-004" }, update: {},
    create: {
      id: "seed-event-004", organiserId: org.id, status: "REJECTED", photos: DISCIPLINE_PHOTOS.running,
      title: "Autumn Run Festival", discipline: "running",
      tagline: "5K, 10K through the Yarra Valley",
      description: "A scenic trail run through the Yarra Valley vineyards.",
      eventDate: "2026-04-11", startTime: "07:30", endTime: "13:00",
      venue: "Yering Station", city: "Yering", state: "vic", ...seedCoords("Yering", "vic"),
      format: "individual", level: "open", categories: ["5K", "10K", "Half Marathon"],
      cap: 500, waves: [{ label: "5K Entry", price: "45" }, { label: "10K Entry", price: "55" }, { label: "Half Marathon", price: "75" }],
      registrationType: "startline", feeStructure: "athlete", refundPolicy: "Firm",
      rejectionReason: "Event date has already passed.", reviewedAt: new Date("2026-04-01T09:00:00Z"),
      coverImageUrl: DISCIPLINE_COVERS.running,
    },
  });

  const seedEvents = [
    { id: "seed-event-005", status: "APPROVED" as const, title: "Sydney Harbour 10K",         discipline: "running",   eventDate: "2026-09-20", startTime: "07:00", endTime: "10:00", venue: "Mrs Macquaries Chair",           city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["5K", "10K"],              cap: 2000, waves: [{ label: "General", price: "55" }], tagline: "Run past the Opera House", description: "A scenic 10K through Sydney's foreshore parks and past iconic landmarks." },
    { id: "seed-event-006", status: "APPROVED" as const, title: "Gold Coast Marathon Weekend", discipline: "running",   eventDate: "2026-07-05", startTime: "06:00", endTime: "14:00", venue: "Gold Coast Highway",             city: "Gold Coast", state: "qld", org: "coastal", format: "individual", level: "open",  categories: ["Marathon", "Half Marathon", "10K", "5K"], cap: 5000, waves: [{ label: "Marathon Entry", price: "120" }, { label: "Half Marathon", price: "85" }, { label: "10K Entry", price: "50" }], tagline: "Flat, fast, coastal", description: "Australia's premier marathon along the Gold Coast beachfront." },
    { id: "seed-event-007", status: "APPROVED" as const, title: "Uluru Sunset Run",            discipline: "running",   eventDate: "2026-10-12", startTime: "16:00", endTime: "19:00", venue: "Uluru-Kata Tjuta National Park",  city: "Uluru",   state: "nt",  format: "individual", level: "open",  categories: ["5K Fun Run", "10K Trail"], cap: 500, waves: [{ label: "General", price: "65" }], tagline: "Run at sunset", description: "A once-in-a-lifetime trail run around the base of Uluru at sunset." },
    { id: "seed-event-008", status: "APPROVED" as const, title: "Melbourne Marathon Festival",  discipline: "running",   eventDate: "2026-10-12", startTime: "07:00", endTime: "15:00", venue: "MCG",                             city: "Melbourne", state: "vic", coords: [-37.8199, 144.9834] as [number, number], format: "individual", level: "open",  categories: ["Marathon", "Half Marathon", "10K", "5K"], cap: 8000, waves: [{ label: "Marathon", price: "110" }, { label: "Half", price: "75" }], tagline: "Finish on the 'G", description: "Iconic marathon finishing inside the Melbourne Cricket Ground." },
    { id: "seed-event-010", status: "APPROVED" as const, title: "Around the Bay 2026",          discipline: "cycling",   eventDate: "2026-10-11", startTime: "06:30", endTime: "15:00", venue: "Albert Park Circuit",             city: "Melbourne", state: "vic", coords: [-37.8479, 144.9670] as [number, number], format: "individual", level: "open",  categories: ["210K", "100K", "50K", "35K"], cap: 10000, waves: [{ label: "210K Entry", price: "110" }, { label: "100K Entry", price: "75" }], tagline: "Ride around Port Phillip Bay", description: "Australia's biggest bike ride." },
    { id: "seed-event-011", status: "APPROVED" as const, title: "Tour de Brisbane Gran Fondo",  discipline: "cycling",   eventDate: "2026-08-30", startTime: "06:00", endTime: "14:00", venue: "Brisbane City Hall",              city: "Brisbane", state: "qld", format: "individual", level: "open",  categories: ["160K Gran Fondo", "100K Medio", "50K Corto"], cap: 3000, waves: [{ label: "Gran Fondo", price: "95" }, { label: "Medio", price: "75" }], tagline: "Climb the Cootha", description: "Gran fondo through Brisbane's scenic hinterland." },
    { id: "seed-event-012", status: "APPROVED" as const, title: "Perth Twilight Criterium",    discipline: "cycling",   eventDate: "2026-12-12", startTime: "17:00", endTime: "21:00", venue: "Perth CBD Circuit",               city: "Perth",   state: "wa",  format: "individual", level: "open",  categories: ["Elite Men", "Elite Women", "B Grade", "C Grade"], cap: 200, waves: [{ label: "Elite Entry", price: "35" }, { label: "Grade Entry", price: "25" }], tagline: "Night racing in the city", description: "Fast twilight criterium racing through the streets of Perth CBD." },
    { id: "seed-event-013", status: "APPROVED" as const, title: "Seven Hills of Hobart Ride",  discipline: "cycling",   eventDate: "2026-11-22", startTime: "07:00", endTime: "13:00", venue: "Hobart Waterfront",               city: "Hobart", state: "tas", format: "individual", level: "open",  categories: ["Full Course", "Short Course"], cap: 500, waves: [{ label: "Full", price: "60" }], tagline: "Conquer the hills", description: "A challenging ride tackling Hobart's seven iconic hills." },
    { id: "seed-event-014", status: "APPROVED" as const, title: "Bondi to Bronte Ocean Swim",   discipline: "swimming",  eventDate: "2026-12-20", startTime: "08:00", endTime: "11:00", venue: "Bondi Beach",                    city: "Sydney",   state: "nsw", org: "coastal", format: "individual", level: "open",  categories: ["2.4K Swim", "1.2K Swim", "600m"], cap: 1500, waves: [{ label: "2.4K", price: "45" }, { label: "1.2K", price: "35" }], tagline: "Swim the iconic coastline", description: "Australia's most famous ocean swim from Bondi to Bronte." },
    { id: "seed-event-015", status: "APPROVED" as const, title: "Rottnest Channel Swim",       discipline: "swimming",  eventDate: "2026-02-21", startTime: "05:45", endTime: "14:00", venue: "Cottesloe Beach to Rottnest",     city: "Perth",   state: "wa", org: "coastal", format: "both", level: "open",  categories: ["Solo", "Duo", "Team of 4"], cap: 2500, waves: [{ label: "Solo Entry", price: "180" }, { label: "Team Entry (per person)", price: "80" }], tagline: "Swim the channel to Rotto", description: "The legendary 19.7K open water swim to Rottnest Island." },
    { id: "seed-event-016", status: "APPROVED" as const, title: "Kiama Harbour Swim",           discipline: "swimming",  eventDate: "2026-11-15", startTime: "09:00", endTime: "11:00", venue: "Kiama Harbour",                  city: "Kiama",   state: "nsw", org: "coastal", format: "individual", level: "open",  categories: ["1K", "2K", "400m Junior"], cap: 400, waves: [{ label: "1K", price: "30" }, { label: "2K", price: "40" }], tagline: "Swim in the blowhole region", description: "A protected harbour swim in the beautiful Kiama region." },
    { id: "seed-event-017", status: "APPROVED" as const, title: "Noosa Triathlon 2026",         discipline: "triathlon", eventDate: "2026-10-31", startTime: "06:00", endTime: "16:00", venue: "Noosa Main Beach",               city: "Noosa",   state: "qld", org: "coastal", format: "individual", level: "open",  categories: ["Olympic", "Sprint", "Enticer"], cap: 8000, waves: [{ label: "Olympic", price: "180" }, { label: "Sprint", price: "120" }], tagline: "Race the original", description: "Australia's largest triathlon in the stunning Sunshine Coast setting." },
    { id: "seed-event-018", status: "APPROVED" as const, title: "Ironman Western Australia",    discipline: "triathlon", eventDate: "2026-12-06", startTime: "05:30", endTime: "23:59", venue: "Busselton Jetty",                city: "Busselton", state: "wa", org: "coastal", format: "individual", level: "open",  categories: ["Ironman", "70.3"], cap: 3000, waves: [{ label: "Full Ironman", price: "750" }, { label: "70.3", price: "350" }], tagline: "Swim under the jetty", description: "Full distance ironman starting at the iconic Busselton Jetty." },
    { id: "seed-event-019", status: "APPROVED" as const, title: "Sydney Triathlon Series R3",   discipline: "triathlon", eventDate: "2026-11-08", startTime: "06:30", endTime: "12:00", venue: "Sydney Olympic Park",             city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Olympic", "Sprint"], cap: 1500, waves: [{ label: "Olympic", price: "130" }, { label: "Sprint", price: "85" }], tagline: "Olympic course", description: "Triathlon racing on the Sydney 2000 Olympic course." },

    { id: "seed-event-022", status: "APPROVED" as const, title: "CrossFit Games Open 2026",     discipline: "crossfit",  eventDate: "2026-03-01", startTime: "08:00", endTime: "20:00", venue: "Allied HQ",                      city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Rx", "Scaled"], cap: 200, waves: [{ label: "Rx", price: "20" }], tagline: "Test your fitness", description: "The CrossFit Open at Allied HQ." },
    { id: "seed-event-023", status: "APPROVED" as const, title: "F45 Championship World Final",  discipline: "crossfit",  eventDate: "2026-11-14", startTime: "09:00", endTime: "18:00", venue: "Qudos Bank Arena",               city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Men's Pro", "Women's Pro", "Team"], cap: 1000, waves: [{ label: "Pro Entry", price: "150" }, { label: "Team Entry", price: "300" }], tagline: "World finals in Sydney", description: "The F45 Championship World Finals at Qudos Bank Arena." },
    { id: "seed-event-024", status: "APPROVED" as const, title: "Torian Pro 2026",              discipline: "crossfit",  eventDate: "2026-05-30", startTime: "07:00", endTime: "17:00", venue: "Brisbane Convention Centre",      city: "Brisbane", state: "qld", org: "coastal", format: "both", level: "open",  categories: ["Elite Men", "Elite Women", "Teams"], cap: 400, waves: [{ label: "Spectator Weekend", price: "95" }, { label: "Team Entry", price: "250" }], tagline: "Pacific's fittest", description: "One of the biggest CrossFit competitions in the Southern Hemisphere." },
    { id: "seed-event-025", status: "APPROVED" as const, title: "True Grit 10K OCR",            discipline: "hybrid",    eventDate: "2026-08-22", startTime: "07:00", endTime: "15:00", venue: "Laratinga Wetlands",              city: "Mount Barker", state: "sa",  format: "individual", level: "open",  categories: ["Elite", "Open", "Junior"], cap: 1500, waves: [{ label: "Elite", price: "85" }, { label: "Open", price: "65" }], tagline: "Mud. Sweat. Grit.", description: "South Australia's premier obstacle course race." },
    { id: "seed-event-026", status: "APPROVED" as const, title: "Spartan Trifecta Weekend",      discipline: "hybrid",    eventDate: "2026-11-28", startTime: "06:00", endTime: "17:00", venue: "Sunningdale Trails",              city: "Canberra", state: "act", org: "coastal", format: "individual", level: "open",  categories: ["Sprint", "Super", "Beast", "Ultra"], cap: 3000, waves: [{ label: "Sprint", price: "110" }, { label: "Beast", price: "180" }, { label: "Trifecta Pass", price: "320" }], tagline: "Complete the trifecta", description: "A full Spartan weekend across the Canberra trails." },
    { id: "seed-event-027", status: "APPROVED" as const, title: "Tough Mudder Sydney",          discipline: "hybrid",    eventDate: "2026-07-18", startTime: "08:00", endTime: "16:00", venue: "Penrith Whitewater Stadium",      city: "Sydney",   state: "nsw", org: "coastal", format: "both", level: "open",  categories: ["Classic", "Team"], cap: 4000, waves: [{ label: "Classic", price: "130" }, { label: "Team (4+)", price: "110" }], tagline: "Teamwork makes the dream work", description: "The iconic mud run with 25+ obstacles at Penrith Whitewater." },

    // Apex Endurance — previous events (past dates for the organiser archive carousel)
    { id: "seed-event-040", status: "APPROVED" as const, title: "The Apex Throwdown 2025",       discipline: "crossfit",  eventDate: "2025-08-16", startTime: "07:30", endTime: "17:00", venue: "Melbourne Sports & Aquatic Centre", city: "Melbourne", state: "vic", coords: [-37.8686, 144.9686] as [number, number], format: "individual", level: "open", categories: ["Scaled", "RX", "Elite"], cap: 400, waves: [{ label: "Early Bird", price: "95" }, { label: "General", price: "115" }], tagline: "Where it all started", description: "The third edition of Victoria's premier functional fitness competition.", coverImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80" },
    { id: "seed-event-041", status: "APPROVED" as const, title: "Hybrid Hustle Series — Round 1", discipline: "hybrid",   eventDate: "2025-11-08", startTime: "08:00", endTime: "14:00", venue: "Kokoda Track Memorial Walkway", city: "Scoresby", state: "vic", format: "individual", level: "open", categories: ["Open Male", "Open Female"], cap: 150, waves: [{ label: "General Entry", price: "75" }], tagline: "Run. Lift. Repeat.", description: "Season opener for the Hybrid Hustle Series through the Dandenongs.", coverImageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80" },
    { id: "seed-event-042", status: "APPROVED" as const, title: "Hybrid Hustle Series — Round 2", discipline: "hybrid",   eventDate: "2026-02-14", startTime: "08:00", endTime: "14:00", venue: "You Yangs Regional Park", city: "Little River", state: "vic", format: "individual", level: "open", categories: ["Open Male", "Open Female", "Masters 40+"], cap: 180, waves: [{ label: "General Entry", price: "80" }], tagline: "Dust, hills, and loaded carries", description: "Round 2 pushed athletes through the You Yangs trails and granite climbs.", coverImageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80" },
    { id: "seed-event-043", status: "APPROVED" as const, title: "Apex Winter Classic",           discipline: "crossfit",  eventDate: "2026-06-07", startTime: "08:00", endTime: "16:00", venue: "CrossFit South Yarra", city: "Melbourne", state: "vic", coords: [-37.8380, 144.9960] as [number, number], format: "both", level: "open", categories: ["Individual", "Team of 2"], cap: 220, waves: [{ label: "Individual", price: "90" }, { label: "Team (per person)", price: "70" }], tagline: "Cold start. Hot finish.", description: "A one-day winter throwdown with three scored workouts and a packed spectator floor.", coverImageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80" },
    { id: "seed-event-044", status: "APPROVED" as const, title: "Apex Bay Run",                 discipline: "running",   eventDate: "2026-03-22", startTime: "07:00", endTime: "11:00", venue: "Albert Park Lake", city: "Melbourne", state: "vic", coords: [-37.8481, 144.9602] as [number, number], format: "individual", level: "open", categories: ["5K", "10K", "Half Marathon"], cap: 1200, waves: [{ label: "5K", price: "35" }, { label: "10K", price: "45" }, { label: "Half", price: "65" }], tagline: "Flat and fast around the lake", description: "Apex's community run around Albert Park — perfect for PBs and first-timers.", coverImageUrl: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80" },
    { id: "seed-event-045", status: "APPROVED" as const, title: "Apex Team Relay Challenge",    discipline: "hybrid",    eventDate: "2025-12-06", startTime: "09:00", endTime: "15:00", venue: "MSAC Outdoor Courts", city: "Melbourne", state: "vic", coords: [-37.8686, 144.9686] as [number, number], format: "team", level: "open", categories: ["Teams of 4"], cap: 80, waves: [{ label: "Team Entry", price: "280" }], tagline: "Four athletes. One finish line.", description: "A festive team relay mixing runs, carries, and partner workouts.", coverImageUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80" },
  ];

  for (const e of seedEvents) {
    const ownerId = e.org === "coastal" ? (coastalOrg?.id ?? org.id) : org.id;
    await prisma.event.upsert({
      where: { id: e.id }, update: {},
      create: { id: e.id, organiserId: ownerId, status: e.status, title: e.title, discipline: e.discipline,
        photos: DISCIPLINE_PHOTOS[e.discipline] ?? [],
        tagline: e.tagline, description: e.description, eventDate: e.eventDate, startTime: e.startTime, endTime: e.endTime,
        venue: e.venue, city: e.city, state: e.state, ...seedCoords(e.city, e.state, "coords" in e ? e.coords : undefined), format: e.format, level: e.level, categories: e.categories,
        cap: e.cap, waves: e.waves, registrationType: "startline", feeStructure: "athlete",
        coverImageUrl: "coverImageUrl" in e && e.coverImageUrl
          ? e.coverImageUrl
          : DISCIPLINE_COVERS[e.discipline] ?? null },
    });
  }

  console.log(`  Events: ${4 + seedEvents.length} (including 1 pending, 1 draft, 1 rejected, 6 past Apex events)`);

  // ── Reviews ──────────────────────────────────────────────────────────

  await prisma.review.upsert({
    where:  { id: "seed-review-001" },
    update: {},
    create: {
      id: "seed-review-001",
      organiserId: org.id,
      eventId: event1.id,
      eventTitle: event1.title,
      reviewerName: "Sarah K.",
      title: "Best competition I've done all year",
      body: "Incredibly well run from start to finish.",
      overallRating: 5, atmosphereRating: 5, organisationRating: 5, experienceRating: 5,
      isVerified: true,
    },
  });

  await prisma.review.upsert({
    where:  { id: "seed-review-002" },
    update: {},
    create: {
      id: "seed-review-002",
      organiserId: org.id,
      eventId: event1.id,
      eventTitle: event1.title,
      reviewerName: "Tom R.",
      title: "Great event, minor timing hiccups",
      body: "Really enjoyed the event overall.",
      overallRating: 4, atmosphereRating: 5, organisationRating: 4, experienceRating: 4,
      isVerified: true,
    },
  });

  const extraReviews = [
    { id: "seed-review-003", reviewerName: "Mia Fontaine",   title: "Brilliant event, will be back", body: "Third year and this was the best one yet.", overallRating: 5, atmosphereRating: 5, organisationRating: 5, experienceRating: 5, event: event1 },
    { id: "seed-review-004", reviewerName: "Jack Donovan",   title: "Great comp, tough workouts", body: "Workouts were brutal but fair.", overallRating: 4, atmosphereRating: 5, organisationRating: 4, experienceRating: 4, event: event1 },
    { id: "seed-review-005", reviewerName: "Emma Whitfield", title: "Great organiser", body: "Consistently excellent events.", overallRating: 5, atmosphereRating: 5, organisationRating: 5, experienceRating: 5, event: null },
    { id: "seed-review-006", reviewerName: "Liam O'Connor",  title: "Hybrid Hustle keeps getting better", body: "The trail section through the Dandenongs was epic.", overallRating: 5, atmosphereRating: 5, organisationRating: 4, experienceRating: 5, event: event2 },
    { id: "seed-review-007", reviewerName: "Chloe Bennett",  title: "Challenging but rewarding", body: "Great community vibe.", overallRating: 4, atmosphereRating: 5, organisationRating: 3, experienceRating: 4, event: event2 },
  ];

  for (const r of extraReviews) {
    await prisma.review.upsert({
      where:  { id: r.id },
      update: {},
      create: {
        id: r.id,
        organiserId: org.id,
        ...(r.event ? { eventId: r.event.id, eventTitle: r.event.title } : {}),
        reviewerName: r.reviewerName,
        title: r.title, body: r.body,
        overallRating: r.overallRating,
        atmosphereRating: r.atmosphereRating,
        organisationRating: r.organisationRating,
        experienceRating: r.experienceRating,
        isVerified: true,
      },
    });
  }
  console.log(`  Reviews: ${2 + extraReviews.length}`);

  // A couple of reviews for the coastal organiser so its rating populates.
  if (coastalOrg) {
    const coastalEvent = await prisma.event.findUnique({ where: { id: "seed-event-017" }, select: { id: true, title: true } });
    const coastalReviews = [
      { id: "seed-review-008", reviewerName: "Sophie Nguyen", title: "Flawless ocean event", body: "Smooth transition zones and great beachside atmosphere.", overallRating: 5, atmosphereRating: 5, organisationRating: 5, experienceRating: 5, event: coastalEvent },
      { id: "seed-review-009", reviewerName: "Marcus Reid", title: "Well organised tri", body: "Course marshalling was top notch all morning.", overallRating: 4, atmosphereRating: 4, organisationRating: 5, experienceRating: 4, event: coastalEvent },
    ];
    for (const r of coastalReviews) {
      await prisma.review.upsert({
        where:  { id: r.id },
        update: {},
        create: {
          id: r.id,
          organiserId: coastalOrg.id,
          ...(r.event ? { eventId: r.event.id, eventTitle: r.event.title } : {}),
          reviewerName: r.reviewerName,
          title: r.title, body: r.body,
          overallRating: r.overallRating,
          atmosphereRating: r.atmosphereRating,
          organisationRating: r.organisationRating,
          experienceRating: r.experienceRating,
          isVerified: true,
        },
      });
    }
  }

  // ── Registrations ────────────────────────────────────────────────────

  const athleteNames = [
    "Alex Turner", "Bree Collins", "Cameron Nguyen", "Dana Wilson",
    "Eli Patel", "Fatima Hassan", "George Kim", "Hannah Jones",
    "Ivy Martin", "Jack Thompson", "Kara Adams", "Leo Robinson",
  ];

  const waveOptions = [
    { label: "Early Bird", price: 95 },
    { label: "General",    price: 115 },
    { label: "Late Entry", price: 135 },
  ];

  let regCount = 0;
  for (let i = 0; i < athleteNames.length; i++) {
    const name = athleteNames[i];
    const wave = waveOptions[i % waveOptions.length];
    const amountCents = wave.price * 100;
    const email = name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com";
    // Demo pace/age/gender data so organisers can try sorting athletes into waves.
    const estimatedFinishMinutes = 32 + i * 6; // 32, 38, 44 … a clean spread
    const gender = ["Male", "Female", "Non-binary"][i % 3];
    const dateOfBirth = `${1980 + ((i * 3) % 30)}-06-15`;
    // Start wave banded by finish time (matches the seeded startWaves conditions).
    const startWaveLabel =
      estimatedFinishMinutes <= 50 ? "Wave A" : estimatedFinishMinutes <= 75 ? "Wave B" : "Wave C";

    await prisma.registration.upsert({
      where:  { id: `seed-reg-${String(i + 1).padStart(3, "0")}` },
      update: { bibNumber: String(i + 1), estimatedFinishMinutes, gender, dateOfBirth, startWaveLabel, startWaveId: startWaveIdByLabel[startWaveLabel] },
      create: {
        id: `seed-reg-${String(i + 1).padStart(3, "0")}`,
        eventId: event1.id,
        organiserId: org.id,
        athleteName: name,
        athleteEmail: email,
        waveLabel: wave.label,
        startWaveLabel,
        startWaveId: startWaveIdByLabel[startWaveLabel],
        bibNumber: String(i + 1),
        gender,
        dateOfBirth,
        estimatedFinishMinutes,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure: "athlete",
        status: "CONFIRMED",
      },
    });
    regCount++;
  }

  const extraRegs = [
    { name: "Nina Vasquez", email: "nina@example.com", wave: "Early Bird", price: 95, status: "CANCELLED" as const },
    { name: "Dylan Cross", email: "dylan@example.com", wave: "General", price: 115, status: "REFUNDED" as const },
    { name: "Priya Nair", email: "priya@example.com", wave: "General", price: 115, status: "REFUND_REQUESTED" as const },
    { name: "Aisha Kazemi", email: "aisha@example.com", wave: "Late Entry", price: 135, status: "CONFIRMED" as const },
    { name: "Oscar De Luca", email: "oscar@example.com", wave: "Early Bird", price: 95, status: "CONFIRMED" as const },
  ];

  for (let i = 0; i < extraRegs.length; i++) {
    const r = extraRegs[i];
    const amountCents = r.price * 100;
    await prisma.registration.create({
      data: {
        eventId: event1.id,
        organiserId: org.id,
        athleteName: r.name,
        athleteEmail: r.email,
        waveLabel: r.wave,
        amountCents,
        platformFeeCents: platformFeeCents(amountCents),
        feeStructure: "athlete",
        status: r.status,
        stripePaymentIntentId: `pi_extra_${i}`,
      },
    });
    regCount++;
  }
  console.log(`  Registrations: ${regCount}`);

  // ── Seeded-user race history ────────────────────────────────────────────
  // jade.nguyen@startline.test gets a spread of completed events (different
  // disciplines + states) so the profile KStats and timeline have data.
  // marcus.stirling@startline.test gets a couple so an admin account has history too.
  const userSeedId = userBySub[subsByEmail["jade.nguyen@startline.test"] ?? ""];
  const adminSeedId = userBySub[subsByEmail["marcus.stirling@startline.test"] ?? ""];
  const organiserSeedId = userBySub[subsByEmail["sarah.mitchell@startline.test"] ?? ""];

  const historyRegs: {
    id: string;
    userId: string | undefined;
    eventId: string;
    finishTime?: string | null;
    result?: string | null;
  }[] = [
    { id: "seed-history-user-001", userId: userSeedId, eventId: "seed-event-040", result: "12th", finishTime: "02:14:37" },
    { id: "seed-history-user-002", userId: userSeedId, eventId: "seed-event-042", result: "8th",  finishTime: "01:47:22" },
    { id: "seed-history-user-003", userId: userSeedId, eventId: "seed-event-044", result: "1st",  finishTime: "00:42:10" },
    { id: "seed-history-user-004", userId: userSeedId, eventId: "seed-event-022", result: "24th", finishTime: null },
    { id: "seed-history-user-005", userId: userSeedId, eventId: "seed-event-006", result: "157th", finishTime: "04:28:51" },
    { id: "seed-history-user-006", userId: userSeedId, eventId: "seed-event-024", result: "19th", finishTime: null },
    { id: "seed-history-admin-001", userId: adminSeedId, eventId: "seed-event-041", result: "3rd", finishTime: "01:23:40" },
    { id: "seed-history-admin-002", userId: adminSeedId, eventId: "seed-event-043", result: "DNF", finishTime: null },
    { id: "seed-history-organiser-001", userId: organiserSeedId, eventId: "seed-event-040", result: "5th", finishTime: "02:01:12" },
    { id: "seed-history-organiser-002", userId: organiserSeedId, eventId: "seed-event-044", result: "2nd", finishTime: "00:39:58" },
    // Upcoming and unraced, so the athlete-side refund-request flow has something
    // it is actually allowed to act on (past events can no longer be refunded).
    { id: "seed-history-organiser-003", userId: organiserSeedId, eventId: "seed-event-005", result: null, finishTime: null },
  ];

  let historyCount = 0;
  for (const h of historyRegs) {
    if (!h.userId) continue;
    const owner = (await prisma.event.findUnique({ where: { id: h.eventId }, select: { organiserId: true } }))?.organiserId;
    if (!owner) continue;
    await prisma.registration.upsert({
      where: { id: h.id },
      update: {},
      create: {
        id: h.id,
        userId: h.userId,
        eventId: h.eventId,
        organiserId: owner,
        athleteName: "Seed Athlete",
        athleteEmail: h.userId === userSeedId
          ? "jade.nguyen@startline.test"
          : h.userId === adminSeedId
            ? "marcus.stirling@startline.test"
            : "sarah.mitchell@startline.test",
        waveLabel: "General",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: "athlete",
        status: "CONFIRMED",
        finishTime: h.finishTime ?? null,
        result: h.result ?? null,
        // New-style result fields (race management / public profile table)
        resultTime: h.finishTime ?? null,
        resultPlacement: h.result ?? null,
        resultDistance: "5K",
      },
    });
    historyCount++;
  }
  if (historyCount > 0) console.log(`  Seeded-user race history: ${historyCount}`);

  // ── Athlete race history (new regular users) ─────────────────────────────
  // Give the extra athletes a couple of completed races each so their
  // profile KStats / timeline aren't empty.
  const athleteHistory: { email: string; eventId: string; result: string; finishTime: string | null }[] = [
    { email: "harper.jones@startline.test",  eventId: "seed-event-005", result: "43rd",  finishTime: "00:48:22" },
    { email: "harper.jones@startline.test",  eventId: "seed-event-010", result: "DNF",   finishTime: null },
    { email: "mateo.silva@startline.test",   eventId: "seed-event-014", result: "27th",  finishTime: "00:51:09" },
    { email: "mateo.silva@startline.test",   eventId: "seed-event-017", result: "DNF",   finishTime: null },
    { email: "aria.kapoor@startline.test",   eventId: "seed-event-006", result: "88th",  finishTime: "04:01:44" },
    { email: "aria.kapoor@startline.test",   eventId: "seed-event-022", result: "12th",  finishTime: null },
    { email: "oscar.ngata@startline.test",   eventId: "seed-event-015", result: "5th",  finishTime: "06:12:03" },
    { email: "oscar.ngata@startline.test",   eventId: "seed-event-044", result: "9th",  finishTime: "00:44:30" },
    { email: "sophie.moreau@startline.test", eventId: "seed-event-008", result: "31st",  finishTime: "03:52:18" },
    { email: "lucas.tan@startline.test",     eventId: "seed-event-026", result: "DNF",   finishTime: null },
    { email: "lucas.tan@startline.test",     eventId: "seed-event-017", result: "66th",  finishTime: "02:41:55" },
  ];
  let athleteHistoryCount = 0;
  for (let i = 0; i < athleteHistory.length; i++) {
    const ah = athleteHistory[i];
    const athleteUserId = userBySub[subsByEmail[ah.email]];
    if (!athleteUserId) continue;
    const owner = (await prisma.event.findUnique({ where: { id: ah.eventId }, select: { organiserId: true } }))?.organiserId;
    if (!owner) continue;
    await prisma.registration.upsert({
      where: { id: `seed-athlete-history-${i}` },
      update: {},
      create: {
        id: `seed-athlete-history-${i}`,
        userId: athleteUserId,
        eventId: ah.eventId,
        organiserId: owner,
        athleteName: ah.email.split("@")[0],
        athleteEmail: ah.email,
        waveLabel: "General",
        amountCents: 0,
        platformFeeCents: 0,
        feeStructure: "athlete",
        status: "CONFIRMED",
        finishTime: ah.finishTime ?? null,
        result: ah.result ?? null,
      },
    });
    athleteHistoryCount++;
  }
  if (athleteHistoryCount > 0) console.log(`  Athlete race history: ${athleteHistoryCount}`);

  // ── Organiser follows ────────────────────────────────────────────────
  // user@ and admin@ follow Apex. organiser@ (the E2E bypass user) owns
  // Apex so cannot follow it — it follows Coastal instead, which gives the
  // /activity "Following" tab a row for that account.
  const followerUserIds = [
    userBySub[subsByEmail["jade.nguyen@startline.test"] ?? ""],
    userBySub[subsByEmail["marcus.stirling@startline.test"] ?? ""],
    // New athletes + co-managers follow Apex too
    ...["harper.jones", "mateo.silva", "aria.kapoor", "oscar.ngata", "jack.obrien", "priya.sharma"]
      .map((u) => userBySub[subsByEmail[`${u}@startline.test`] ?? ""]),
  ].filter(Boolean) as string[];

  let followCount = 0;
  for (const userId of followerUserIds) {
    await prisma.organiserFollow.upsert({
      where: {
        userId_organiserId: { userId, organiserId: org.id },
      },
      update: {},
      create: { userId, organiserId: org.id },
    });
    followCount++;
  }

  const organiserUserFollowId = userBySub[subsByEmail["sarah.mitchell@startline.test"] ?? ""];
  if (organiserUserFollowId && coastalOrg) {
    await prisma.organiserFollow.upsert({
      where: {
        userId_organiserId: { userId: organiserUserFollowId, organiserId: coastalOrg.id },
      },
      update: {},
      create: { userId: organiserUserFollowId, organiserId: coastalOrg.id },
    });
    followCount++;
  }
  console.log(`  Organiser follows: ${followCount}`);

  // ── Saved events ───────────────────────────────────────────────────────
  if (userSeedId) {
    const savedEventIds = [
      "seed-event-001", // The Apex Throwdown 2026
      "seed-event-005", // Sydney Harbour 10K
      "seed-event-017", // Noosa Triathlon 2026
    ];
    let savedCount = 0;
    for (const eventId of savedEventIds) {
      await prisma.savedEvent.upsert({
        where: { userId_eventId: { userId: userSeedId, eventId } },
        update: {},
        create: { userId: userSeedId, eventId },
      });
      savedCount++;
    }
    console.log(`  Saved events: ${savedCount}`);
  }

  // ── Athlete race results (user@startline.test public profile demo) ──
  const athleteUserSub = subsByEmail["user@startline.test"];
  const athleteUserId = athleteUserSub ? userBySub[athleteUserSub] : null;
  if (athleteUserId) {
    const athleteResults = [
      { id: "seed-reg-athlete-001", eventId: event1.id,       wave: "Late Entry", price: 135, distance: "Full Division", time: "1:08:22", placement: "12th / 340", pb: true,  top: true,  bib: "101" },
      { id: "seed-reg-athlete-002", eventId: "seed-event-005", wave: "General",   price: 55,  distance: "10km",          time: "41:05",   placement: "8th / 512",  pb: true,  top: true,  bib: "88" },
      { id: "seed-reg-athlete-003", eventId: "seed-event-014", wave: "1.2K",      price: 35,  distance: "2.5km",         time: "38:47",   placement: "45th / 310", pb: false, top: false, bib: "210" },
    ];
    for (const r of athleteResults) {
      const amountCents = r.price * 100;
      await prisma.registration.upsert({
        where: { id: r.id },
        update: {
          resultDistance: r.distance,
          resultTime: r.time,
          resultPlacement: r.placement,
          isPersonalBest: r.pb,
          isTopResult: r.top,
          bibNumber: r.bib,
          userId: athleteUserId,
          finishTime: r.time,
          result: r.placement,
        },
        create: {
          id: r.id,
          eventId: r.eventId,
          organiserId: org.id,
          userId: athleteUserId,
          athleteName: "Test User",
          athleteEmail: "user@startline.test",
          waveLabel: r.wave,
          bibNumber: r.bib,
          amountCents,
          platformFeeCents: platformFeeCents(amountCents),
          feeStructure: "athlete",
          status: "CONFIRMED",
          resultDistance: r.distance,
          resultTime: r.time,
          resultPlacement: r.placement,
          isPersonalBest: r.pb,
          isTopResult: r.top,
          finishTime: r.time,
          result: r.placement,
        },
      });
    }
    console.log(`  Athlete race results (demo): ${athleteResults.length}`);
  }

  // ── Notifications ────────────────────────────────────────────────────

  const notifications = [
    { type: "EVENT_APPROVED" as const, title: "Event approved", body: `"${event1.title}" is live on Startline.`, eventId: event1.id, read: true },
    { type: "EVENT_REJECTED" as const, title: "Event rejected", body: `"${event4.title}" was rejected.`, eventId: event4.id, read: true },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[0]} registered.`, eventId: event1.id, read: false },
    { type: "NEW_REGISTRATION" as const, title: "New registration", body: `${athleteNames[1]} registered.`, eventId: event1.id, read: false },
  ];

  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    await prisma.notification.create({
      data: {
        organiserId: org.id,
        type: n.type, title: n.title, body: n.body,
        eventId: n.eventId,
        read: n.read,
        createdAt: new Date(Date.now() - (notifications.length - i) * 3600000),
      },
    });
  }
  console.log(`  Notifications: ${notifications.length}`);

  // ── Announcements ────────────────────────────────────────────────────

  const announcements = [
    { eventId: event1.id, title: "Workout 1 released!", body: "Check your athlete portal for details." },
    { eventId: event1.id, title: "Vendor expo lineup confirmed", body: "Primal Supplements, FITAID Australia, and WIT Fitness will be there." },
    { eventId: event1.id, title: "Heat assignments posted", body: "Log in to see your start times." },
    { eventId: event2.id, title: "Athlete guide available", body: "Download from the event page." },
    { eventId: event2.id, title: "Gear checklist", body: "You'll need trail shoes and a hydration vest." },
  ];

  for (let i = 0; i < announcements.length; i++) {
    const a = announcements[i];
    await prisma.announcement.create({
      data: {
        eventId: a.eventId,
        organiserId: org.id,
        title: a.title,
        body: a.body,
        createdAt: new Date(Date.now() - (announcements.length - i) * 86400000),
      },
    });
  }
  console.log(`  Announcements: ${announcements.length}`);

  // ── Waitlist ─────────────────────────────────────────────────────────

  const waitlistEmails = [
    "alex.turner@example.com", "bree.collins@example.com", "cameron.nguyen@example.com",
    "dana.wilson@example.com", "fatima.hassan@example.com", "george.kim@example.com",
  ];

  for (const email of waitlistEmails) {
    await prisma.waitlistSubscriber.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }
  console.log(`  Waitlist subscribers: ${waitlistEmails.length}`);

  // ── Admin Audit Log ────────────────────────────────────────────────────

  const adminId = adminRecords[0].id;
  const auditEntries = [
    { action: "VERIFY_ORGANISER",  targetType: "organiser", targetId: org.id, meta: { orgName: org.orgName } },
    { action: "APPROVE_EVENT",     targetType: "event",     targetId: event1.id, meta: { eventTitle: event1.title } },
    { action: "APPROVE_EVENT",     targetType: "event",     targetId: "seed-event-005", meta: { eventTitle: "Sydney Harbour 10K" }, createdAt: new Date("2026-07-01T10:00:00Z") },
    { action: "REJECT_EVENT",      targetType: "event",     targetId: event4.id, meta: { eventTitle: event4.title, reason: event4.rejectionReason } },
    { action: "APPROVE_EVENT",     targetType: "event",     targetId: "seed-event-006", meta: { eventTitle: "Gold Coast Marathon Weekend" }, createdAt: new Date("2026-07-15T14:30:00Z") },
    { action: "HIDE_REVIEW",       targetType: "review",    targetId: "seed-review-001", meta: { reviewerName: "Sarah K." } },
    { action: "SHOW_REVIEW",       targetType: "review",    targetId: "seed-review-001", meta: { reviewerName: "Sarah K." } },
  ];

  for (const entry of auditEntries) {
    await prisma.adminAuditLog.create({
      data: { adminId, action: entry.action, targetType: entry.targetType, targetId: entry.targetId, meta: entry.meta, createdAt: entry.createdAt } as any,
    });
  }
  console.log(`  Admin audit log entries: ${auditEntries.length}`);

  console.log("\n✅ Database seeding complete!");
  console.log(`   Password for all users: ${PASSWORD}`);
  console.log("   Users: marcus.stirling@startline.test, sarah.mitchell@startline.test, jade.nguyen@startline.test");
}

main()
  .catch(e => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
