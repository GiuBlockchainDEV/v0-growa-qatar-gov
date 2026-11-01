/**
 * Qatar-specific named agricultural and food suppliers, reconstructed from
 * attributable farm, company and government publications, reviewed 2026-11-01.
 *
 * Farm claims and catalogues are product evidence, not audited supplier approvals.
 * In particular food/feed grains MUST remain explicitly distinguished, and
 * wholesalers/importers must NEVER be presented as Qatari crop growers.
 *
 * Public national farm counts are aggregate statistics, not a named registry.
 */
import type {ExtraCropListing} from './crop-producer-associations'

export type CropSupplierRole='farm_claim'|'farm_other'|'manufacturer'|'trader'
export type QatarEvidenceKind=
 'farm_own_crop_claim'|'government_or_institutional_crop_profile'|
 'agritourism_crop_listing'|'farm_product_catalogue'|'manufacturer_product_listing'|
 'trader_product_catalogue'|'historical_farm_crop_report'

type QatarSourceRow={
 id:string;name:string;role:CropSupplierRole;crops:readonly string[]
 url:string;source:string;evidence:string
}

const QATAR_SOURCE_ROWS:readonly QatarSourceRow[]=[
  {
    "id": "AGRICO",
    "name": "Agrico Agricultural Development",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://agrico.qa/agriculture_product_categories/vegetables/",
    "source": "Agrico – own vegetable product catalogue",
    "evidence": "Farm-operated hydroponic vegetable line, with tomato, cucumber and Capsicum listed."
  },
  {
    "id": "AGRICO-LEAF",
    "name": "Agrico Agricultural Development",
    "role": "farm_claim",
    "crops": [
      "lettuce"
    ],
    "url": "https://www.iloveqatar.net/guide/living/organic-vegetable-farms-and-markets-in-qatar",
    "source": "ILoveQatar farm profile (updated 2025)",
    "evidence": "Local agricultural profile explicitly names lettuce grown by Agrico."
  },
  {
    "id": "SAIC",
    "name": "Al-Sulaiteen Agricultural & Industrial Complex (SAIC)",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber",
      "pepper",
      "lettuce"
    ],
    "url": "https://saic.com.qa/?page_id=1809",
    "source": "SAIC – farm production statement",
    "evidence": "SAIC reports growing tomatoes, cucumbers, peppers and lettuce at its Qatar farm."
  },
  {
    "id": "INAYA",
    "name": "Al Inaya Food International WLL",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://inaya-intl.com/",
    "source": "Al Inaya – direct greenhouse production statement",
    "evidence": "The company states that its Al Khor greenhouses cultivate cucumber, tomato and bell pepper."
  },
  {
    "id": "QADCO",
    "name": "Qatarat Agricultural Development Company (QADCO)",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber",
      "pepper",
      "lettuce"
    ],
    "url": "https://www.qadco.com.qa/qadco-farms/?product-page=2",
    "source": "QADCO – farm produce catalogue",
    "evidence": "QADCO farm catalogue lists tomato, cucumber, bell peppers and multiple lettuce types; listing does not certify all originate at a single farm."
  },
  {
    "id": "ALRAYYAN",
    "name": "Al Rayyan Agricultural",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber",
      "pepper",
      "lettuce"
    ],
    "url": "https://alrayyanagri.com/vegetables-2/",
    "source": "Al Rayyan Agricultural – vegetables catalogue",
    "evidence": "Company-published farm/vegetables catalogue explicitly lists tomato, cucumber, capsicum and lettuces."
  },
  {
    "id": "ALRAYYAN-DATES",
    "name": "Al Rayyan Agricultural",
    "role": "farm_claim",
    "crops": [
      "date"
    ],
    "url": "https://alrayyanagri.com/products/",
    "source": "Al Rayyan Agricultural – dates farming and packing",
    "evidence": "Company says its palm farms supply dates and describes a local dates packing factory."
  },
  {
    "id": "NORTHSEDRA",
    "name": "North Sedra Farm",
    "role": "farm_other",
    "crops": [
      "tomato",
      "cucumber",
      "pepper",
      "lettuce"
    ],
    "url": "https://visitqatar.com/intl-en/things-to-do/family-break/north-sedra-farm",
    "source": "Visit Qatar – seasonal farm crop list",
    "evidence": "Tourism profile lists season-specific tomato, cucumber, bell pepper and lettuce growing; wholesale availability not documented."
  },
  {
    "id": "QATFA",
    "name": "Arab Qatari Agricultural Production Company (QATFA)",
    "role": "farm_claim",
    "crops": [
      "cucumber"
    ],
    "url": "https://www.aaaid.org/en/companies/arab-qatari-agricultural-production-company/",
    "source": "Arab Authority for Agricultural Investment and Development – company profile",
    "evidence": "Shareholder institutional profile identifies cucumbers as a company crop and describes the production facilities."
  },
  {
    "id": "JERRY",
    "name": "Jerry Smeih Farm (Jamco Trading & Contracting)",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber"
    ],
    "url": "https://www.qdb.qa/-/media/qdbapp/publications-pdf/agriculture_sector_qatar_2022_en.pdf",
    "source": "Qatar Development Bank – Agriculture Sector Report 2022, p. 60",
    "evidence": "Historical QDB sector report identifies hydroponic tomato and cucumber production; current activity not reverified."
  },
  {
    "id": "NABATI",
    "name": "Nabati Greenhouse Projects (Global Advisory)",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://www.qdb.qa/-/media/qdbapp/publications-pdf/agriculture_sector_qatar_2022_en.pdf",
    "source": "Qatar Development Bank – Agriculture Sector Report 2022, p. 60",
    "evidence": "Historical QDB profile names tomatoes, cucumbers and sweet peppers among the brand’s farm products."
  },
  {
    "id": "BSFT",
    "name": "Farm Fresh (BSFT)",
    "role": "farm_claim",
    "crops": [
      "tomato",
      "pepper"
    ],
    "url": "https://bsft.qa/farm-fresh/",
    "source": "BSFT Farm Fresh – greenhouse produce catalogue",
    "evidence": "The site describes Qatar-grown greenhouse cherry tomatoes and fresh snack peppers."
  },
  {
    "id": "ALWAHA",
    "name": "Al Waha Farm",
    "role": "farm_claim",
    "crops": [
      "lettuce",
      "date"
    ],
    "url": "https://alwaha.qa/",
    "source": "Al Waha Farm – direct product statements",
    "evidence": "Farm website names romaine/baby-gem lettuces and premium dates in its produce categories."
  },
  {
    "id": "AJAJ",
    "name": "Ajaj Agro Farms",
    "role": "farm_claim",
    "crops": [
      "date"
    ],
    "url": "https://www.ajaj-group.com/ajaj-group-of-companies/ajaj-agro-farms/",
    "source": "Ajaj Group – own farm profile",
    "evidence": "Company profile states its farm has over 5,000 date palms; dates availability requires checking."
  },
  {
    "id": "HEENAT",
    "name": "Heenat Salma Farm",
    "role": "farm_other",
    "crops": [
      "date"
    ],
    "url": "https://heenatsalma.earth/agriculture/",
    "source": "Heenat Salma Farm – own agricultural profile",
    "evidence": "Farm documents date-palm cultivation; procurement volume or B2B supply is not established."
  },
  {
    "id": "MAZZRATY-DATE",
    "name": "Mazzraty (Al Mana Holding)",
    "role": "farm_claim",
    "crops": [
      "date"
    ],
    "url": "https://www.almanaholding.com.qa/project/mazzraty/",
    "source": "Al Mana Holding – Mazzraty operation profile",
    "evidence": "Parent-company profile lists dates among its Qatar farm and food operations; farm-to-market origin not verified."
  },
  {
    "id": "BALADNA",
    "name": "Baladna Food Industries",
    "role": "manufacturer",
    "crops": [
      "milk"
    ],
    "url": "https://baladna.com/corporate",
    "source": "Baladna – official company and dairy production profile",
    "evidence": "Company confirms local dairy operations, fresh milk and associated processing."
  },
  {
    "id": "MAZZRATY",
    "name": "Mazzraty (Al Mana Holding)",
    "role": "manufacturer",
    "crops": [
      "milk"
    ],
    "url": "https://www.mazzratyhomedelivery.com/product_list?category=1",
    "source": "Mazzraty – official dairy product catalogue",
    "evidence": "Mazzraty catalogue lists fresh cow milk and dairy products in Qatar."
  },
  {
    "id": "GHadeer",
    "name": "Arab Qatari Company for Dairy Production (Ghadeer)",
    "role": "manufacturer",
    "crops": [
      "milk"
    ],
    "url": "https://www.moci.gov.qa/wp-content/uploads/2021/09/Food-Beverage-Industry.pdf",
    "source": "Qatar Ministry of Commerce and Industry – Food & Beverage Directory (2021)",
    "evidence": "Ministry factory directory lists milk and dairy products for this Qatar manufacturer; historic record."
  },
  {
    "id": "DANDY",
    "name": "Dandy Company Ltd.",
    "role": "manufacturer",
    "crops": [
      "milk"
    ],
    "url": "https://www.moci.gov.qa/wp-content/uploads/2021/09/Food-Beverage-Industry.pdf",
    "source": "Qatar Ministry of Commerce and Industry – Food & Beverage Directory (2021)",
    "evidence": "Ministry factory directory lists milk and dairy products for Dandy; historic record."
  },
  {
    "id": "WAJBA",
    "name": "Al Wajbah Dairy and Juice Factory",
    "role": "manufacturer",
    "crops": [
      "milk"
    ],
    "url": "https://www.moci.gov.qa/wp-content/uploads/2021/09/Food-Beverage-Industry.pdf",
    "source": "Qatar Ministry of Commerce and Industry – Food & Beverage Directory (2021)",
    "evidence": "Ministry factory directory reports milk, cream and dairy products; historic record."
  },
  {
    "id": "RAWA",
    "name": "Gulf Food Production (Raw’a)",
    "role": "manufacturer",
    "crops": [
      "milk"
    ],
    "url": "https://www.moci.gov.qa/wp-content/uploads/2021/09/Food-Beverage-Industry.pdf",
    "source": "Qatar Ministry of Commerce and Industry – Food & Beverage Directory (2021)",
    "evidence": "Ministry factory directory reports milk and yoghurt under this manufacturer; historic record."
  },
  {
    "id": "FIRSTFRUIT",
    "name": "First Fruit Trading",
    "role": "trader",
    "crops": [
      "tomato",
      "cucumber",
      "pepper",
      "lettuce",
      "date",
      "rice"
    ],
    "url": "https://firstfruittrading.com/",
    "source": "First Fruit Trading – food products catalogue",
    "evidence": "Trader explicitly lists tomatoes, cucumbers, bell peppers, lettuce, dates and rice; no local cultivation is claimed."
  },
  {
    "id": "ALFA",
    "name": "ALFA Vegetables & Fruits Trading",
    "role": "trader",
    "crops": [
      "tomato",
      "cucumber",
      "pepper",
      "lettuce"
    ],
    "url": "https://alfavegco.com/",
    "source": "ALFA – wholesale produce catalogue",
    "evidence": "Qatar wholesaler lists salad tomatoes, cucumbers, lettuces and specialty peppers; sourcing may include imports."
  },
  {
    "id": "GREENPOINT",
    "name": "Green Point Trading W.L.L",
    "role": "trader",
    "crops": [
      "tomato",
      "pepper",
      "lettuce"
    ],
    "url": "https://www.greenpointqatar.com/products.php",
    "source": "Green Point – country-of-origin products catalogue",
    "evidence": "Qatar trader lists Iranian-origin tomato, capsicum and lettuce; not Qatari farm production."
  },
  {
    "id": "KASBAH",
    "name": "Kasbah Trading",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://kasbahtrading.com/",
    "source": "Kasbah – rice and grains wholesale products",
    "evidence": "Qatari trader lists basmati, jasmine and Sona Masoori rice; imports and distribution."
  },
  {
    "id": "ZAiKA",
    "name": "Zaika Food & Spices Trading WLL",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://www.zaika.qa/product-wholesale.php",
    "source": "Zaika – wholesale rice catalogue",
    "evidence": "Doha-based company publishes a rice wholesale product category."
  },
  {
    "id": "TF",
    "name": "TF Suncons",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://tfsuncons.com.qa/",
    "source": "TF Suncons – rice import and distribution",
    "evidence": "Qatar trader advertises multiple rice varieties, procurement and local distribution."
  },
  {
    "id": "CNB",
    "name": "CNB Trading",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://cnb.qa/",
    "source": "CNB Trading – wholesale rice packing",
    "evidence": "Qatar wholesale company explicitly lists rice packing and distribution."
  },
  {
    "id": "GLF",
    "name": "Greenland Foodstuff",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://greenlandfoodstuff.com/rice-supplier-qatar",
    "source": "Greenland Foodstuff – wholesale rice product catalogue",
    "evidence": "Qatar rice wholesaler states it stocks rice SKUs and ships from a Doha warehouse."
  },
  {
    "id": "SAT",
    "name": "Southern Associates Trading W.L.L.",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://satdoha.com/",
    "source": "Southern Associates Trading – rice import portfolio",
    "evidence": "The company says it imports and distributes rice varieties in Qatar."
  },
  {
    "id": "ROYAL",
    "name": "Royal Doha Trading WLL (Royal Food Center)",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://www.royaldohatrading.com/store.php",
    "source": "Royal Food Center – wholesale rice catalogue",
    "evidence": "Qatar wholesaler describes its rice and grain brands."
  },
  {
    "id": "TAQWA",
    "name": "Taqwa Food Stuff",
    "role": "trader",
    "crops": [
      "rice"
    ],
    "url": "https://www.taqwafoodstuff.com/",
    "source": "Taqwa Food Stuff – bulk rice portfolio",
    "evidence": "Qatar wholesaler lists bulk premium rice."
  },
  {
    "id": "ORRAJ",
    "name": "Orraj Trading and Services",
    "role": "trader",
    "crops": [
      "barley",
      "wheat"
    ],
    "url": "https://orraj.eu/orraj-website/en/home/index.html",
    "source": "Orraj Trading – feed commodity catalogue",
    "evidence": "Qatar-based feed trader lists feed barley and feed wheat; these are feed grades, NOT food-grade grain."
  },
  {
    "id": "AALAF",
    "name": "Aalaf Qatar Company (Hassad Food)",
    "role": "trader",
    "crops": [
      "barley"
    ],
    "url": "https://www.hassad.com/animal-feed/",
    "source": "Hassad Food – Aalaf livestock feed products",
    "evidence": "Aalaf lists crushed barley seeds supplied locally as feed, not food-grade or local barley cultivation."
  },
  {
    "id": "BAM",
    "name": "Bab Almshrq Trading Company",
    "role": "trader",
    "crops": [
      "wheat"
    ],
    "url": "https://www.bam.qa/",
    "source": "Bab Almshrq – wheat import portfolio",
    "evidence": "Qatar trader lists imported durum and soft wheat from overseas farms."
  },
  {
    "id": "KTM",
    "name": "Al Khalaf Trading & Marketing",
    "role": "trader",
    "crops": [
      "wheat"
    ],
    "url": "https://www.ktmqatar.com/ABOUT-US/",
    "source": "Al Khalaf – flour and grain distribution portfolio",
    "evidence": "Trading company lists wheat flour and grains, not unprocessed wheat supply; form/grade to confirm."
  }
]

