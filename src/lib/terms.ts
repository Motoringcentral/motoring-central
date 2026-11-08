// The terms and conditions, copied from the prototype.
// DRAFT: have these checked by a solicitor before launch. Fill in everything in [square brackets].

export type TermsSection = {
  id: string;
  title: string;
  intro?: string[];
  parts?: { heading: string; text: string }[];
};

export const termsSummary = [
  {
    lead: "The Motoring Central is a marketplace.",
    text: "We introduce you to independent garages, mobile mechanics, recovery companies, tyre fitters, valeters and dealers. We do not carry out the work or sell the vehicles ourselves.",
  },
  {
    lead: "Work and repairs:",
    text: "your contract is with the garage or partner who does the work. They are responsible for the quality of their work, any parts they supply, and their warranty.",
  },
  {
    lead: "Car and van sales:",
    text: "your contract is with the dealer. The dealer is responsible for the vehicle, its description, its condition and any warranty.",
  },
  {
    lead: "Your legal rights stay in place.",
    text: "Nothing in these terms takes away your rights under the Consumer Rights Act 2015. You use those rights against the partner or dealer you dealt with.",
  },
  {
    lead: "",
    text: "Before you book or contact a dealer, we show you who you are dealing with and ask you to confirm you understand this.",
  },
];

