/**
 * The "Start" guide for people who've never sold at a market. Written for the
 * LA area, in plain English. General information, not legal advice: rules
 * differ by city and change, so every step points to the agency to confirm.
 *
 * Each step can tick itself off from the vendor's documents (docType) and
 * shows resources from the Start hub (resourceCategories).
 */

export type GuideStep = {
  key: string
  title: string
  summary: string
  details: string[]
  docType?: string
  resourceCategories: string[]
}

const STEPS: Record<string, GuideStep> = {
  license: {
    key: "license",
    title: "Register your business",
    summary: "A business license or tax registration from your city.",
    details: [
      "Most cities want a business license or business tax registration. In the City of LA it's the Business Tax Registration Certificate (BTRC).",
      "It's based on where your business is located (often your home), not where the market is. Some cities also ask event sellers to register.",
      "Selling under a name that isn't your own? File a DBA (\"Doing Business As\" / fictitious business name) with the county.",
      "Not sure what applies? The CalGold finder lists permits by city and business type.",
    ],
    docType: "business_license",
    resourceCategories: ["business_license"],
  },
  sellers: {
    key: "sellers",
    title: "Get a seller's permit (free)",
    summary: "Lets you collect sales tax. Almost every market asks for it.",
    details: [
      "Apply online with the CDTFA. It's free and often issued the same day.",
      "Only doing a few events? Ask about a temporary seller's permit.",
      "You'll report and pay the sales tax you collect, usually quarterly or yearly. Keep a simple record of sales per market.",
      "With a seller's permit you can give suppliers a resale certificate and buy stock you'll resell without paying sales tax on it.",
    ],
    docType: "sellers_permit",
    resourceCategories: ["sellers_permit"],
  },
  handler: {
    key: "handler",
    title: "Food safety training",
    summary: "A food handler card for everyone who handles food.",
    details: [
      "California requires a Food Handler Card for food workers: a short online course and test (usually under $20).",
      "Many health departments also want one person with a Food Protection Manager certification (a longer course and proctored exam).",
    ],
    docType: "food_handler_card",
    resourceCategories: ["food_handler"],
  },
  kitchen: {
    key: "kitchen",
    title: "Find a commercial or shared kitchen",
    summary: "Rent prep space by the hour or day.",
    details: [
      "Prepared food has to be made in a permitted kitchen, not at home. Shared kitchens rent by the hour or day; some include storage.",
      "Your health permit application usually asks for the kitchen's name and a signed agreement, so line this up first.",
      "Ask what's included: fridge and freezer space, dry storage, dishwashing, parking for loading.",
    ],
    resourceCategories: ["kitchen"],
  },
  commissary: {
    key: "commissary",
    title: "Get a commissary",
    summary: "Where your truck or cart preps, cleans and parks overnight.",
    details: [
      "Food trucks and carts must operate from an approved commissary: a permitted base for prep, fresh water, waste water, grease and overnight parking.",
      "The health department will ask for a signed commissary agreement with your permit application.",
    ],
    resourceCategories: ["kitchen"],
  },
  healthEvent: {
    key: "healthEvent",
    title: "Get your health permit",
    summary: "A temporary food facility (TFF) permit for events.",
    details: [
      "Food booths at markets and events usually need a Temporary Food Facility (TFF) permit for each event or an annual one. Ask the organizer; many markets coordinate this.",
      "Expect to need a handwashing station with warm water, a food thermometer, covered food and an overhead canopy.",
      "Pasadena and Long Beach have their own health departments; most other LA-area cities use LA County.",
    ],
    docType: "health_permit",
    resourceCategories: ["health_permit"],
  },
  healthTruck: {
    key: "healthTruck",
    title: "Get your mobile food permit",
    summary: "Plan check, inspection, then a yearly permit.",
    details: [
      "Trucks and carts go through a plan check (the health department reviews your vehicle's layout and equipment) and an inspection before getting a Mobile Food Facility permit.",
      "Buying a used truck? Check it can pass plan check before you buy.",
      "Keep the permit, commissary agreement and inspection report in the truck: inspectors ask for them.",
    ],
    docType: "health_permit",
    resourceCategories: ["health_permit"],
  },
  fire: {
    key: "fire",
    title: "Fire safety",
    summary: "Canopy, extinguisher, and fire inspection if you cook.",
    details: [
      "Many events require a flame-retardant canopy with a California State Fire Marshal (CSFM) label, plus weights on every leg (often 25–40 lb each).",
      "Cooking with propane or open flame usually means a fire extinguisher (often a K-class for grease) and sometimes a fire department inspection. Food trucks with cooking equipment often need a fire inspection too.",
    ],
    resourceCategories: ["fire_safety"],
  },
  cottage: {
    key: "cottage",
    title: "Home kitchen? Register as a Cottage Food Operation",
    summary: "Sell low-risk foods made at home, with no commercial kitchen.",
    details: [
      "Cottage food covers foods on the state's approved list: breads, cookies, jams, dried fruit, candy and similar. Nothing that needs refrigeration.",
      "\"Class A\" lets you sell directly to customers (like at markets). \"Class B\" also lets you sell through shops and cafés, and needs an inspection.",
      "You'll need to complete a food processor course within 3 months of registering.",
      "Labels must say the food was made in a home kitchen and list ingredients and allergens.",
    ],
    docType: "health_permit",
    resourceCategories: ["cottage_food"],
  },
  packaged: {
    key: "packaged",
    title: "Made in a commercial kitchen? Register your packaged food",
    summary: "Sauces, snacks and drinks sold sealed usually need state registration.",
    details: [
      "Packaged foods made in a commercial kitchen (not under cottage food) generally need a Processed Food Registration from the California Department of Public Health.",
      "Some foods (acidified foods like salsas and pickles, low-acid canned foods) have extra federal rules and process reviews.",
    ],
    resourceCategories: ["packaged_food", "kitchen"],
  },
  labels: {
    key: "labels",
    title: "Get your labels right",
    summary: "Name, ingredients, allergens, weight, who made it.",
    details: [
      "Packaged food labels need the product name, net weight, ingredients in order of weight, major allergens (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame) and your business name and address.",
      "Don't make health claims (\"cures\", \"detox\") without checking the rules.",
    ],
    resourceCategories: [],
  },
  productRules: {
    key: "productRules",
    title: "Check rules for your products",
    summary: "Kids' items, cosmetics, candles and resale have extra rules.",
    details: [
      "Anything for children 12 and under (kids' clothing, toys, baby items) must meet federal safety rules: tracking labels, and testing for things like lead.",
      "Soaps, lotions, lip balms and other cosmetics need proper ingredient labels and safe ingredients.",
      "Candles: many markets ask about fire safety and want warning labels.",
      "Never sell knockoffs of brands (logos, \"inspired by\" copies). Markets ban it and it's illegal. Vintage and resale of genuine items is fine.",
      "Clothing you make: include a fiber-content and care label.",
    ],
    resourceCategories: ["product_safety"],
  },
  insurance: {
    key: "insurance",
    title: "Get liability insurance",
    summary: "Markets almost always ask for a certificate of insurance (COI).",
    details: [
      "Most markets ask for general liability insurance, often $1 million per occurrence. If you sell products (food or goods), make sure it includes product liability.",
      "Markets usually want to be named as \"additional insured\" on your certificate. Good providers let you add each market for free, in minutes.",
      "You can buy yearly cover or cover for a single event. Yearly is usually cheaper if you'll do more than a few markets.",
    ],
    docType: "liability_insurance",
    resourceCategories: ["insurance"],
  },
  truckInsurance: {
    key: "truckInsurance",
    title: "Insure your truck",
    summary: "General liability plus commercial auto.",
    details: [
      "Trucks need commercial auto insurance on top of general liability. Personal car insurance won't cover a business vehicle.",
      "Markets will still want a certificate naming them as additional insured.",
    ],
    docType: "liability_insurance",
    resourceCategories: ["insurance"],
  },
  payments: {
    key: "payments",
    title: "Take cards",
    summary: "Most customers pay by card or phone.",
    details: [
      "Get a card reader that works offline (market Wi-Fi is often bad). Readers cost around $50–$60, and card fees are usually around 2.6–3% per sale.",
      "Bring a cash float too: about $100 in small bills and coins.",
      "Put a QR code or sign with your Instagram at the booth so buyers can find you again.",
    ],
    resourceCategories: ["payments"],
  },
}

