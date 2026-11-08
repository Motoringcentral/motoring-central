// Shared wording for the public pages, kept in one place so it's easy to edit.
import type { IconName } from "@/components/Icons";

export type Service = {
  icon: IconName;
  name: string;
  short: string;
  detail: string[];
};

export const services: Service[] = [
  {
    icon: "wrench",
    name: "Mobile mechanic",
    short: "A mechanic comes to your home or work and fixes the car there. Servicing, brakes, battery and diagnostics.",
    detail: [
      "Servicing, brakes, batteries, clutches, diagnostics and more",
      "Done on your driveway or in your work car park",
      "12-month parts and labour warranty, given by the mechanic",
    ],
  },
  {
    icon: "garage",
    name: "Garage",
    short: "Drive to a partner garage near you. Compare price and distance, then pick a time.",
    detail: [
      "Compare local garages by price, rating and distance",
      "Choose a day and time that suits you",
      "Workshop jobs that need a ramp or specialist kit",
    ],
  },
  {
    icon: "mot",
    name: "MOT",
    short: "Done at a partner garage that is an approved test station.",
    detail: [
      "Carried out by DVSA-authorised test centres",
      "Book online and see the price first",
      "Any repairs are priced separately, and only with your OK",
    ],
  },
  {
    icon: "truck",
    name: "Recovery",
    short: "Broken down? A recovery truck takes your car home or to a garage. See the price and arrival time first.",
    detail: [
      "Taken home, to a partner garage or to another address",
      "Price shown before you book, including the journey",
      "In immediate danger, always call 999 first",
    ],
  },
  {
    icon: "tyre",
    name: "Mobile tyres",
    short: "A fitter brings new tyres to you, or repairs a puncture on the spot. We know your tyre size from your reg.",
    detail: [
      "Budget, mid-range and premium tyres",
      "Puncture repairs where the tyre is safe to repair",
      "Pick a time window that suits you",
    ],
  },
  {
    icon: "bolt",
    name: "Auto electrician",
    short: "Electrical faults, batteries, starters, alternators, central locking and dash cams, at your home or work.",
    detail: [
      "Starting and charging faults",
      "Central locking, lights and dash cams",
      "Mobile or at the electrician's workshop",
    ],
  },
  {
    icon: "drop",
    name: "Valeting",
    short: "A full valet at your home, at work or at the valeter's premises. Priced by vehicle size.",
    detail: [
      "Exterior hand wash and wax, wheels, tyres and windows",
      "Interior vacuum, dashboard, trims, seats and carpets",
      "About 3 hours, with one fixed price for your vehicle size",
    ],
  },
  {
    icon: "shield",
    name: "Breakdown cover",
    short: "Find the right RAC cover level, then buy direct from the RAC.",
    detail: [
      "Compare cover levels in plain English",
      "Buy direct from the RAC",
      "Coming soon to the website",
    ],
  },
  {
    icon: "car",
    name: "Cars and vans for sale",
    short: "Browse cars and light commercials from checked dealers.",
    detail: [
      "Cars and vans from checked, independent dealers",
      "Book delivery through our recovery partners",
      "Coming soon to the website",
    ],
  },
];

export const popularRepairs: { icon: IconName; name: string }[] = [
  { icon: "drop", name: "Oil service" },
  { icon: "brakes", name: "Brakes" },
  { icon: "battery", name: "Battery" },
  { icon: "gauge", name: "Diagnostics" },
  { icon: "tyre", name: "Tyres" },
  { icon: "wrench", name: "Clutch" },
  { icon: "mot", name: "MOT" },
  { icon: "spring", name: "Suspension" },
  { icon: "belt", name: "Timing belt" },
];

export const howItWorks = [
  { title: "Enter your reg", text: "We find your exact car and the right parts." },
  { title: "Get a fixed price", text: "Parts and labour in one total, no surprises." },
  { title: "Book and relax", text: "A mechanic, garage, tow truck or tyre fitter, whichever you chose." },
];

export const whyChooseUs: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "shieldTick",
    title: "Checked local experts",
    text: "Every partner's photo ID and insurance is checked before they can take a booking.",
  },
  { icon: "tag", title: "Fixed price before you book", text: "See parts, labour and the total up front. No surprises at the door." },
  {
    icon: "people",
    title: "Real people, not robots",
    text: "A real UK team answers your calls and messages, and steps in if something goes wrong.",
  },
  { icon: "star", title: "You choose who", text: "Compare partners by price, rating and distance, then pick the one you want." },
  { icon: "card", title: "Pay securely", text: "Pay by card when you book. We pay your partner on your behalf." },
  {
    icon: "grid",
    title: "Everything in one place",
    text: "Servicing, repairs, MOT, auto electrics, tyres, valeting, recovery and buying a car or van.",
  },
];
