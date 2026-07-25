import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  AdminSetUserMFAPreferenceCommand,
  ListUsersInGroupCommand,
  UsernameExistsException,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

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
  { email: "admin@startline.test",     isAdmin: true,  displayName: "Admin User" },
  { email: "organiser@startline.test",  isAdmin: false, displayName: "Test Organiser" },
  { email: "user@startline.test",   isAdmin: false, displayName: "Test User" },
];

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
      await cognito.send(new AdminSetUserMFAPreferenceCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
      }));
    }
  }
  console.log(`  Cognito: ${created} created, ${SEED_USERS.length - created} already existed`);
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

  if (!userPoolId) {
    console.warn("  NEXT_PUBLIC_COGNITO_USER_POOL_ID not set — skipping Cognito seeding");
  } else {
    try {
      await ensureCognitoUsers();
    } catch (e) {
      console.warn("  Cognito seeding skipped — insufficient permissions or pool unavailable:", (e as Error).message?.split("\n")[0]);
    }
  }

  let subsByEmail: Record<string, string> = {};
  let adminSubs: string[] = [];
  if (userPoolId) {
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
    subsByEmail = {
      "admin@startline.test":     "dev-bypass-admin",
      "organiser@startline.test": "dev-bypass-organiser",
      "user@startline.test":      "dev-bypass-user",
    };
    adminSubs = ["dev-bypass-admin"];
  }
  console.log(`  Cognito users found: ${Object.keys(subsByEmail).length}`);

  await prisma.adminAuditLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.review.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.event.deleteMany();
  await prisma.admin.deleteMany();
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
      update: {},
      create: {
        cognitoSub: sub,
        email: user.email,
        name: user.displayName,
        username: user.email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
        ...(user.isAdmin ? { mfaEnabled: true } : {}),
      },
    });
    userBySub[sub] = record.id;
  }
  console.log(`  Users: ${SEED_USERS.length}`);

  // ── Organiser ────────────────────────────────────────────────────────
  const orgSub = subsByEmail["organiser@startline.test"];
  let orgRecord: { id: string; email: string; orgName: string | null; instagram: string | null; facebook: string | null } | null = null;

  if (orgSub) {
    const userId = userBySub[orgSub];
    if (userId) {
      orgRecord = await prisma.organiser.create({
        data: {
          userId,
          email: "organiser@startline.test",
          verified: true,
          status: "APPROVED",
          orgName: "Apex Endurance Events",
          contactName: "Test Organiser",
          contactEmail: "organiser@startline.test",
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
    city: "Melbourne", state: "vic", format: "both", level: "high",
    categories: ["Individual Scaled", "Individual RX", "Individual Elite", "Team of 2"],
    cap: 320, minAge: 16,
    waves: [
      { label: "Early Bird", price: "95",  closes: "2026-05-01", startTime: "",      qty: 80  },
      { label: "General",    price: "115", closes: "2026-07-15", startTime: "",      qty: 150 },
      { label: "Late Entry", price: "135", closes: "2026-08-07", startTime: "09:00", qty: 90  },
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

  const event2 = await prisma.event.upsert({
    where: { id: "seed-event-002" }, update: {},
    create: {
      id: "seed-event-002", organiserId: org.id, status: "PENDING", photos: [],
      title: "Hybrid Hustle Series — Round 3", discipline: "hybrid",
      tagline: "Run. Lift. Repeat.",
      description: "Trail running, loaded carries, obstacle crawls, and a surprise finale.",
      eventDate: "2026-09-06", startTime: "08:00", endTime: "14:00",
      venue: "Kokoda Track Memorial Walkway", city: "Scoresby", state: "vic",
      format: "individual", level: "open", categories: ["Open Male", "Open Female", "Masters 40+"],
      cap: 150, minAge: 16, waves: [{ label: "General Entry", date: "2026-07-01", price: "75", qty: 150 }],
      inclusions: "Race entry, finisher medal, recovery snack bag", refundPolicy: "Flexible",
      registrationType: "startline", feeStructure: "athlete",
      coverImageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80",
    },
  });

  const event3 = await prisma.event.upsert({
    where: { id: "seed-event-003" }, update: {},
    create: {
      id: "seed-event-003", organiserId: org.id, status: "DRAFT", photos: [],
      title: "Team Throwdown Summer Series", discipline: "functional_fitness",
      tagline: "", description: "Draft — details TBC",
      eventDate: "2026-12-05", startTime: "09:00", endTime: "15:00",
      venue: "TBC", city: "Sydney", state: "nsw", format: "team", level: "open",
      categories: [], waves: [], registrationType: "startline", feeStructure: "athlete",
    },
  });

  const event4 = await prisma.event.upsert({
    where: { id: "seed-event-004" }, update: {},
    create: {
      id: "seed-event-004", organiserId: org.id, status: "REJECTED", photos: [],
      title: "Autumn Run Festival", discipline: "running",
      tagline: "5K, 10K through the Yarra Valley",
      description: "A scenic trail run through the Yarra Valley vineyards.",
      eventDate: "2026-04-11", startTime: "07:30", endTime: "13:00",
      venue: "Yering Station", city: "Yering", state: "vic",
      format: "individual", level: "open", categories: ["5K", "10K", "Half Marathon"],
      cap: 500, waves: [{ label: "5K Entry", price: "45" }, { label: "10K Entry", price: "55" }, { label: "Half Marathon", price: "75" }],
      registrationType: "startline", feeStructure: "athlete", refundPolicy: "Firm",
      rejectionReason: "Event date has already passed.", reviewedAt: new Date("2026-04-01T09:00:00Z"),
    },
  });

  const seedEvents = [
    { id: "seed-event-005", status: "APPROVED" as const, title: "Sydney Harbour 10K",         discipline: "running",   eventDate: "2026-09-20", startTime: "07:00", endTime: "10:00", venue: "Mrs Macquaries Chair",           city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["5K", "10K"],              cap: 2000, waves: [{ label: "General", price: "55" }], tagline: "Run past the Opera House", description: "A scenic 10K through Sydney's foreshore parks and past iconic landmarks." },
    { id: "seed-event-006", status: "APPROVED" as const, title: "Gold Coast Marathon Weekend", discipline: "running",   eventDate: "2026-07-05", startTime: "06:00", endTime: "14:00", venue: "Gold Coast Highway",             city: "Gold Coast", state: "qld", format: "individual", level: "open",  categories: ["Marathon", "Half Marathon", "10K", "5K"], cap: 5000, waves: [{ label: "Marathon Entry", price: "120" }, { label: "Half Marathon", price: "85" }, { label: "10K Entry", price: "50" }], tagline: "Flat, fast, coastal", description: "Australia's premier marathon along the Gold Coast beachfront." },
    { id: "seed-event-007", status: "APPROVED" as const, title: "Uluru Sunset Run",            discipline: "running",   eventDate: "2026-10-12", startTime: "16:00", endTime: "19:00", venue: "Uluru-Kata Tjuta National Park",  city: "Uluru",   state: "nt",  format: "individual", level: "open",  categories: ["5K Fun Run", "10K Trail"], cap: 500, waves: [{ label: "General", price: "65" }], tagline: "Run at sunset", description: "A once-in-a-lifetime trail run around the base of Uluru at sunset." },
    { id: "seed-event-008", status: "APPROVED" as const, title: "Melbourne Marathon Festival",  discipline: "running",   eventDate: "2026-10-12", startTime: "07:00", endTime: "15:00", venue: "MCG",                             city: "Melbourne", state: "vic", format: "individual", level: "open",  categories: ["Marathon", "Half Marathon", "10K", "5K"], cap: 8000, waves: [{ label: "Marathon", price: "110" }, { label: "Half", price: "75" }], tagline: "Finish on the 'G", description: "Iconic marathon finishing inside the Melbourne Cricket Ground." },
    { id: "seed-event-009", status: "APPROVED" as const, title: "London Thames Riverside Run",  discipline: "running",   eventDate: "2026-11-02", startTime: "09:00", endTime: "12:00", venue: "Tower Bridge Start",              city: "London", state: "nsw", format: "individual", level: "open",  categories: ["10K", "Half Marathon"],   cap: 3000, waves: [{ label: "General", price: "45" }], tagline: "Run the Thames path", description: "A scenic run along the River Thames through central London." },
    { id: "seed-event-010", status: "APPROVED" as const, title: "Around the Bay 2026",          discipline: "cycling",   eventDate: "2026-10-11", startTime: "06:30", endTime: "15:00", venue: "Albert Park Circuit",             city: "Melbourne", state: "vic", format: "individual", level: "open",  categories: ["210K", "100K", "50K", "35K"], cap: 10000, waves: [{ label: "210K Entry", price: "110" }, { label: "100K Entry", price: "75" }], tagline: "Ride around Port Phillip Bay", description: "Australia's biggest bike ride." },
    { id: "seed-event-011", status: "APPROVED" as const, title: "Tour de Brisbane Gran Fondo",  discipline: "cycling",   eventDate: "2026-08-30", startTime: "06:00", endTime: "14:00", venue: "Brisbane City Hall",              city: "Brisbane", state: "qld", format: "individual", level: "open",  categories: ["160K Gran Fondo", "100K Medio", "50K Corto"], cap: 3000, waves: [{ label: "Gran Fondo", price: "95" }, { label: "Medio", price: "75" }], tagline: "Climb the Cootha", description: "Gran fondo through Brisbane's scenic hinterland." },
    { id: "seed-event-012", status: "APPROVED" as const, title: "Perth Twilight Criterium",    discipline: "cycling",   eventDate: "2026-12-12", startTime: "17:00", endTime: "21:00", venue: "Perth CBD Circuit",               city: "Perth",   state: "wa",  format: "individual", level: "open",  categories: ["Elite Men", "Elite Women", "B Grade", "C Grade"], cap: 200, waves: [{ label: "Elite Entry", price: "35" }, { label: "Grade Entry", price: "25" }], tagline: "Night racing in the city", description: "Fast twilight criterium racing through the streets of Perth CBD." },
    { id: "seed-event-013", status: "APPROVED" as const, title: "Seven Hills of Hobart Ride",  discipline: "cycling",   eventDate: "2026-11-22", startTime: "07:00", endTime: "13:00", venue: "Hobart Waterfront",               city: "Hobart", state: "tas", format: "individual", level: "open",  categories: ["Full Course", "Short Course"], cap: 500, waves: [{ label: "Full", price: "60" }], tagline: "Conquer the hills", description: "A challenging ride tackling Hobart's seven iconic hills." },
    { id: "seed-event-014", status: "APPROVED" as const, title: "Bondi to Bronte Ocean Swim",   discipline: "swimming",  eventDate: "2026-12-20", startTime: "08:00", endTime: "11:00", venue: "Bondi Beach",                    city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["2.4K Swim", "1.2K Swim", "600m"], cap: 1500, waves: [{ label: "2.4K", price: "45" }, { label: "1.2K", price: "35" }], tagline: "Swim the iconic coastline", description: "Australia's most famous ocean swim from Bondi to Bronte." },
    { id: "seed-event-015", status: "APPROVED" as const, title: "Rottnest Channel Swim",       discipline: "swimming",  eventDate: "2026-02-21", startTime: "05:45", endTime: "14:00", venue: "Cottesloe Beach to Rottnest",     city: "Perth",   state: "wa",  format: "both", level: "open",  categories: ["Solo", "Duo", "Team of 4"], cap: 2500, waves: [{ label: "Solo Entry", price: "180" }, { label: "Team Entry (per person)", price: "80" }], tagline: "Swim the channel to Rotto", description: "The legendary 19.7K open water swim to Rottnest Island." },
    { id: "seed-event-016", status: "APPROVED" as const, title: "Kiama Harbour Swim",           discipline: "swimming",  eventDate: "2026-11-15", startTime: "09:00", endTime: "11:00", venue: "Kiama Harbour",                  city: "Kiama",   state: "nsw", format: "individual", level: "open",  categories: ["1K", "2K", "400m Junior"], cap: 400, waves: [{ label: "1K", price: "30" }, { label: "2K", price: "40" }], tagline: "Swim in the blowhole region", description: "A protected harbour swim in the beautiful Kiama region." },
    { id: "seed-event-017", status: "APPROVED" as const, title: "Noosa Triathlon 2026",         discipline: "triathlon", eventDate: "2026-10-31", startTime: "06:00", endTime: "16:00", venue: "Noosa Main Beach",               city: "Noosa",   state: "qld", format: "individual", level: "open",  categories: ["Olympic", "Sprint", "Enticer"], cap: 8000, waves: [{ label: "Olympic", price: "180" }, { label: "Sprint", price: "120" }], tagline: "Race the original", description: "Australia's largest triathlon in the stunning Sunshine Coast setting." },
    { id: "seed-event-018", status: "APPROVED" as const, title: "Ironman Western Australia",    discipline: "triathlon", eventDate: "2026-12-06", startTime: "05:30", endTime: "23:59", venue: "Busselton Jetty",                city: "Busselton", state: "wa",  format: "individual", level: "open",  categories: ["Ironman", "70.3"], cap: 3000, waves: [{ label: "Full Ironman", price: "750" }, { label: "70.3", price: "350" }], tagline: "Swim under the jetty", description: "Full distance ironman starting at the iconic Busselton Jetty." },
    { id: "seed-event-019", status: "APPROVED" as const, title: "Sydney Triathlon Series R3",   discipline: "triathlon", eventDate: "2026-11-08", startTime: "06:30", endTime: "12:00", venue: "Sydney Olympic Park",             city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Olympic", "Sprint"], cap: 1500, waves: [{ label: "Olympic", price: "130" }, { label: "Sprint", price: "85" }], tagline: "Olympic course", description: "Triathlon racing on the Sydney 2000 Olympic course." },

    { id: "seed-event-022", status: "APPROVED" as const, title: "CrossFit Games Open 2026",     discipline: "crossfit",  eventDate: "2026-03-01", startTime: "08:00", endTime: "20:00", venue: "Allied HQ",                      city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Rx", "Scaled"], cap: 200, waves: [{ label: "Rx", price: "20" }], tagline: "Test your fitness", description: "The CrossFit Open at Allied HQ." },
    { id: "seed-event-023", status: "APPROVED" as const, title: "F45 Championship World Final",  discipline: "crossfit",  eventDate: "2026-11-14", startTime: "09:00", endTime: "18:00", venue: "Qudos Bank Arena",               city: "Sydney",   state: "nsw", format: "individual", level: "open",  categories: ["Men's Pro", "Women's Pro", "Team"], cap: 1000, waves: [{ label: "Pro Entry", price: "150" }, { label: "Team Entry", price: "300" }], tagline: "World finals in Sydney", description: "The F45 Championship World Finals at Qudos Bank Arena." },
    { id: "seed-event-024", status: "APPROVED" as const, title: "Torian Pro 2026",              discipline: "crossfit",  eventDate: "2026-05-30", startTime: "07:00", endTime: "17:00", venue: "Brisbane Convention Centre",      city: "Brisbane", state: "qld", format: "both", level: "open",  categories: ["Elite Men", "Elite Women", "Teams"], cap: 400, waves: [{ label: "Spectator Weekend", price: "95" }, { label: "Team Entry", price: "250" }], tagline: "Pacific's fittest", description: "One of the biggest CrossFit competitions in the Southern Hemisphere." },
    { id: "seed-event-025", status: "APPROVED" as const, title: "True Grit 10K OCR",            discipline: "hybrid",    eventDate: "2026-08-22", startTime: "07:00", endTime: "15:00", venue: "Laratinga Wetlands",              city: "Mount Barker", state: "sa",  format: "individual", level: "open",  categories: ["Elite", "Open", "Junior"], cap: 1500, waves: [{ label: "Elite", price: "85" }, { label: "Open", price: "65" }], tagline: "Mud. Sweat. Grit.", description: "South Australia's premier obstacle course race." },
    { id: "seed-event-026", status: "APPROVED" as const, title: "Spartan Trifecta Weekend",      discipline: "hybrid",    eventDate: "2026-11-28", startTime: "06:00", endTime: "17:00", venue: "Sunningdale Trails",              city: "Canberra", state: "act", format: "individual", level: "open",  categories: ["Sprint", "Super", "Beast", "Ultra"], cap: 3000, waves: [{ label: "Sprint", price: "110" }, { label: "Beast", price: "180" }, { label: "Trifecta Pass", price: "320" }], tagline: "Complete the trifecta", description: "A full Spartan weekend across the Canberra trails." },
    { id: "seed-event-027", status: "APPROVED" as const, title: "Tough Mudder Sydney",          discipline: "hybrid",    eventDate: "2026-07-18", startTime: "08:00", endTime: "16:00", venue: "Penrith Whitewater Stadium",      city: "Sydney",   state: "nsw", format: "both", level: "open",  categories: ["Classic", "Team"], cap: 4000, waves: [{ label: "Classic", price: "130" }, { label: "Team (4+)", price: "110" }], tagline: "Teamwork makes the dream work", description: "The iconic mud run with 25+ obstacles at Penrith Whitewater." },

    { id: "seed-event-032", status: "APPROVED" as const, title: "Chicago Marathon",              discipline: "running",   eventDate: "2026-10-11", startTime: "07:30", endTime: "14:00", venue: "Grant Park",                     city: "Chicago", state: "nsw", format: "individual", level: "open",  categories: ["Marathon"], cap: 45000, waves: [{ label: "General Entry", price: "220" }], tagline: "Run the Windy City", description: "One of the World Marathon Majors through the streets of Chicago." },
    { id: "seed-event-033", status: "APPROVED" as const, title: "Étape du Tour 2026",            discipline: "cycling",   eventDate: "2026-07-12", startTime: "06:00", endTime: "16:00", venue: "Bourg d'Oisans",                city: "Bourg d'Oisans", state: "nsw", format: "individual", level: "open",  categories: ["Full Stage"], cap: 15000, waves: [{ label: "Entry", price: "80" }], tagline: "Ride a Tour stage", description: "Ride the same stage as the pros on the Tour de France route." },
    { id: "seed-event-034", status: "APPROVED" as const, title: "NYC Triathlon",                discipline: "triathlon", eventDate: "2026-07-19", startTime: "06:00", endTime: "14:00", venue: "Hudson River",                   city: "New York", state: "nsw", format: "individual", level: "open",  categories: ["Olympic", "Sprint"], cap: 4000, waves: [{ label: "Olympic", price: "350" }, { label: "Sprint", price: "200" }], tagline: "Swim in the Hudson", description: "Triathlon through New York City — swim in the Hudson, bike through Manhattan." },
    { id: "seed-event-035", status: "APPROVED" as const, title: "London Marathon",               discipline: "running",   eventDate: "2026-04-26", startTime: "09:00", endTime: "16:00", venue: "Greenwich Park to The Mall",      city: "London", state: "nsw", format: "individual", level: "open",  categories: ["Marathon"], cap: 50000, waves: [{ label: "Championship Entry", price: "250" }], tagline: "Run past Big Ben", description: "The iconic London Marathon from Greenwich to The Mall." },

    // Apex Endurance — previous events (past dates for the organiser archive carousel)
    { id: "seed-event-040", status: "APPROVED" as const, title: "The Apex Throwdown 2025",       discipline: "crossfit",  eventDate: "2025-08-16", startTime: "07:30", endTime: "17:00", venue: "Melbourne Sports & Aquatic Centre", city: "Melbourne", state: "vic", format: "individual", level: "open", categories: ["Scaled", "RX", "Elite"], cap: 400, waves: [{ label: "Early Bird", price: "95" }, { label: "General", price: "115" }], tagline: "Where it all started", description: "The third edition of Victoria's premier functional fitness competition.", coverImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80" },
    { id: "seed-event-041", status: "APPROVED" as const, title: "Hybrid Hustle Series — Round 1", discipline: "hybrid",   eventDate: "2025-11-08", startTime: "08:00", endTime: "14:00", venue: "Kokoda Track Memorial Walkway", city: "Scoresby", state: "vic", format: "individual", level: "open", categories: ["Open Male", "Open Female"], cap: 150, waves: [{ label: "General Entry", price: "75" }], tagline: "Run. Lift. Repeat.", description: "Season opener for the Hybrid Hustle Series through the Dandenongs.", coverImageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80" },
    { id: "seed-event-042", status: "APPROVED" as const, title: "Hybrid Hustle Series — Round 2", discipline: "hybrid",   eventDate: "2026-02-14", startTime: "08:00", endTime: "14:00", venue: "You Yangs Regional Park", city: "Little River", state: "vic", format: "individual", level: "open", categories: ["Open Male", "Open Female", "Masters 40+"], cap: 180, waves: [{ label: "General Entry", price: "80" }], tagline: "Dust, hills, and loaded carries", description: "Round 2 pushed athletes through the You Yangs trails and granite climbs.", coverImageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80" },
    { id: "seed-event-043", status: "APPROVED" as const, title: "Apex Winter Classic",           discipline: "crossfit",  eventDate: "2026-06-07", startTime: "08:00", endTime: "16:00", venue: "CrossFit South Yarra", city: "Melbourne", state: "vic", format: "both", level: "open", categories: ["Individual", "Team of 2"], cap: 220, waves: [{ label: "Individual", price: "90" }, { label: "Team (per person)", price: "70" }], tagline: "Cold start. Hot finish.", description: "A one-day winter throwdown with three scored workouts and a packed spectator floor.", coverImageUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80" },
    { id: "seed-event-044", status: "APPROVED" as const, title: "Apex Bay Run",                 discipline: "running",   eventDate: "2026-03-22", startTime: "07:00", endTime: "11:00", venue: "Albert Park Lake", city: "Melbourne", state: "vic", format: "individual", level: "open", categories: ["5K", "10K", "Half Marathon"], cap: 1200, waves: [{ label: "5K", price: "35" }, { label: "10K", price: "45" }, { label: "Half", price: "65" }], tagline: "Flat and fast around the lake", description: "Apex's community run around Albert Park — perfect for PBs and first-timers.", coverImageUrl: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&q=80" },
    { id: "seed-event-045", status: "APPROVED" as const, title: "Apex Team Relay Challenge",    discipline: "hybrid",    eventDate: "2025-12-06", startTime: "09:00", endTime: "15:00", venue: "MSAC Outdoor Courts", city: "Melbourne", state: "vic", format: "team", level: "open", categories: ["Teams of 4"], cap: 80, waves: [{ label: "Team Entry", price: "280" }], tagline: "Four athletes. One finish line.", description: "A festive team relay mixing runs, carries, and partner workouts.", coverImageUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1200&q=80" },
  ];

  for (const e of seedEvents) {
    await prisma.event.upsert({
      where: { id: e.id }, update: {},
      create: { id: e.id, organiserId: org.id, status: e.status, title: e.title, discipline: e.discipline, photos: [],
        tagline: e.tagline, description: e.description, eventDate: e.eventDate, startTime: e.startTime, endTime: e.endTime,
        venue: e.venue, city: e.city, state: e.state, format: e.format, level: e.level, categories: e.categories,
        cap: e.cap, waves: e.waves, registrationType: "startline", feeStructure: "athlete",
        ...("coverImageUrl" in e && e.coverImageUrl ? { coverImageUrl: e.coverImageUrl } : {}) },
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

    await prisma.registration.upsert({
      where:  { id: `seed-reg-${String(i + 1).padStart(3, "0")}` },
      update: {},
      create: {
        id: `seed-reg-${String(i + 1).padStart(3, "0")}`,
        eventId: event1.id,
        organiserId: org.id,
        athleteName: name,
        athleteEmail: email,
        waveLabel: wave.label,
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

  // ── Organiser follows ────────────────────────────────────────────────
  const followerUserIds = [
    userBySub[subsByEmail["user@startline.test"] ?? ""],
    userBySub[subsByEmail["admin@startline.test"] ?? ""],
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
  console.log(`  Organiser follows: ${followCount}`);

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
  console.log("   Users: admin@startline.test, organiser@startline.test, user@startline.test");
}

main()
  .catch(e => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