export type Track = {
  key: string
  label: string
  description: string
  examples: string
  steps: string[]
}

export const TRACKS: Track[] = [
  {
    key: "prepared",
    label: "Hot or prepared food",
    description: "Cooked or made to order at your booth.",
    examples: "Tacos, BBQ, dumplings, coffee, smoothies",
    steps: ["license", "sellers", "handler", "kitchen", "healthEvent", "fire", "insurance", "payments"],
  },
  {
    key: "truck",
    label: "Food truck or cart",
    description: "Selling from a truck, trailer or cart.",
    examples: "Taco trucks, coffee carts, ice cream carts",
    steps: ["license", "sellers", "handler", "commissary", "healthTruck", "fire", "truckInsurance", "payments"],
  },
  {
    key: "packaged",
    label: "Home-made or packaged food",
    description: "Sold wrapped or sealed.",
    examples: "Cookies, bread, jams, hot sauce, granola",
    steps: ["license", "sellers", "cottage", "packaged", "labels", "insurance", "payments"],
  },
  {
    key: "goods",
    label: "Clothing, crafts & other goods",
    description: "Anything that isn't food.",
    examples: "Clothing, jewelry, art, vintage, candles, plants",
    steps: ["license", "sellers", "productRules", "insurance", "fire", "payments"],
  },
]

