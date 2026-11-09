// Customer-bookable services. Keys match the ServiceMode enum in the schema.
export const SERVICES = {
  MOBILE_MECHANIC: { name: "Mobile mechanic" },
  GARAGE: { name: "Garage" },
  AUTO_ELECTRICIAN: { name: "Auto electrician" },
  RECOVERY: { name: "Recovery" },
  MOBILE_TYRES: { name: "Mobile tyres" },
  VALET: { name: "Full valet" },
  BODYWORK: { name: "Bodywork and alloy wheels" },
  ALLOY_WHEELS: { name: "Alloy wheel refurbishment" },
  EV_CHARGING: { name: "Mobile EV charging" },
} as const;

export type ServiceKey = keyof typeof SERVICES;

// Fired by a service tile to send the driver to the reg box with that service chosen.
export const PICK_SERVICE_EVENT = "mc:pick-service";

export type PickServiceDetail = { service: ServiceKey; label: string };
