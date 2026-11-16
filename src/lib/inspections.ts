// Data for the vehicle inspection (partners) and pre-delivery inspection (dealers) forms.
// Update TMC-UPD-20261115-A.
//
// SAMPLE DATA: until logins (Phase 2), bookings (Phase 5) and dealer stock (Phase 6) exist,
// the forms use the sample partner, bookings, dealer and stock below. When those phases are
// built, replace getSample...() with the signed-in partner's or dealer's own records from Supabase.

export type Booking = {
  job: string;
  time: string;
  service: string;
  vrm: string;
  make: string;
  colour?: string;
  year?: string;
  fuel?: string;
  gear?: string;
  mileage?: string; // shown as a hint only: the partner must read the dashboard
  cname: string;
  cphone: string;
  where: string;
  address?: string;
};

export type Partner = { name: string; tech: string; type: string };

export type StockVehicle = {
  key: string;
  kind: "Car" | "Van";
  reg: string;
  make: string;
  model: string;
  variant?: string;
  year?: number;
  miles?: number;
  fuel?: string;
  gear?: string;
  col?: string;
  price?: number;
  stockno?: string;
  soldDate?: string;
  soldPrice?: number;
};

export type Dealer = { name: string; phone?: string; town?: string };

export const SAMPLE_PARTNER: Partner = { name: "Fix It Mobile Mechanics", tech: "Sam Patel", type: "Mobile mechanic" };

export const SAMPLE_BOOKINGS: Booking[] = [
  { job: "TMC-10482", time: "09:00", service: "Full service", vrm: "AB12 CDE", make: "Ford Focus 1.0 EcoBoost", colour: "Blue", year: "2018", fuel: "Petrol", gear: "Manual", mileage: "48210", cname: "Sarah Jones", cphone: "07700 900123", where: "Customer home", address: "14 Elm Road, Leeds LS6" },
  { job: "TMC-10495", time: "11:30", service: "Front brake pads & discs", vrm: "YX19 KLM", make: "Volkswagen Golf 2.0 TDI", colour: "Grey", year: "2019", fuel: "Diesel", gear: "Manual", mileage: "61877", cname: "Mark Thompson", cphone: "07700 900456", where: "Customer workplace", address: "Unit 3, Kirkstall Trade Park, Leeds LS5" },
  { job: "TMC-10501", time: "14:00", service: "Battery replacement", vrm: "LD68 PQR", make: "Vauxhall Corsa 1.4", colour: "White", year: "2018", fuel: "Petrol", gear: "Manual", mileage: "33104", cname: "Priya Shah", cphone: "07700 900789", where: "Customer home", address: "7 Moor Lane, Headingley LS6" },
  { job: "TMC-10512", time: "16:15", service: "Diagnostic – warning light", vrm: "SK21 TUV", make: "Nissan Qashqai 1.3 DIG-T", colour: "Black", year: "2021", fuel: "Petrol", gear: "Automatic", mileage: "22560", cname: "Daniel Hughes", cphone: "07700 900321", where: "Customer home", address: "22 Station Road, Horsforth LS18" },
];

export const SAMPLE_DEALER: Dealer = { name: "Albion Autos", phone: "0114 000 0104", town: "Sheffield" };

export const SAMPLE_STOCK: StockVehicle[] = [
  { key: "demo:1", kind: "Car", reg: "AB12 CDE", make: "Ford", model: "Focus", variant: "1.0 EcoBoost Zetec", year: 2018, miles: 41200, fuel: "Petrol", gear: "Manual", col: "Blue", price: 8995, stockno: "ST-1042" },
  { key: "demo:2", kind: "Car", reg: "YX19 KLM", make: "Nissan", model: "Qashqai", variant: "1.3 DIG-T N-Connecta", year: 2020, miles: 27600, fuel: "Petrol", gear: "Manual", col: "Red", price: 15250, stockno: "ST-1051" },
  { key: "demo:3", kind: "Van", reg: "LD68 PQR", make: "Volkswagen", model: "Transporter", variant: "T6.1 2.0 TDI Highline", year: 2021, miles: 52800, fuel: "Diesel", gear: "Manual", col: "White", price: 24995, stockno: "ST-1060" },
];

/* ---------- vehicle inspection (partners) ---------- */

export const PARTNER_TYPES = ["Garage", "Mobile mechanic", "Tyre fitter", "Recovery", "Valeter", "Body shop", "Auto electrician", "EV charging"];
export const VEHICLE_LOCATIONS = ["At workshop", "Customer home", "Customer workplace", "Roadside", "Other"];

