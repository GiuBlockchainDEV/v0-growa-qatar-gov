/**
 * Multi-country, product-specific operator evidence from first-party corporate
 * farm pages and dated producer reports checked 2026-11-01. A group presence
 * in multiple countries is a location-specific LEAD, not a different legal
 * counterparty; current commercial supply and Qatar import eligibility
 * are unverified. Does not contain artificial companies or quotas per country.
 */
import {countryName} from './world-countries'
import type {ExtraCropListing} from './crop-producer-associations'

type NamedCropOperator={
  country:string;name:string;crops:readonly string[];url:string
  role:'farm_claim'|'farm_other'|'manufacturer';label:string
}
const OPERATORS:readonly NamedCropOperator[]=[
  {
    "country": "NL",
    "name": "Agro Care Growers",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care country-specific tomato greenhouse production sites"
  },
  {
    "country": "FR",
    "name": "Agro Care Growers (France operations)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care France tomato greenhouse operations"
  },
  {
    "country": "MA",
    "name": "Agro Care Growers (Morocco operations)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care Agadir tomato greenhouse operations"
  },
  {
    "country": "TN",
    "name": "Agro Care Growers (Tunisia operations)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care Tunisian tomato greenhouse operations"
  },
  {
    "country": "BR",
    "name": "Agro Care Growers (Brazil operations)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care Andradas tomato greenhouse operations"
  },
  {
    "country": "DK",
    "name": "Agro Care Growers (Denmark operations)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care Odense tomato greenhouse operations"
  },
  {
    "country": "SE",
    "name": "Agro Care Growers (Sweden operations)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/nl/wie-wij-zijn",
    "role": "farm_claim",
    "label": "Agro Care Trelleborg tomato greenhouse operations"
  },
  {
    "country": "NL",
    "name": "Growers United cooperative",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://growersunited.nl/en/leden-en-teelt/",
    "role": "farm_claim",
    "label": "Cooperative of named Dutch greenhouse growers; member farms supply tomatoes, cucumbers, sweet peppers"
  },
  {
    "country": "NL",
    "name": "Green Diamonds (Growers United)",
    "crops": [
      "cucumber"
    ],
    "url": "https://growersunited.nl/en/onze-telers/",
    "role": "farm_claim",
    "label": "Dutch cooperative cucumber growers"
  },
  {
    "country": "NL",
    "name": "Prominent (Growers United)",
    "crops": [
      "tomato"
    ],
    "url": "https://growersunited.nl/en/onze-telers/",
    "role": "farm_claim",
    "label": "Dutch cooperative tomato grower group"
  },
  {
    "country": "NL",
    "name": "SweetPoint / PapriCo (Growers United)",
    "crops": [
      "pepper"
    ],
    "url": "https://growersunited.nl/en/onze-telers/",
    "role": "farm_claim",
    "label": "Dutch cooperative sweet pepper grower group"
  },
  {
    "country": "FR",
    "name": "Savéol cooperative",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://www.saveol.com/fr/nous-rejoindre/nos-metiers/cueilleur-de-fruits-et-legumes-chez-saveol.html",
    "role": "farm_claim",
    "label": "French greenhouse grower cooperative reports tomato, cucumber and mini-pepper cultivation"
  },
  {
    "country": "FR",
    "name": "Les Maraîchers de Normandie (Agro Care)",
    "crops": [
      "tomato"
    ],
    "url": "https://www.agrocare.nl/en/who-we-are/locations/france",
    "role": "farm_claim",
    "label": "Agro Care French tomato production operation in Normandy"
  },
  {
    "country": "ZA",
    "name": "ZZ2 Group",
    "crops": [
      "tomato",
      "date"
    ],
    "url": "https://www.zz2.co.za/ourstory/about-us",
    "role": "farm_claim",
    "label": "South African tomato and date producer; organization reports cultivation"
  },
  {
    "country": "AE",
    "name": "Pure Harvest Smart Farms",
    "crops": [
      "tomato"
    ],
    "url": "https://www.pureharvestfarms.com/our-farms",
    "role": "farm_claim",
    "label": "UAE Al Ain hydroponic greenhouse tomato production"
  },
  {
    "country": "SA",
    "name": "Almarai Company",
    "crops": [
      "milk"
    ],
    "url": "https://www.almarai.com/en/brands/almarai/liquid-dairy/",
    "role": "manufacturer",
    "label": "Saudi integrated dairy farm and fresh milk processor"
  },
  {
    "country": "VN",
    "name": "Loc Troi Group",
    "crops": [
      "rice"
    ],
    "url": "https://www.loctroi.vn/cau-chuyen-lich-su",
    "role": "farm_other",
    "label": "Vietnamese rice production chain integrator working with rice farmer households"
  },
  {
    "country": "US",
    "name": "Village Farms International (Texas operations)",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://villagefarmsfresh.com/wp-content/uploads/2014/08/Q2-2019-VFF-MDA-FINAL-002.pdf",
    "role": "farm_claim",
    "label": "Historical corporate report cites own/contracted US Texas greenhouse tomato, pepper and cucumber production"
  },
  {
    "country": "CA",
    "name": "Village Farms International (British Columbia operations)",
    "crops": [
      "tomato",
      "cucumber",
      "pepper"
    ],
    "url": "https://villagefarmsfresh.com/wp-content/uploads/2014/08/Q2-2019-VFF-MDA-FINAL-002.pdf",
    "role": "farm_claim",
    "label": "Historical corporate report cites own/contracted Canadian BC greenhouse tomato, pepper and cucumber production"
  }
]

export const WORLD_DOCUMENTED_OPERATORS:readonly ExtraCropListing[]=OPERATORS.flatMap(
  (operator,index)=>operator.crops.map(crop=>({
    recordId:'GLOBAL-'+String(index+1)+'-'+crop,
    organizationName:operator.name,commodityId:crop,
    countryCode:operator.country,countryName:countryName(operator.country),
    matchedProduct:crop+' (company-reported product/location)',
    sourceName:'Operator-published crop and farming evidence',
    sourceUrl:operator.url,
    evidenceType:'farm_own_crop_claim' as const,
    supplierRole:operator.role,
    evidenceSummary:operator.label+'; supplier qualification, capacity and current stock not verified.',
  })),
)
