// Sample partners from the prototype, for local development only.
// Run with `npm run db:seed`. Safe to re-run: it replaces the sample rows.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PartnerType, type Prisma, type WorkLocation } from "../src/generated/prisma/client";

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
  extra?: Partial<Prisma.PartnerCreateWithoutUserInput>;
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
  { name: "Swift Recovery", type: "RECOVERY", rate: 0, rating: 4.8, jobs: 640, north: 0.02, east: 0.03, extra: { callOutPence: 6500, perMilePence: 240, travelRadiusMiles: 30 } },
  { name: "Highway Rescue 24h", type: "RECOVERY", rate: 0, rating: 4.7, jobs: 910, north: -0.04, east: 0.06, extra: { callOutPence: 7500, perMilePence: 220, travelRadiusMiles: 40 } },
  { name: "Metro Tow and Transport", type: "RECOVERY", rate: 0, rating: 4.6, jobs: 380, north: 0.05, east: -0.02, extra: { callOutPence: 6000, perMilePence: 310, travelRadiusMiles: 25 } },
  { name: "Beacon Vehicle Recovery", type: "RECOVERY", rate: 0, rating: 4.9, jobs: 220, north: -0.07, east: -0.05, extra: { callOutPence: 8500, perMilePence: 200, travelRadiusMiles: 50 } },
  { name: "ChargeUp Mobile", type: "MOBILE_EV_CHARGING", rate: 0, rating: 4.8, jobs: 140, north: 0.03, east: 0.01, extra: { callOutPence: 6000, perMileOutsidePence: 180, travelRadiusMiles: 15, equipment: "22kW AC van", connectors: ["Type 2"] } },
  { name: "Volt Rescue 24/7", type: "MOBILE_EV_CHARGING", rate: 0, rating: 4.9, jobs: 95, north: -0.05, east: 0.04, extra: { callOutPence: 7500, perMileOutsidePence: 150, travelRadiusMiles: 20, equipment: "DC rapid van", connectors: ["CCS", "CHAdeMO", "Type 2"] } },
  { name: "PlugIn Roadside", type: "MOBILE_EV_CHARGING", rate: 0, rating: 4.6, jobs: 60, north: 0.08, east: -0.06, extra: { callOutPence: 5500, perMileOutsidePence: 220, travelRadiusMiles: 10, equipment: "7kW AC van", connectors: ["Type 2"] } },
  { name: "Quick Roll Mobile", type: "TYRE_FITTER", rate: 0, rating: 4.8, jobs: 520, north: 0.01, east: -0.01, extra: { fitPerTyrePence: 1200, puncturePence: 3000, travelRadiusMiles: 20 } },
  { name: "Wheelwise Fitting", type: "TYRE_FITTER", rate: 0, rating: 4.7, jobs: 300, north: -0.03, east: 0.02, extra: { fitPerTyrePence: 1000, puncturePence: 2500, travelRadiusMiles: 15 } },
  { name: "Premier Tyre Van", type: "TYRE_FITTER", rate: 0, rating: 4.9, jobs: 410, north: 0.04, east: 0.04, extra: { fitPerTyrePence: 1600, puncturePence: 3500, travelRadiusMiles: 25 } },
  { name: "Shine On Mobile", type: "VALETER", rate: 0, rating: 4.8, jobs: 260, north: 0.02, east: -0.02, extra: { valetPricesPence: [7900, 9900, 12900, 14900], travelRadiusMiles: 15 } },
  { name: "Gleam Team", type: "VALETER", rate: 0, rating: 4.7, jobs: 180, north: -0.02, east: -0.03, extra: { valetPricesPence: [6900, 8900, 11500, 13500], travelRadiusMiles: 12 } },
  { name: "Premier Valets", type: "VALETER", rate: 0, rating: 4.9, jobs: 330, north: 0.03, east: 0.05, extra: { valetPricesPence: [9500, 11900, 14900, 17500], travelRadiusMiles: 20 } },
  { name: "Sparkle Valet Centre", type: "VALETER", rate: 0, rating: 4.8, jobs: 450, north: 0.008, east: 0.004, work: "WORKSHOP", address: "14 Wharf Street", extra: { valetPricesPence: [7500, 9500, 12500, 14500] } },
  { name: "Northside Car Care", type: "VALETER", rate: 0, rating: 4.6, jobs: 210, north: 0.025, east: 0.01, work: "WORKSHOP", address: "Mill Lane Trading Estate", extra: { valetPricesPence: [6500, 8500, 11000, 13000] } },
  { name: "Park Road Detailing", type: "VALETER", rate: 0, rating: 4.9, jobs: 170, north: -0.04, east: 0.02, work: "WORKSHOP", address: "40 Park Road", extra: { valetPricesPence: [8500, 10500, 13500, 16000] } },
  { name: "Smart Fix Mobile", type: "BODYWORK", rate: 0, rating: 4.9, jobs: 300, north: 0.01, east: 0.03, extra: { bodyworkServices: true, bodyworkFromPence: 9500, accreditation: "Mobile smart repair", skills: ["smart", "bumper", "chips"], travelRadiusMiles: 20 } },
  { name: "Dent Doctor PDR", type: "BODYWORK", rate: 0, rating: 4.8, jobs: 190, north: -0.02, east: 0.01, extra: { bodyworkServices: true, bodyworkFromPence: 7000, accreditation: "Paintless dent removal", skills: ["pdr"], travelRadiusMiles: 25 } },
  { name: "Kirkstall Body Centre", type: "BODYWORK", rate: 0, rating: 4.8, jobs: 720, north: 0.012, east: -0.035, work: "WORKSHOP", address: "Kirkstall Road", extra: { bodyworkServices: true, bodyworkFromPence: 18000, insuranceApproved: true, accreditation: "BS 10125 Kitemark" } },
  { name: "Northside Accident Repair", type: "BODYWORK", rate: 0, rating: 4.7, jobs: 540, north: 0.03, east: 0.0, work: "WORKSHOP", address: "Northside Business Park", extra: { bodyworkServices: true, bodyworkFromPence: 22000, insuranceApproved: true, accreditation: "Manufacturer approved" } },
  { name: "Park Lane Paint and Panel", type: "BODYWORK", rate: 0, rating: 4.9, jobs: 260, north: -0.03, east: -0.01, work: "WORKSHOP", address: "Park Lane", extra: { bodyworkServices: true, bodyworkFromPence: 15000, accreditation: "Independent body shop" } },
  { name: "Alloy Angels Mobile", type: "BODYWORK", rate: 0, rating: 4.9, jobs: 230, north: 0.02, east: 0.02, extra: { alloyServices: true, alloyRefurbPence: 6500, colourChangePence: 8500, kerbRepairPence: 4500, travelRadiusMiles: 20 } },
  { name: "Rim Rescue Mobile", type: "BODYWORK", rate: 0, rating: 4.7, jobs: 140, north: -0.03, east: -0.02, extra: { alloyServices: true, alloyRefurbPence: 5900, colourChangePence: 7900, kerbRepairPence: 3900, travelRadiusMiles: 15 } },
  { name: "Leeds Wheel Centre", type: "BODYWORK", rate: 0, rating: 4.8, jobs: 610, north: 0.013, east: -0.012, work: "WORKSHOP", address: "Leeds Wheel Centre, Canal Road", extra: { alloyServices: true, alloyRefurbPence: 7500, diamondCutPence: 11000, colourChangePence: 9500, kerbRepairPence: 5000 } },
  { name: "Diamond Cut Co.", type: "BODYWORK", rate: 0, rating: 4.9, jobs: 330, north: 0.03, east: 0.02, work: "WORKSHOP", address: "Unit 9, Harehills Lane", extra: { alloyServices: true, alloyRefurbPence: 8000, diamondCutPence: 9900, colourChangePence: 10000, kerbRepairPence: 5500 } },
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
            labourRatePence: s.rate || null,
            ratingAvg: s.rating,
            jobsCompleted: s.jobs,
            latitude: BASE.lat + s.north,
            longitude: BASE.lng + s.east,
            workshopBays: s.bays,
            isMotStation: s.motFee != null,
            motBays: s.motBays,
            motFeePence: s.motFee,
            approvedAt: new Date(),
            ...s.extra,
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
