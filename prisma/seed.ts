// Sample partners from the prototype, for local development only.
// Run with `npm run db:seed`. Safe to re-run: it replaces the sample rows.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PartnerType, type WorkLocation } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Leeds city centre; samples are spread around it.
const BASE = { lat: 53.7997, lng: -1.5492 };

type Sample = {
  name: string;
  type: PartnerType;
  rate: number;
  rating: number;
  jobs: number;
  north: number;
  east: number;
  work?: WorkLocation;
  address?: string;
  motFee?: number;
  bays?: number;
  motBays?: number;
};

const SAMPLES: Sample[] = [
  { name: "Dan K.", type: "MOBILE_MECHANIC", rate: 4200, rating: 4.9, jobs: 312, north: 0.01, east: 0.02 },
  { name: "Priya S.", type: "MOBILE_MECHANIC", rate: 4800, rating: 5.0, jobs: 188, north: -0.02, east: 0.01 },
  { name: "Marcus T.", type: "MOBILE_MECHANIC", rate: 3800, rating: 4.7, jobs: 96, north: 0.03, east: -0.03 },
  { name: "Hannah B.", type: "MOBILE_MECHANIC", rate: 5500, rating: 4.9, jobs: 240, north: -0.01, east: -0.02 },
  { name: "Volt Auto Electrics", type: "AUTO_ELECTRICIAN", rate: 5200, rating: 4.9, jobs: 150, north: 0.02, east: 0.0, work: "MOBILE" },
  { name: "Kirkstall Road Garage", type: "AUTO_ELECTRICIAN", rate: 5800, rating: 4.8, jobs: 410, north: 0.0, east: -0.04, work: "WORKSHOP", address: "Kirkstall Road" },
  { name: "Spark Mobile Auto Electrical", type: "AUTO_ELECTRICIAN", rate: 4800, rating: 4.7, jobs: 72, north: -0.03, east: 0.03, work: "MOBILE" },
  { name: "Northside MOT Centre", type: "GARAGE", rate: 5200, rating: 4.8, jobs: 520, north: 0.011, east: 0.003, work: "WORKSHOP", address: "Unit 4, Mill Lane", motFee: 5485, bays: 4, motBays: 2 },
  { name: "Park Road Garage", type: "GARAGE", rate: 6000, rating: 4.7, jobs: 330, north: -0.02, east: 0.012, work: "WORKSHOP", address: "12 Park Road", motFee: 4999, bays: 3, motBays: 1 },
  { name: "Albion Motors", type: "GARAGE", rate: 6800, rating: 4.9, jobs: 610, north: 0.03, east: -0.03, work: "WORKSHOP", address: "Albion Industrial Estate", motFee: 5485, bays: 6, motBays: 2 },
  { name: "Greenway Auto Centre", type: "GARAGE", rate: 4800, rating: 4.6, jobs: 205, north: -0.05, east: -0.04, work: "WORKSHOP", address: "88 Greenway", motFee: 4499, bays: 2, motBays: 1 },
  { name: "Hilltop Tyres and MOT", type: "GARAGE", rate: 5800, rating: 4.8, jobs: 280, north: 0.08, east: 0.05, work: "WORKSHOP", address: "Hilltop Business Park", motFee: 5485, bays: 5, motBays: 1 },
];

async function main() {
  await db.user.deleteMany({ where: { email: { endsWith: "@sample.motoringcentral.test" } } });

  for (const s of SAMPLES) {
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
    await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name: s.name,
        email: `${slug}@sample.motoringcentral.test`,
        role: "PARTNER",
        partner: {
          create: {
            type: s.type,
            status: "APPROVED",
            businessName: s.name,
            addressLine1: s.address,
            town: "Leeds",
            postcode: "LS1 1AA",
            workLocation: s.work ?? "MOBILE",
            travelRadiusMiles: s.work === "WORKSHOP" ? null : 15,
            labourRatePence: s.rate,
            ratingAvg: s.rating,
            jobsCompleted: s.jobs,
            latitude: BASE.lat + s.north,
            longitude: BASE.lng + s.east,
            workshopBays: s.bays,
            isMotStation: s.motFee != null,
            motBays: s.motBays,
            motFeePence: s.motFee,
            approvedAt: new Date(),
          },
        },
      },
    });
  }
  console.log(`Seeded ${SAMPLES.length} sample partners.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
