/* Procis Terminal demo data.
   Brightwater, its suppliers and every event not marked real are fictional.
   Index series come from data/markets.json (real public data, fetched at build time).
   Prices and cost blocks in INR are illustrative. */
window.DEMO = {
  client: "Brightwater Consumer Goods",
  baseMonth: "2026-05-01", // the month most supplier prices were last set; should-cost re-prices from here
  totalSpend: 520, // addressable spend, INR crore a year

  // Real freight snapshot (Drewry World Container Index, 12 Nov 2026)
  freight: {
    id: "wci", name: "Container freight, world composite", unit: "USD per 40ft", group: "Freight",
    src: "Drewry World Container Index, 12 Nov 2026", url: "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry",
    last: ["2026-11-12", 4305], wow: -2,
    lanes: [["World composite", 4305, "-2%"], ["Shanghai to Rotterdam", 3504, "-3%"], ["Shanghai to Genoa", 4168, "0%"]],
    note: "Drewry expects rates to fall further next week. A weekly snapshot, not a series: a client deployment takes the licensed weekly feed."
  },

  illustrative: [],
  tilesOrder: ["sugar", "palm", "wheat", "cocoa", "chem-eu", "plastics-eu", "paper-eu", "brent", "gas-eu", "wci", "usdinr", "eurinr"],

  // spend in INR crore a year
  suppliers: [
    { id: "tidewater", name: "Tidewater Edible Oils", cat: "Ingredients", makes: "Refined palm oil", spend: 78, plant: "Kakinada", status: ["ok", "Normal"],
      detail: "Main oil supplier for biscuits and snacks. Price resets monthly on the palm index.", exposure: [["palm", 60, 5]] },
    { id: "sarna", name: "Sarna Oleochem", cat: "Chemicals", makes: "Surfactants (SLES, LAS)", spend: 55, plant: "Kandla", status: ["mid", "Price letter"],
      detail: "Palm-based surfactants for detergents, shampoo and hand wash. Price last set in May.", exposure: [["sles", 100, 4]] },
    { id: "harbourline", name: "Harbourline Logistics", cat: "Logistics", makes: "Road distribution, port forwarding", spend: 42, plant: "Nhava Sheva", status: ["ok", "Normal"],
      detail: "Primary distribution from four plants to 22 depots. Road rates carry a diesel-linked fuel component set in May.", exposure: [] },
    { id: "halden", name: "Halden Sugars", cat: "Ingredients", makes: "Refined sugar", spend: 40, plant: "Kolhapur", status: ["ok", "Normal"],
      detail: "Sugar for biscuits and beverages. Contract price set in May; quarterly review in December.", exposure: [["sugar", 70, 6]] },
    { id: "aldane", name: "Aldane Aromatics", cat: "Chemicals", makes: "Fragrance compounds", spend: 36, plant: "Mumbai", status: ["ok", "Normal"],
      detail: "Imported fragrance compounds, priced to Brightwater in rupees from a euro list at the May exchange rate.", exposure: [["fragrance", 100, 10]] },
    { id: "stonemill", name: "Stonemill Foods", cat: "Ingredients", makes: "Wheat flour", spend: 30, plant: "Indore", status: ["ok", "Normal"],
      detail: "Flour for the biscuit lines. Single source; a second mill is in qualification.", exposure: [["flour", 100, 3]] },
    { id: "boxwell", name: "Boxwell Corrugators", cat: "Packaging", makes: "Shipper cartons", spend: 22, plant: "Pune", status: ["ok", "Normal"],
      detail: "Corrugated for all categories. Board indexed to paper prices each quarter.", exposure: [["shipper", 100, 3]] },
    { id: "laminex", name: "Laminex Tubes", cat: "Packaging", makes: "Toothpaste tubes", spend: 20, plant: "Silvassa", status: ["bad", "Fire, line 3"],
      detail: "Two tube lines in Silvassa. Line 3 makes the 100 g toothpaste tube.", exposure: [["toothpaste", 70, 3.5]] },
    { id: "kestrel", name: "Kestrel Packaging", cat: "Packaging", makes: "Tubes and bottles", spend: 18, plant: "Daman", status: ["ok", "Spare capacity"],
      detail: "Qualified on the toothpaste tube since 2025. About 6 million tubes a month of spare capacity.", exposure: [["toothpaste", 30, 6]] }
  ],

  // Should-cost at the base month, INR, by block. Material re-prices on its index, energy on EU gas.
  items: [
    { id: "palm", name: "Refined palm oil", unit: "tonne", supplier: "tidewater", paid: 124500, mat: "palm",
      blocks: { material: 104000, conversion: 6500, energy: 2200, freight: 3200, overhead: 3000, margin: 4000 } },
    { id: "sles", name: "SLES 70%, surfactant", unit: "tonne", supplier: "sarna", paid: 118000, mat: "palm",
      blocks: { material: 72000, conversion: 16000, energy: 6500, freight: 4500, overhead: 9000, margin: 9000 } },
    { id: "sugar", name: "Refined sugar", unit: "tonne", supplier: "halden", paid: 43800, mat: "sugar",
      blocks: { material: 36000, conversion: 2500, energy: 900, freight: 1500, overhead: 1200, margin: 1400 } },
    { id: "flour", name: "Wheat flour", unit: "tonne", supplier: "stonemill", paid: 31500, mat: "wheat",
      blocks: { material: 25500, conversion: 2200, energy: 800, freight: 1100, overhead: 900, margin: 1000 } },
    { id: "fragrance", name: "Fragrance compound, soap", unit: "kg", supplier: "aldane", paid: 2650, mat: "eurinr",
      blocks: { material: 1700, conversion: 300, energy: 40, freight: 90, overhead: 260, margin: 230 } },
    { id: "toothpaste", name: "Toothpaste tube, 100 g", unit: "1,000", supplier: "laminex", paid: 4180, mat: "plastics-eu",
      blocks: { material: 1650, conversion: 1050, energy: 260, freight: 170, overhead: 420, margin: 380 },
      alt: { kestrel: { paid: 4030, conversion: 1000, freight: 190 } } },
    { id: "shipper", name: "Shipper carton, 5-ply", unit: "1,000", supplier: "boxwell", paid: 38500, mat: "paper-eu",
      blocks: { material: 21000, conversion: 7500, energy: 2400, freight: 2200, overhead: 2600, margin: 2300 } }
  ],

  wire: [
    { id: "fire", when: "Mon 16 Nov 08:10", sev: "high", kind: "Plants",
      title: "Fire at Laminex Tubes, Silvassa, line 3",
      body: "No injuries reported. Line 3 is stopped; Laminex expects two to three weeks before restart. Line 3 makes Brightwater's 100 g toothpaste tube.",
      links: [["supplier", "laminex", "Laminex exposure"], ["item", "toothpaste", "Toothpaste tube"]] },
    { id: "sugar", when: "Mon 16 Nov 07:00", sev: "med", kind: "Markets", computed: "sugar",
      note: "Halden's price was set in May. Expect an ask at the December review; it will be checked against this index.",
      links: [["series", "sugar", "Sugar"], ["supplier", "halden", "Halden Sugars"]] },
    { id: "brent", when: "Mon 16 Nov 07:00", sev: "med", kind: "Markets", computed: "brent",
      note: "Diesel-linked rates set in May should now come down.",
      links: [["series", "brent", "Brent"], ["screen", "watch", "Index watch"]] },
    { id: "gas", when: "Mon 16 Nov 07:00", sev: "low", kind: "Markets", computed: "gas-eu",
      note: "Energy blocks in every should-cost re-price on it.",
      links: [["series", "gas-eu", "EU natural gas"]] },
    { id: "cyclone", when: "Sun 15 Nov 18:30", sev: "med", kind: "Weather",
      title: "Cyclone watch off the Gujarat coast",
      body: "A depression in the Arabian Sea may bring heavy rain to the Kandla and Daman belt from Thursday. Truck movements could slow for two days.",
      links: [["supplier", "sarna", "Sarna, Kandla"], ["supplier", "kestrel", "Kestrel, Daman"]] },
    { id: "inspect", when: "Fri 13 Nov 16:00", sev: "low", kind: "Policy",
      title: "Pollution board inspections in the Kandla chemical cluster",
      body: "The state board is inspecting chemical units around Kandla this month. Sarna's slot is Thursday.",
      links: [["supplier", "sarna", "Sarna Oleochem"]] },
    { id: "wci", when: "Thu 12 Nov", sev: "low", kind: "Shipping", real: true,
      title: "Container rates fall 2% to $4,305 per 40ft",
      body: "Drewry's World Container Index fell 2% this week. Shanghai to Rotterdam fell 3% to $3,504; Shanghai to Genoa held at $4,168. Drewry expects rates to fall further next week.",
      src: ["Drewry WCI, 12 Nov 2026", "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry"],
      links: [["series", "wci", "Freight"]] },
    { id: "blank", when: "Thu 12 Nov", sev: "med", kind: "Shipping", real: true,
      title: "Eight blank sailings announced for next week",
      body: "Carriers are cutting capacity: eight blank sailings next week, up from five this week, and higher FAK rates and peak season surcharges on Asia to Europe and the Mediterranean from the second half of November.",
      src: ["Drewry WCI, 12 Nov 2026", "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry"],
      links: [["series", "wci", "Freight"]] },
    { id: "shanghai", when: "Thu 12 Nov", sev: "low", kind: "Shipping", real: true,
      title: "Shanghai port congestion up to 49 hours",
      body: "Congestion rose to 49 hours from 36 the week before, ending 11 weeks of easing.",
      src: ["Drewry WCI, 12 Nov 2026", "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry"],
      links: [] }
  ],

  mail: [
    { id: "sarna-price", from: "Farhan Sheikh, Sarna Oleochem", addr: "farhan.sheikh@sarna.example.com", when: "Wed 18 Nov 11:20",
      subj: "Revised SLES price from 1 December", item: "sles", supplier: "sarna", base: 118000, asked: 9.41, unit: "per tonne",
      greet: "Dear Farhan,", opener: "Thank you for your letter of 18 November.", sign: "Category Manager, Chemicals, Brightwater",
      attach: "claim-check-sarna-sles.xlsx",
      note: "Proxies: palm oil (IMF, real), EU organic basic chemicals PPI (Eurostat, real) and EU natural gas (IMF, real), May to latest. A client deployment uses the licensed grade feeds.",
      letter: [
        "Dear Brightwater team,",
        "Since our May price, input costs for surfactants have risen across the board. From 1 December SLES 70% moves from ₹1,18,000 to ₹1,29,100 per tonne, an increase of 9.4%.",
        "The drivers, by share of our price: <mark>palm feedstock up 9% (45% of price)</mark>, ethylene oxide and other chemicals up 6% (15%), energy up 25% (6%), freight up 12% (4%), labour up 6% (8%), and a 2% supply security surcharge given the current tightness in surfactants.",
        "We value the partnership and look forward to your confirmation.",
        "Farhan Sheikh, Key Accounts"
      ],
      claims: [
        { driver: "Palm feedstock", share: 45, claimed: 9, index: "palm", ix: "Palm oil prices" },
        { driver: "Chemicals", share: 15, claimed: 6, index: "chem-eu", ix: "EU organic basic chemical prices" },
        { driver: "Energy", share: 6, claimed: 25, index: "gas-eu", ix: "Gas prices" },
        { driver: "Freight", share: 4, claimed: 12, index: null, why: "No May baseline for this lane in the free feed. Counted at zero until Sarna's lane invoices arrive." },
        { driver: "Labour", share: 8, claimed: 6, index: null, accept: true, why: "Within the wage settlement range on file. Accepted as claimed." },
        { driver: "Supply security surcharge", share: 100, claimed: 2, index: null, reject: true, why: "Not a cost. A surcharge for a tight market is a margin ask." }
      ] },
    { id: "kestrel-cap", from: "Ravi Menon, Kestrel Packaging", addr: "ravi.menon@kestrel.example.com", when: "Mon 16 Nov 13:05",
      subj: "Re: Extra tube capacity",
      letter: ["Confirmed: we can take 2.4 million toothpaste tubes a month from Monday 23 November at the current price list.", "Ravi"] },
    { id: "laminex-fm", from: "Anita Desai, Laminex Tubes", addr: "anita.desai@laminex.example.com", when: "Mon 16 Nov 09:40",
      subj: "Line 3 incident: force majeure notice",
      letter: ["Dear Brightwater team,", "Following the fire on line 3 this morning we are giving notice of force majeure on tubes from line 3. We expect to restart in two to three weeks and will update you daily.", "Anita Desai, Customer Service"] },
    { id: "halden-review", from: "Meera Patil, Halden Sugars", addr: "meera.patil@halden.example.com", when: "Tue 17 Nov 10:30",
      subj: "December price review: meeting request",
      letter: ["Dear Brightwater team,", "Ahead of the December review we would like to meet in the first week of the month to discuss the sugar price.", "Meera Patil, Sales"] }
  ],

  // Index watch: spend in INR crore a year, share = the part of the price linked to the index
  watch: {
    down: [
      { name: "Road distribution, fuel component", supplier: "harbourline", spend: 42, share: 35, index: "brent" },
      { name: "Fragrance compounds, euro list", supplier: "aldane", spend: 36, share: 70, index: "eurinr" },
      { name: "Toothpaste tube, polymer", supplier: "kestrel", spend: 18, share: 40, index: "plastics-eu" },
      { name: "SLES, chemicals block", supplier: "sarna", spend: 55, share: 15, index: "chem-eu" }
    ],
    up: [
      { name: "Refined sugar", supplier: "halden", spend: 40, share: 82, index: "sugar" },
      { name: "Wheat flour", supplier: "stonemill", spend: 30, share: 81, index: "wheat" },
      { name: "Shipper cartons, board", supplier: "boxwell", spend: 22, share: 55, index: "paper-eu" }
    ]
  },

  tour: [
    { when: "Monday 16 November, 07:30", screen: "markets", act: ["series", "sugar"], hl: "#chart",
      text: "The week opens on the indices behind everything Brightwater buys: ingredients, chemicals, packaging, energy, freight and currency. Sugar is up a fifth since May. Palm oil has barely moved." },
    { when: "Monday, 08:10", screen: "wire", act: ["flash", "fire"], hl: "#w-fire",
      text: "A fire at Laminex Tubes stops the line that makes the toothpaste tube. The terminal maps it at once to the supplier, the plant and the item." },
    { when: "Monday, 08:14", screen: "suppliers", act: ["supplier", "laminex"], hl: "#sup-detail",
      text: "Laminex makes 70% of the tube, with three and a half weeks of cover. Kestrel is already qualified and has spare capacity." },
    { when: "Monday, 09:00", screen: "cost", act: ["move", "toothpaste", "kestrel"], hl: "#sku-detail",
      text: "Move the tube to Kestrel. Re-priced on today's indices, Kestrel's quote sits close to should-cost. Supply covered before lunch." },
    { when: "Monday, 09:05", screen: "wire", act: ["filter", "Markets"], hl: "#w-sugar",
      text: "The wire reads the indices too. Sugar is up since Halden's May price, so the ask is flagged before it arrives." },
    { when: "Wednesday 18 November, 11:20", screen: "inbox", act: ["mail", "sarna-price"], hl: ".letter",
      text: "Sarna Oleochem asks for 9.4% more on SLES, \"since our May price\", with palm feedstock up 9%." },
    { when: "Wednesday, 11:21", screen: "inbox", act: ["mail", "sarna-price"], hl: "#claim-check",
      text: "The claim check reads each driver against its index since May. Palm is up far less than claimed. Chemicals are down. Energy is up more than claimed. The surcharge is not a cost." },
    { when: "Thursday 19 November, 10:00", screen: "inbox", act: ["mail", "sarna-price"], hl: "#draft",
      text: "The counter at {just} is drafted with the workings attached. Nothing reaches Sarna until a person approves it." },
    { when: "Friday 20 November, 09:00", screen: "watch", act: null, hl: "#watch-down",
      text: "Index watch turns it round: prices set in May whose index has fallen since. The diesel-linked part of road distribution alone is worth {brent} a year." },
    { when: "Friday, 09:10", screen: "watch", act: null, hl: "#tally",
      text: "The week: toothpaste supply covered, {held} a year held off on SLES, {recover} a year to recover. Every price, proven." }
  ]
};