export function trackSteps(track: Track): GuideStep[] {
  return track.steps.map((k) => STEPS[k])
}

/** A good starting track for a signed-in vendor, from their profile. */
export function suggestedTrack(category: string | null | undefined, setupType: string | null | undefined): string {
  const nonFood = ["clothing", "jewelry", "art", "crafts", "vintage", "beauty", "plants", "home_goods"]
  if (category && nonFood.includes(category)) return "goods"
  if (setupType === "truck" || setupType === "cart" || setupType === "trailer") return "truck"
  if (category === "baked_goods" || category === "packaged" || category === "produce") return "packaged"
  return "prepared"
}

/** Sections for every kind of vendor, below the steps. */
export const COMMON_SECTIONS: { key: string; title: string; items: string[] }[] = [
  {
    key: "kit",
    title: "Your market-day packing list",
    items: [
      "10×10 canopy (flame-retardant, CSFM label) and weights for every leg",
      "Folding table(s) and a tablecloth that reaches the ground",
      "A sign with your name, big enough to read from 20 feet",
      "Price tags or a menu board: people walk past booths without prices",
      "Card reader (charged!), phone battery pack, and a cash float",
      "Printed permits and insurance certificate (inspectors and organizers ask)",
      "Bags, napkins or packaging; trash bags; hand sanitizer",
      "Chair, water, sunscreen; lights and extension cord for night markets",
      "Clips, zip ties, tape and a small toolkit",
    ],
  },
  {
    key: "money",
    title: "Pricing & money basics",
    items: [
      "Work out your cost per item (ingredients or materials, packaging, card fees) and price at least 2–3× that.",
      "Break-even check: booth fee ÷ profit per item = how many you must sell just to cover the booth. If that number looks scary, pick a cheaper market first.",
      "Round prices ($5, $10, $25) to make paying fast, and consider bundles (3 for $20).",
      "Set aside the sales tax you collect. It isn't your money.",
      "Track sales per market so you know which ones are worth going back to.",
    ],
  },
  {
    key: "picking",
    title: "Picking your first markets",
    items: [
      "Read vendor reviews on Stallpass: foot traffic, organization and \"how sales went\" tell you more than the market's own ads.",
      "Start with smaller, cheaper markets to test your setup and prices before paying for big events.",
      "Match the crowd: families and morning shoppers vs. night-market crowds vs. tourists.",
      "Visit as a shopper first if you can: how busy is it, what sells, who's nearby?",
      "Apply early: popular markets fill up weeks ahead, and many don't allow two vendors selling the same thing.",
    ],
  },
]

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need all of this before my first market?",
    a: "Most markets ask for a seller's permit, insurance and (for food) a health permit before you can set up. The business license and training are usually required too. Get them in the order above; many take only days.",
  },
  {
    q: "How much does it cost to get started?",
    a: "It varies a lot. Non-food sellers can often start for a few hundred dollars (insurance, canopy, weights, card reader). Food adds kitchen rental, health permits and equipment. The shared kitchens and insurance listed here show typical prices.",
  },
  {
    q: "What's a certificate of insurance (COI)?",
    a: "A one-page document from your insurer proving you're covered. Markets usually want their name on it as \"additional insured\". Upload it to Documents so it's ready for every application.",
  },
  {
    q: "Can I sell at markets in other cities?",
    a: "Yes. Your seller's permit covers all of California. Health permits depend on the city or county where the event is, and some cities have their own business rules. Check each market's requirements on Stallpass before applying.",
  },
]

export const RESOURCE_CATEGORY_LABELS: Record<string, string> = {
  business_license: "Business license",
  sellers_permit: "Seller's permit & sales tax",
  food_handler: "Food safety training",
  kitchen: "Shared & commissary kitchens",
  health_permit: "Health permits",
  insurance: "Insurance",
  cottage_food: "Cottage food (home kitchen)",
  packaged_food: "Packaged food",
  product_safety: "Product safety & labeling",
  fire_safety: "Fire safety",
  supplies: "Tents & booth supplies",
  payments: "Card readers & payments",
  other: "Other",
}