export const QUICK_CHECKS: [string, string[]][] = [
  ["Windscreen & glass", ["OK", "Chipped", "Cracked"]],
  ["Front left alloy / wheel", ["OK", "Kerbed", "Damaged"]],
  ["Front right alloy / wheel", ["OK", "Kerbed", "Damaged"]],
  ["Rear left alloy / wheel", ["OK", "Kerbed", "Damaged"]],
  ["Rear right alloy / wheel", ["OK", "Kerbed", "Damaged"]],
  ["Lights & lenses", ["OK", "Cracked", "Not working"]],
  ["Mirrors", ["OK", "Damaged"]],
  ["Interior (seats, trim)", ["OK", "Marked", "Damaged"]],
  ["Dashboard warning lights", ["None", "On"]],
  ["Valuables left in vehicle", ["None", "Yes – noted"]],
  ["Keys received", ["1", "2", "Keyless", "None"]],
];
export const BAD_ANSWERS = new Set(["Chipped", "Cracked", "Kerbed", "Damaged", "Not working", "Marked", "On", "Yes – noted"]);

export const INSPECTION_LEGAL =
  "This inspection records damage and faults already on the vehicle before the partner began work. It protects both the customer and the partner. Damage not listed here is not admitted as pre-existing, and any claim about work carried out is handled with the partner, who provides the warranty for their work. The Motoring Central Ltd is not responsible for the work carried out.";

/* ---------- pre-delivery inspection (dealers) ---------- */

export const PDI_OPTIONS = ["OK", "Fixed", "Advise", "N/A"];

export const PDI_SECTIONS: { title: string; items: string[]; vanOnly?: boolean }[] = [
  { title: "Documents & checks", items: ["V5C logbook present / keeper change done", "Service history handed over", "MOT certificate valid", "Vehicle history check clear (finance, stolen, write-off)", "Outstanding recalls checked", "Owner's handbook", "Spare key", "Locking wheel nut key", "Previous owner's data cleared (sat nav, phone pairing)"] },
  { title: "Exterior", items: ["Paintwork and panels", "Windscreen and glass", "All lights working", "Wipers and washers", "Mirrors", "Number plates legal", "Wheels / alloys", "Spare wheel or repair kit"] },
  { title: "Interior", items: ["Seats and trim", "Seatbelts", "No warning lights on", "Heater and air conditioning", "Electric windows and central locking", "Infotainment, Bluetooth and sat nav", "Horn", "Clock and date set", "Floor mats", "Parcel shelf / load cover"] },
  { title: "Under the bonnet", items: ["Engine oil level", "Coolant level", "Brake fluid", "Screenwash topped up", "Power steering fluid", "Battery health tested", "No fluid leaks", "Service indicator reset"] },
  { title: "Underside, brakes & suspension", items: ["Brake pads and discs", "Brake pipes and hoses", "Exhaust and mountings", "Shock absorbers and springs", "Drive shafts and CV boots", "Underbody corrosion"] },
  { title: "Road test", items: ["Starts and idles correctly", "Clutch and gearbox", "Brakes and handbrake", "Steering pulls straight", "No knocks or abnormal noises", "Cruise control, sensors and camera"] },
  { title: "Van extras", items: ["Load area and bulkhead", "Side and rear doors and locks", "Load lashing points", "Tow bar and electrics", "Racking or ply lining"], vanOnly: true },
  { title: "Final preparation", items: ["Full valet completed", "Tyre pressures set", "Road tax explained to buyer", "Warranty documents handed over", "Delivery paperwork signed"] },
];

export const TYRES = ["Front left", "Front right", "Rear left", "Rear right", "Spare"];
export const HANDOVER_METHODS = ["Buyer collecting", "Delivered by us", "Delivered by recovery partner"];
export const WARRANTIES = ["None (trade / sold as seen)", "3 months", "6 months", "12 months", "Other"];
export const PAYMENTS = ["Paid in full", "Finance", "Part exchange + balance", "Deposit only"];
export const KEYS = ["1", "2", "3", "Keyless + fob"];

export const PDI_LEGAL =
  "This pre-delivery inspection records the condition of the vehicle at handover. The vehicle is sold by the dealer named above, who is responsible for the sale, its description and any warranty. The Motoring Central Ltd advertises vehicles and is not a party to the sale. This record does not affect the buyer's statutory rights.";

/* ---------- finished records (this device only until Phase 5/6) ---------- */
// Phase 5/6: replace these with saving to Supabase (form data, photos, signatures and the PDF)
// against the booking or vehicle, readable only by its partner/dealer and by admins.

export const INSPECTION_RECORDS_KEY = "tmc-inspections";
export const PDI_RECORDS_KEY = "tmc-pdis";

export function saveRecord(key: string, id: string, record: Record<string, unknown>) {
  try {
    const all = JSON.parse(localStorage.getItem(key) || "{}") || {};
    all[id] = { ...record, at: Date.now() };
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* storage full or blocked */
  }
}