const HISTORICAL_FARM_IDS=new Set(['JERRY','NABATI'])
const INSTITUTIONAL_FARM_IDS=new Set(['QATFA'])
const VISITOR_FARM_IDS=new Set(['NORTHSEDRA'])
const FARM_CATALOGUE_IDS=new Set(['QADCO','ALRAYYAN','ALRAYYAN-DATES','ALWAHA','AGRICO-LEAF','MAZZRATY-DATE'])

export const QATAR_NAMED_PROSPECTS:readonly (ExtraCropListing & {
 supplierRole:CropSupplierRole;evidenceSummary:string
})[]=QATAR_SOURCE_ROWS.flatMap(row=>row.crops.map(crop=>({
 recordId:'QA-'+row.id+'-'+crop,
 organizationName:row.name,
 commodityId:crop,
 countryCode:'QA',
 countryName:'Qatar',
 matchedProduct:crop==='wheat'&&row.id==='KTM'?'Wheat flour / grains (NOT raw wheat verified)':
 crop==='wheat'&&row.id==='ORRAJ'?'Feed wheat (NOT food-grade)':
 crop==='barley'?'Feed barley (NOT food-grade)':crop,
 sourceName:row.source,
 sourceUrl:row.url,
 evidenceType:(HISTORICAL_FARM_IDS.has(row.id)?'historical_farm_crop_report':
 INSTITUTIONAL_FARM_IDS.has(row.id)?'government_or_institutional_crop_profile':
 VISITOR_FARM_IDS.has(row.id)?'agritourism_crop_listing':
 FARM_CATALOGUE_IDS.has(row.id)?'farm_product_catalogue':
 row.role==='manufacturer'?'manufacturer_product_listing':
 row.role==='trader'?'trader_product_catalogue':'farm_own_crop_claim') as QatarEvidenceKind,
 supplierRole:row.role,
 evidenceSummary:row.evidence,
})))