export const termsSections: TermsSection[] = [
  {
    id: "customers",
    title: "1. Using The Motoring Central (all customers)",
    parts: [
      {
        heading: "Who we are",
        text: "The Motoring Central is run by The Motoring Central Ltd, a company registered in England and Wales, company number [company number], registered office [address]. Contact us at [email].",
      },
      {
        heading: "Our role",
        text: "We run an online marketplace. We list independent businesses (“partners” and “dealers”). We call them partners because they work with us, but they are separate businesses: this is not a legal partnership, joint venture or agency. We show their prices and availability, and take bookings and payments for them. We are not a party to the contract for the work or the sale. Each listing and booking shows the business you are dealing with.",
      },
      {
        heading: "Who is responsible for the work or vehicle",
        text: "The partner or dealer is responsible for the work they carry out, the parts and goods they supply, the vehicles they sell, and any warranty or guarantee they give. If something goes wrong, your claim is against them. We will help you contact them and, if needed, give you their full business details.",
      },
      {
        heading: "Your statutory rights",
        text: "Services must be carried out with reasonable care and skill, and goods and vehicles must be of satisfactory quality, fit for purpose and as described. These rights come from the Consumer Rights Act 2015 and cannot be removed by these terms. You use them against the partner or dealer.",
      },
      {
        heading: "Checks we carry out",
        text: "We check each partner’s photo ID, trade insurance and public liability insurance before they can take bookings, and again when documents expire. These checks help keep the marketplace safe, but they are not a guarantee of the quality of any work.",
      },
      {
        heading: "Prices, payment and our booking fee",
        text: "Prices are set by each partner. When you pay through The Motoring Central, we collect the payment on the partner’s behalf, and paying us counts as paying them. Our booking fee [currently £2.50 per booking, launch offer] is shown before you book. If the partner cancels, we refund the booking fee.",
      },
      {
        heading: "Cancelling a booking",
        text: "You can cancel free of charge up to [24 hours] before the booked time. If you cancel later, the partner may charge a cancellation fee shown at the time of booking. Recovery jobs that are already under way cannot be cancelled free of charge.",
      },
      {
        heading: "Problems and complaints",
        text: "Contact the partner or dealer first, using the details in your booking or the advert. If you cannot resolve it, contact us at [email] and we will try to help both sides reach an agreement. This does not affect your right to take the matter further.",
      },
      {
        heading: "Our responsibility to you",
        text: "We are responsible for running the website and app with reasonable care and skill, and for the accuracy of information we write ourselves. We are not responsible for the work, parts, goods or vehicles supplied by partners or dealers. Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.",
      },
      {
        heading: "Reviews",
        text: "Reviews must be honest and about a real booking or purchase. We may remove reviews that are false, offensive or unlawful.",
      },
      {
        heading: "Law",
        text: "These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your local courts.",
      },
    ],
  },
  {
    id: "garages",
    title: "2. Garages, mobile mechanics and auto electricians",
    intro: [
      "These terms apply when you book a service, repair, diagnostic or electrical job with a garage, mobile mechanic or auto electrician. Wherever this section says “garage or mechanic”, it includes auto electricians.",
    ],
    parts: [
      {
        heading: "Your contract is with the garage or mechanic",
        text: "The garage or mechanic named in your booking carries out the work and is responsible for it.",
      },
      {
        heading: "Warranty",
        text: "The warranty on the workmanship and on any parts fitted is given by the garage or mechanic, not by The Motoring Central. They must show their warranty terms before you book. Warranty claims are made directly to them. Parts carry the manufacturer’s warranty, which the garage or mechanic will deal with for you.",
      },
      {
        heading: "Extra work",
        text: "If the garage or mechanic finds more work is needed, they must explain it and get your agreement and a price before doing it. You do not have to pay for extra work you did not agree to.",
      },
      {
        heading: "Mobile work",
        text: "For mobile bookings you must make sure the vehicle is somewhere it is safe and legal to work on, and that you have permission to have work done there. If the job cannot be done safely, the mechanic may rearrange it.",
      },
      {
        heading: "Damage",
        text: "The garage or mechanic is responsible for any damage they cause to your vehicle or property while working on it, and must hold insurance to cover this.",
      },
    ],
  },
  {
    id: "mot",
    title: "3. MOT tests",
    intro: [
      "MOT tests are carried out by DVSA-authorised test centres listed on The Motoring Central. The test result is the test centre’s decision. If you disagree with a result, raise it with the test centre first; you can also appeal to the DVSA. Any repairs after the test are a separate job with the garage, with its own price and warranty from that garage.",
    ],
  },
  {
    id: "tyres",
    title: "4. Tyre fitting",
    intro: [
      "The tyre fitter named in your booking supplies and fits the tyres and is responsible for the fitting work and its warranty. Tyres carry the manufacturer’s warranty, which the fitter will deal with for you. Puncture repairs are only carried out where the tyre can be safely repaired; if it cannot, the fitter will tell you and offer a replacement. Follow the fitter’s advice on rechecking wheel nuts after fitting.",
    ],
  },
  {
    id: "valeting",
    title: "5. Valeting",
    intro: [
      "The valeter named in your booking carries out the valet and is responsible for their work and any damage they cause. Please remove valuables before the valet. Report any problem or damage to the valeter within [48 hours], with photos if you can, so they can put it right.",
    ],
  },
  {
    id: "recovery",
    title: "6. Recovery and breakdown",
    intro: [
      "The recovery company named in your booking carries out the recovery and is responsible for your vehicle from when they load it until they deliver it. They must hold insurance for vehicles in their care. Prices are based on the details you give; if the job turns out to be different (for example a longer distance or extra equipment), the company must tell you the new price before carrying on. Please remove valuables, and always follow the driver’s safety instructions at the roadside.",
      "The same applies when you book a recovery partner to deliver a car or van you have bought. Delivery is a separate booking with the recovery partner. Make sure the vehicle is paid for and the seller has agreed the collection before the delivery day.",
    ],
  },
  {
    id: "sales",
    title: "7. Buying a car or van",
    parts: [
      {
        heading: "Your contract is with the dealer",
        text: "Cars and vans on The Motoring Central are advertised and sold by independent dealers. Any sale, deposit, part exchange, finance or delivery is agreed between you and the dealer. The Motoring Central does not own, inspect or sell the vehicles.",
      },
      {
        heading: "Liability and warranty stay with the dealer",
        text: "The dealer is responsible for the advert being accurate, for the vehicle’s condition, history and roadworthiness, for making sure they have the right to sell it, and for any warranty they offer. Any claim about the vehicle is made against the dealer.",
      },
      {
        heading: "Your rights",
        text: "When you buy from a dealer, the vehicle must be of satisfactory quality, fit for purpose and as described. If it is faulty you may have the right to reject it within 30 days, or to a repair or replacement after that. If you buy without visiting the dealer, you may also have cancellation rights. These rights are against the dealer. Vans bought for business use have fewer consumer rights.",
      },
      {
        heading: "Before you buy",
        text: "We recommend you view and test drive the vehicle, check the V5C and service history, and run a vehicle history check before paying a deposit.",
      },
    ],
  },
  {
    id: "partners",
    title: "8. Partner terms (garages, mechanics, recovery, tyres, valeting)",
    parts: [
      {
        heading: "Independent business",
        text: "You join The Motoring Central as an independent business. We call you a “partner”, but this does not create a legal partnership or joint venture, and you are not our employee or agent.",
      },
      {
        heading: "Your work, your warranty",
        text: "You are solely responsible for the quality and safety of your work, the parts and goods you supply, and any damage you cause. You give the warranty on your work and must show your warranty terms to customers before they book. You must deal with warranty claims and complaints directly, promptly and fairly, and meet customers’ rights under the Consumer Rights Act 2015.",
      },
      {
        heading: "Insurance and documents",
        text: "You must hold trade insurance and public liability insurance at all times (and, for recovery, cover for vehicles in your care), and keep the copies on The Motoring Central in date. We may pause your account if a document expires.",
      },
      {
        heading: "Working properly",
        text: "You must have the skills, qualifications and authorisations the work needs (for example DVSA authorisation for MOT tests), follow the law, dispose of waste such as oil and tyres legally, and get the customer’s agreement before doing extra work.",
      },
      {
        heading: "Fees and payment",
        text: "You choose a plan. Pay as you go: we charge a fee on each completed job [launch offer 5%, usually 10%]. Pro: a monthly membership [launch offer £74.50, usually £149] with no fee on jobs, charged once your documents are verified. You can switch or cancel at the end of any month. We pay you what customers paid, less our fee, every week. Trade listings are [£9.99] each.",
      },
      {
        heading: "Indemnity",
        text: "You agree to cover any loss, claim or cost we suffer because of your work, your goods or your breach of these terms.",
      },
      {
        heading: "Customer information",
        text: "Use customer details only to carry out the booking, and keep them secure in line with data protection law.",
      },
      {
        heading: "Ending the agreement",
        text: "You can close your account at any time. We may suspend or close accounts for poor service, missing documents or breaking these terms.",
      },
    ],
  },
  {
    id: "dealers",
    title: "9. Dealer terms",
    parts: [
      {
        heading: "You are the seller",
        text: "You sell vehicles directly to buyers. The Motoring Central provides advertising and does not take part in the sale.",
      },
      {
        heading: "Liability and warranty",
        text: "You are solely responsible for your adverts being accurate and complete, for each vehicle’s condition, history, roadworthiness and legal title (including no outstanding finance), for any warranty you give, and for buyers’ rights under consumer law, including returns and rejections. You must deal with complaints and claims directly.",
      },
      {
        heading: "Trading properly",
        text: "You must make clear you are a business seller, hold motor trade insurance, and hold any authorisation needed for finance you offer (for example from the Financial Conduct Authority). Remove adverts promptly once a vehicle is sold or reserved.",
      },
      {
        heading: "Fees",
        text: "New dealers get their first [3] months free on any plan, including the free premium ads. The first payment is taken at the start of month [4], and we email a reminder [7] days before. You can cancel before then and pay nothing. After that, membership is charged monthly by plan: Starter (1 to 10 cars) [£149], Standard (11 to 20 cars) [£199] with [1] free premium ad a month, Plus (21 to 30 cars) [£249] with [3], Pro (31 to 50 cars) [£299] with [4], and Premier (51 or more cars) [£399] with [5]. A premium ad runs for 2 weeks or until the car sells, whichever comes first. Free premium ads do not roll over. Extra premium ads are [£5.00] each (usually [£9.99]). Trade listings: [5] free a month, then [£9.99] each. You can cancel at the end of any month.",
      },
      {
        heading: "Indemnity",
        text: "You agree to cover any loss, claim or cost we suffer because of your vehicles, your adverts or your breach of these terms.",
      },
    ],
  },
  {
    id: "trade",
    title: "10. Trade sales (trade to trade, sold as seen)",
    parts: [
      {
        heading: "Who can use it",
        text: "The Trade section is only for logged-in partners and dealers buying and selling as businesses. Private buyers cannot use it.",
      },
      {
        heading: "Sold as seen, no warranty",
        text: "Every vehicle in the Trade section is sold as seen, trade to trade, with no warranty from the seller or from The Motoring Central. Business buyers do not have the consumer rights that private buyers have. The buyer must inspect the vehicle and rely on their own checks.",
      },
      {
        heading: "Honest descriptions",
        text: "Sellers must describe vehicles accurately, list all known faults, and have the right to sell them. A vehicle sold as seen must still match its description.",
      },
      {
        heading: "Prices and offers",
        text: "Sellers either set a minimum price, which a buyer can accept straight away, or invite offers with a hidden minimum. Offers below the minimum are declined automatically. When a seller accepts an offer or a buyer buys at the minimum price, the two businesses agree payment and collection directly. The Motoring Central is not a party to the sale.",
      },
      {
        heading: "Listing fees",
        text: "Each trade listing is [£9.99]. Dealers get [5] free trade listings each calendar month with their membership. Fees are not refunded if a listing is withdrawn.",
      },
    ],
  },
];
