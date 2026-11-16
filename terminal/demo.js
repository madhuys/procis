/* Procis Terminal demo data.
   Brightwater, its suppliers, competitors and every event not marked real are fictional.
   Index series come from data/markets.json (real public data, fetched at build time).
   Prices per 1,000 packs in INR are illustrative. */
window.DEMO = {
  client: "Brightwater Consumer Goods",
  baseMonth: "2026-05-01", // the month suppliers' "May price" was set; should-cost re-prices from here

  // Real freight snapshot (Drewry World Container Index, 12 Nov 2026)
  freight: {
    id: "wci", name: "Container freight, world composite", unit: "USD per 40ft", group: "Freight",
    src: "Drewry World Container Index, 12 Nov 2026", url: "https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry",
    last: ["2026-11-12", 4305], wow: -2,
    lanes: [["World composite", 4305, "-2%"], ["Shanghai to Rotterdam", 3504, "-3%"], ["Shanghai to Genoa", 4168, "0%"]],
    note: "Drewry expects rates to fall further next week. A weekly snapshot, not a series: a client deployment takes the licensed weekly feed."
  },

  // Illustrative grade prices: shaped on a real index, scaled to a grade level. Labelled as such everywhere.
  illustrative: [
    { id: "hdpe-in", name: "HDPE blow-moulding grade, India", unit: "INR per kg", group: "Feedstocks", from: "plastics-eu", level: 112 },
    { id: "pet-asia", name: "PET bottle grade, Asia", unit: "USD per tonne", group: "Feedstocks", from: "plastics-eu", level: 1030 },
    { id: "duplex-in", name: "Duplex board, India", unit: "INR per tonne", group: "Feedstocks", from: "paper-eu", level: 52000 }
  ],
  tilesOrder: ["plastics-eu", "hdpe-in", "pet-asia", "pkg-plastic-eu", "resins-us", "paper-eu", "duplex-in", "board-us", "brent", "gas-eu", "wci", "eurinr", "usdinr"],

  suppliers: [
    { id: "laminex", name: "Laminex Tubes", makes: "Laminated tubes (ABL, PBL)", share: 24, plant: "Silvassa", status: ["bad", "Fire, line 3"],
      detail: "Two tube lines in Silvassa. Line 3 makes ABL toothpaste tubes and all PBL face wash tubes.",
      exposure: [["toothpaste", 70, 3.5], ["facewash", 100, 2]] },
    { id: "kestrel", name: "Kestrel Packaging", makes: "Tubes and HDPE bottles", share: 21, plant: "Daman", status: ["ok", "Spare tube capacity"],
      detail: "Qualified on ABL and PBL tubes since 2025. Has about 6 million tubes a month of spare capacity.",
      exposure: [["toothpaste", 30, 6], ["shampoo", 100, 5]] },
    { id: "polyvia", name: "Polyvia Packaging", makes: "PET bottles", share: 17, plant: "Vapi", status: ["ok", "Normal"],
      detail: "Single source for PET. Second source in qualification.", exposure: [["handwash", 100, 4]] },
    { id: "boxwell", name: "Boxwell Corrugators", makes: "Shipper cartons", share: 18, plant: "Pune", status: ["ok", "Normal"],
      detail: "Corrugated for all categories. Board indexed to paper prices each quarter.", exposure: [["shipper", 100, 3]] },
    { id: "tessa", name: "Tessa Brush Co.", makes: "Toothbrushes", share: 11, plant: "Hosur", status: ["ok", "Normal"],
      detail: "Moulded and tufted brushes.", exposure: [["toothbrush", 100, 8]] },
    { id: "corvel", name: "Corvel Closures", makes: "Caps and closures", share: 9, plant: "Baddi", status: ["mid", "Inspection Thu"],
      detail: "Flip-top and tethered caps. State board inspection booked for Thursday.", exposure: [["cap", 100, 5]] }
  ],

  // Should-cost per 1,000 packs (INR) at the base month, by block. Material and energy re-price on their index.
  packs: [
    { id: "toothpaste", name: "Toothpaste 100 g, ABL tube", supplier: "laminex", paid: 4180, mat: "plastics-eu",
      blocks: { material: 1650, conversion: 1050, energy: 260, freight: 170, overhead: 420, margin: 380 },
      alt: { kestrel: { paid: 4050, conversion: 1000, freight: 190 } } },
    { id: "facewash", name: "Face wash 50 g, PBL tube", supplier: "laminex", paid: 3240, mat: "plastics-eu",
      blocks: { material: 1180, conversion: 900, energy: 210, freight: 140, overhead: 330, margin: 300 },
      alt: { kestrel: { paid: 3150, conversion: 870, freight: 160 } } },
    { id: "shampoo", name: "Shampoo 340 ml, HDPE bottle", supplier: "kestrel", paid: 6900, mat: "plastics-eu",
      blocks: { material: 3300, conversion: 1450, energy: 520, freight: 380, overhead: 640, margin: 560 } },
    { id: "handwash", name: "Hand wash 200 ml, PET bottle", supplier: "polyvia", paid: 5400, mat: "plastics-eu",
      blocks: { material: 2600, conversion: 1100, energy: 400, freight: 300, overhead: 520, margin: 450 } },
    { id: "cap", name: "24 mm flip-top cap, PP", supplier: "corvel", paid: 1420, mat: "plastics-eu",
      blocks: { material: 560, conversion: 420, energy: 120, freight: 60, overhead: 120, margin: 100 } },
    { id: "shipper", name: "5-ply shipper carton", supplier: "boxwell", paid: 38500, mat: "paper-eu",
      blocks: { material: 21000, conversion: 7500, energy: 2400, freight: 2200, overhead: 2600, margin: 2300 } },
    { id: "toothbrush", name: "Toothbrush, PP handle", supplier: "tessa", paid: 7800, mat: "plastics-eu",
      blocks: { material: 2100, conversion: 3300, energy: 450, freight: 300, overhead: 900, margin: 650 } }
  ],

  wire: [
    { id: "fire", when: "Mon 16 Nov 08:10", sev: "high", kind: "Plants", demo: true,
      title: "Fire at Laminex Tubes, Silvassa, line 3",
      body: "No injuries reported. Line 3 is stopped; Laminex expects two to three weeks before restart. Line 3 makes ABL toothpaste tubes and all PBL face wash tubes.",
      links: [["supplier", "laminex", "Laminex exposure"], ["pack", "toothpaste", "Toothpaste tube"], ["pack", "facewash", "Face wash tube"]] },
    { id: "gas", when: "Mon 16 Nov 07:00", sev: "med", kind: "Markets", computed: "gas",
      title: "EU gas price up since May",
      body: "", links: [["series", "gas-eu", "EU natural gas"]] },
    { id: "resin", when: "Mon 16 Nov 07:00", sev: "low", kind: "Markets", computed: "resin",
      title: "EU primary plastics below its May level",
      body: "", links: [["series", "plastics-eu", "EU primary plastics"]] },
    { id: "cyclone", when: "Sun 15 Nov 18:30", sev: "med", kind: "Weather", demo: true,
      title: "Cyclone watch off the Gujarat coast",
      body: "A depression in the Arabian Sea may bring heavy rain to the Daman and Vapi belt from Thursday. Truck movements could slow for two days.",
      links: [["supplier", "kestrel", "Kestrel, Daman"], ["supplier", "polyvia", "Polyvia, Vapi"]] },
    { id: "baddi", when: "Fri 13 Nov 16:00", sev: "low", kind: "Policy", demo: true,
      title: "Pollution board inspections in the Baddi cluster",
      body: "The state board is inspecting moulding units in Baddi this month. Corvel's slot is Thursday.",
      links: [["supplier", "corvel", "Corvel Closures"]] },
    { id: "orrin", when: "Fri 13 Nov 10:00", sev: "low", kind: "Competitors", demo: true,
      title: "Orrin Home Care moves its toothpaste to an all-PE tube",
      body: "Orrin's relaunch drops the aluminium layer for a recyclable all-PE laminate, with a recyclable claim on pack.",
      links: [["screen", "rivals", "Competitors"], ["screen", "radar", "Radar"]] },
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
    { id: "kestrel-price", from: "Ravi Menon, Kestrel Packaging", addr: "ravi.menon@kestrel.example.com", when: "Wed 18 Nov 11:20",
      subj: "Revised tube prices from 1 December", pack: "toothpaste", supplier: "kestrel", base: 4050, asked: 8.4,
      letter: [
        "Dear Brightwater team,",
        "Thank you for the additional toothpaste tube volume this week. We can run it from Daman from Monday.",
        "Since our May price, our costs have risen sharply. From 1 December the 100 g ABL tube moves from ₹4,050 to ₹4,390 per 1,000, an increase of 8.4%.",
        "The drivers, by share of our price: <mark>polymer up 9% (34% of price)</mark>, energy up 30% (7%), freight up 15% (4%), labour up 6% (10%), and a 2% supply security surcharge given the current tightness in tubes.",
        "We value the partnership and look forward to your confirmation.",
        "Ravi Menon, Key Accounts"
      ],
      claims: [
        { driver: "Polymer", share: 34, claimed: 9, index: "plastics-eu" },
        { driver: "Energy", share: 7, claimed: 30, index: "gas-eu" },
        { driver: "Freight", share: 4, claimed: 15, index: null, why: "No May baseline for this lane in the free feed. Counted at zero until Kestrel's lane invoices arrive." },
        { driver: "Labour", share: 10, claimed: 6, index: null, accept: true, why: "Within the wage settlement range on file. Accepted as claimed." },
        { driver: "Supply security surcharge", share: 100, claimed: 2, index: null, reject: true, why: "Not a cost. A surcharge for a tight market is a margin ask." }
      ] },
    { id: "laminex-fm", from: "Anita Desai, Laminex Tubes", addr: "anita.desai@laminex.example.com", when: "Mon 16 Nov 09:40",
      subj: "Line 3 incident: force majeure notice",
      letter: ["Dear Brightwater team,", "Following the fire on line 3 this morning we are giving notice of force majeure on ABL and PBL tubes from line 3. We expect to restart in two to three weeks and will update you daily.", "Anita Desai, Customer Service"] },
    { id: "kestrel-cap", from: "Ravi Menon, Kestrel Packaging", addr: "ravi.menon@kestrel.example.com", when: "Mon 16 Nov 13:05",
      subj: "Re: Extra tube capacity",
      letter: ["Confirmed: we can take 2.4 million ABL tubes and 1.1 million PBL tubes a month from Monday 23 November at the current price list.", "Ravi"] },
    { id: "corvel-tether", from: "Imran Qureshi, Corvel Closures", addr: "imran.q@corvel.example.com", when: "Tue 17 Nov 15:15",
      subj: "Tethered cap quote, 24 mm",
      letter: ["As discussed, the tethered version of the 24 mm flip-top would be ₹1,540 per 1,000 against ₹1,420 today, with a new tool at ₹18 lakh.", "Imran"] }
  ],

  rivals: [
    { name: "Orrin Home Care", moves: [["13 Nov", "Toothpaste relaunch in an all-PE recyclable tube, aluminium layer dropped."], ["Oct", "Shampoo 340 ml cut to 320 ml at the same shelf price."]] },
    { name: "Vasant Naturals", moves: [["Nov", "Refill pouches for hand wash, 750 ml, in two cities."], ["Sep", "Glass to PET switch on its hair oil, 30% lighter."]] },
    { name: "Kairo", moves: [["Nov", "Digitally printed limited-edition tubes, 12 designs, short runs."]] },
    { name: "Maison Lys", moves: [["Oct", "Tethered caps across the premium range ahead of its export markets."]] },
    { name: "Seva Herbals", moves: [["Nov", "Mono-material PP toothbrush pack, card insert removed."], ["Aug", "Shipper carton down from 5-ply to 3-ply on light SKUs."]] }
  ],

  radar: [
    { area: "Laminated and plastic tubes", kind: "Innovation", name: "All-PE recyclable tube laminate", stage: "trial", effect: "+2 to +4% per tube today; removes aluminium exposure", note: "Orrin has moved. Kestrel can sample in four weeks. A trial on face wash first, where barrier needs are lower." },
    { area: "Laminate structures", kind: "Innovation", name: "Thinner barrier layers in ABL", stage: "watch", effect: "-3% material per tube", note: "Needs shelf-life tests on the toothpaste formula." },
    { area: "Bottles", kind: "Innovation", name: "Lightweighted HDPE shampoo bottle", stage: "adopt", effect: "-6% resin per bottle", note: "Kestrel tool change in the Q1 shutdown." },
    { area: "Bottles", kind: "Innovation", name: "Recycled PET in hand wash bottles", stage: "watch", effect: "Premium varies with food-grade rPET supply", note: "Track rPET grade prices before any commitment." },
    { area: "Caps and closures", kind: "Innovation", name: "Tethered caps", stage: "trial", effect: "+8% per cap and a new tool", note: "Corvel quote in the inbox. Needed for export lines first." },
    { area: "Corrugated", kind: "Innovation", name: "3-ply shippers for light SKUs", stage: "adopt", effect: "-12% board per shipper", note: "Drop tests passed on two SKUs." },
    { area: "Sustainable packaging", kind: "Innovation", name: "Refill pouches", stage: "watch", effect: "-40% pack material per litre", note: "A competitor is testing in two cities." },
    { area: "Mould design", kind: "Technology", name: "Higher-cavity cap moulds", stage: "trial", effect: "-5% conversion per cap", note: "Ask Corvel to cost a 48 to 64 cavity move." },
    { area: "Moulding machines", kind: "Technology", name: "All-electric injection presses", stage: "watch", effect: "-20 to -30% press energy", note: "Energy is the block rising fastest since May." },
    { area: "Filling lines", kind: "Technology", name: "Tube filler changeover in under 15 minutes", stage: "watch", effect: "More short runs without waste", note: "Pairs with digital tube printing." },
    { area: "End of line automation", kind: "Technology", name: "Robotic case packing", stage: "watch", effect: "Labour per shipper down", note: "Payback depends on line speed." },
    { area: "Printing on packaging", kind: "Technology", name: "Digital tube printing", stage: "trial", effect: "No plates; +1 to +3% per tube on short runs", note: "Kairo is using it for limited editions." }
  ],

  tour: [
    { when: "Monday 16 November, 07:30", screen: "markets", act: ["series", "plastics-eu"], hl: "#chart",
      text: "The week opens on the indices behind every pack. EU primary plastics peaked in May and has come down since. Energy has gone the other way." },
    { when: "Monday, 08:10", screen: "wire", act: ["flash", "fire"], hl: "#w-fire",
      text: "A fire at Laminex, line 3. The terminal maps it at once to the supplier, the plant and the two packs that line makes." },
    { when: "Monday, 08:14", screen: "suppliers", act: ["supplier", "laminex"], hl: "#sup-detail",
      text: "Laminex's exposure: 70% of the toothpaste tube and all of the face wash tube, with two to three and a half weeks of cover." },
    { when: "Monday, 09:00", screen: "cost", act: ["move", "toothpaste", "kestrel"], hl: "#sku-detail",
      text: "Move the toothpaste tube to Kestrel, which has spare capacity. Re-priced on today's indices, Kestrel's quote sits close to should-cost." },
    { when: "Monday, 09:05", screen: "wire", act: ["filter", "Shipping"], hl: "#wire",
      text: "Freight is easing: Drewry's index fell 2% last week and it expects more. Real items carry their source." },
    { when: "Wednesday 18 November, 11:20", screen: "inbox", act: ["mail", "kestrel-price"], hl: ".letter",
      text: "Two days later Kestrel asks for 8.4% more, \"since our May price\", with polymer up 9%." },
    { when: "Wednesday, 11:21", screen: "inbox", act: ["mail", "kestrel-price"], hl: "#claim-check",
      text: "The claim check reads each driver against its index since May. Polymer is down, not up. Energy is up more than claimed. The surcharge is not a cost." },
    { when: "Thursday 19 November, 10:00", screen: "inbox", act: ["mail", "kestrel-price"], hl: "#draft",
      text: "The counter-offer is drafted with the evidence attached. Nothing reaches Kestrel until a person approves it." },
    { when: "Thursday 19 November, 15:30", screen: "rivals", act: null, hl: "#r-0",
      text: "On the competitor screen: Orrin moved its toothpaste to an all-PE recyclable tube last week, with a recyclable claim on pack." },
    { when: "Friday 20 November, 09:00", screen: "radar", act: ["filter", "Innovation"], hl: "#rd-0",
      text: "The radar costs the same move for Brightwater: an all-PE tube trial, face wash first. The week, on one screen. Every price, proven." }
  ]
};
