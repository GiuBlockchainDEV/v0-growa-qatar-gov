/**
 * Published crop and food sector leads, checked 2026-11-01. Sources are
 * attributed per entry and DO NOT prove own-farm cultivation, current
 * certification, export permission, food safety, stocks or Qatar eligibility.
 * Association and price-list members are historical, NOT live API results.
 */
export type CropSourceEvidenceType =
  'crop_sector_association_member'|'national_dates_mark_holder'|
  'company_product_document'|'public_milk_price_listing'|
  'independent_commodity_listing'|'historical_crop_marketer'| 
  'farm_own_crop_claim'|'government_or_institutional_crop_profile'|
  'agritourism_crop_listing'|'farm_product_catalogue'|'manufacturer_product_listing'|
  'trader_product_catalogue'|'historical_farm_crop_report'|'community_mapped_crop_tag'|'keyword_business_listing'|'mapped_agricultural_business'

export interface ExtraCropListing {
  recordId:string
  organizationName:string
  commodityId:string
  countryCode:string
  countryName:string
  matchedProduct:string
  sourceName:string
  sourceUrl:string
  evidenceType:CropSourceEvidenceType
  supplierRole?:'farm_claim'|'farm_other'|'manufacturer'|'trader'
  evidenceSummary?:string
}

const INDIA_RICE=[
  "Amar Singh Chawal Wala",
  "Amir Chand Jagdish Kumar",
  "Aroma Agrotech Pvt. Ltd.",
  "B. D. Overseas",
  "Bansal Finefood Pvt. Ltd.",
  "Bharat Cereals Pvt Ltd",
  "Bharat Industries Enterprises Pvt. Ltd.",
  "Chaman Lal Setia Exports Ltd.",
  "Dunar Foods Ltd.",
  "Ebro India Pvt. Ltd.",
  "Goel International Pvt. Ltd.",
  "Green Village Agros (P) Ltd",
  "GV God Vishnu Rice Exports Pvt. Ltd.",
  "K. S. Overseas Pvt Ltd",
  "KLA India Public Limited",
  "Kohinoor Foods Ltd.",
  "KRBL Ltd.",
  "Lama Rice Pvt. Ltd.",
  "Lekh Raj Narinder Kumar",
  "LT Foods",
  "Muskan Overseas",
  "Puran Chand Rice Mills",
  "Shiv Shakti Inter Globe Exports Pvt. Ltd.",
  "Shree Jagdamba Agrico Exports Pvt. Ltd.",
  "Shri Ganesh Agro Foods",
  "Supple Tek Industies Pvt. Ltd.",
  "Veer Overseas Ltd.",
  "Veetee Fine Foods Limited",
  "Vinod Rice Mill Pvt. Ltd.",
  "DRRK Foods Pvt. Ltd.",
  "Janki Dass Rice Mills",
  "Fortune Rice Limited",
  "D.D. International Pvt. Ltd.",
  "Adani Wilmar Ltd.",
  "Bhagwati Lacto Veg Exports Pvt. Ltd.",
  "Aakash Agro Tech. Pvt. Ltd.",
  "Star Rice Land Pvt. Ltd. (Sunstar Overseas Limited)",
  "K S Agro Export Pvt Ltd. (KS Agro Impex Pvt Ltd)",
  "Shri Ram Rice Unit",
  "Sarveshwar Foods Ltd.",
  "GRM Overseas Ltd"
] as const
const THAI_RICE:Record<number,readonly string[]>={
  "1": [
    "Aden International Co.,Ltd.",
    "Ake Rice Mill Co.,Ltd.",
    "Asia Golden Rice Co.,Ltd.",
    "Asia Grains Syndicate Co.,Ltd.",
    "Asia Intertrade Rice Export Co.,Ltd.",
    "Asia Tropical Trading Co.,Ltd.",
    "Asian Peninsula Corporation Co.,Ltd.",
    "Aurora Rice Co.,Ltd.",
    "B.B. Comex Co.,Ltd.",
    "BSCM Foods Co.,Ltd.",
    "Bangkok Rice Co.,Ltd.",
    "Bangkok Syndicate Co.,Ltd.",
    "Bangsue Chia Meng Rice Mill Co., Ltd.",
    "Best Export Co.,Ltd.",
    "Big C Supercenter Public Company Limited",
    "Bliss Foods Co.,Ltd."
  ],
  "49": [
    "H.H.L Intertrade Co.,Ltd.",
    "Healthy Rice Co.,Ltd.",
    "Herba Bangkok Sociedad Limitada",
    "Hong Yiah Seng Co.,Ltd.",
    "Huay Chuan Rice Co.,Ltd.",
    "International Rice & Products Co.,Ltd.",
    "J.P.Rice International (1998) Co.,Ltd.",
    "KJ Green Co.,Ltd.",
    "Kamolkij Co.,Ltd.",
    "Kasisuri Co.,Ltd.",
    "Kanekawa Enterprise Co.,Ltd.",
    "Khao C.P. Co.,Ltd.",
    "Kittichai Golden Rice Co.,Ltd."
  ],
  "64": [
    "Laikanok Rice Co.,Ltd.",
    "Lucky Thai An Co.,Ltd.",
    "MT Centertrade Co.,Ltd.",
    "Medifoods (Thailand) Co.,Ltd.",
    "Mengtai Rice Co.,Ltd.",
    "Mitrsuphan Rice Co.,Ltd."
  ],
  "79": [
    "PC Provider Co.,ltd.",
    "P&S Siam Foods Ltd.",
    "PRG Corporation Plublic Co., Ltd",
    "Pelegrina Rice Co.,Ltd.",
    "Por Nattaphon Rice Exporter Co.,Ltd."
  ],
  "111": [
    "Siam Quality Rice Co.,Ltd.",
    "Siam Thanya Rice Trading Co.,Ltd.",
    "Siri Intergroup (Thailand) Co., Ltd.",
    "Sirimongkol Rice Co.,Ltd. (SRC Foods Co.,Ltd.)",
    "Sotorn Intertrade Co.,Ltd."
  ],
  "127": [
    "Thanya Rice (Thailand) Co.,Ltd.",
    "Thai Capital Crops Co.,Ltd.",
    "Thai Good Products & Marketing Co.,Ltd.",
    "Thai Granlux International Rice Co.,Ltd.",
    "Thai Ha Public Co.,Ltd."
  ]
}
const SAUDI_DATES:readonly (readonly [string,string])[]=[
  [
    "260078",
    "Mazare Company Agricultural Products Ltd"
  ],
  [
    "260079",
    "Al Durra Al Tayyiba Trading Establishment"
  ],
  [
    "250053",
    "Aliat Taibah Factory For Dates"
  ],
  [
    "250048",
    "Gheras Alkhairat"
  ],
  [
    "260073",
    "Jawhara altumur for trading"
  ],
  [
    "260059",
    "Mohamed Alrajhi Endowments Factory"
  ],
  [
    "260072",
    "Company tanmiya mahasil alahsa"
  ],
  [
    "250011",
    "Riyadh Dates Factory Company for Industry"
  ],
  [
    "250047",
    "Company HOUR ABR ALBAHAR For Trading (One Partner)"
  ],
  [
    "250043",
    "Nakheel Alya Date Company"
  ],
  [
    "250041",
    "Sanyeh Trading Company"
  ],
  [
    "250051",
    "QUTUF ALMADINA DATES FACTORY"
  ]
]
const MILK_COOPERATIVES=[
  "Amulfed Dairy Ghandhinagar, a unit of GCMMF",
  "Baroda District Cooperative Milk Producer’s Union Ltd",
  "The Ambala District Cooperative Milk Producers Union Ltd",
  "The Ballabhgarh District Cooperative Milk Producers Union Ltd",
  "The Rohtak District Cooperative Milk Producers Union Ltd",
  "The Sirsa District Cooperative Milk Producers Union Ltd",
  "Uttari Rajasthan Dugdh Utpadak Sahakari Sangh Maryadit (Bikaner)",
  "Sikkim Co-operative Milk Producer’s Union Ltd.",
  "The Tamilnadu Cooperative Milk Producers’ Federation Limited",
  "The Thanjavur District Cooperative Milk Producers’ Union Limited",
  "Tirunelveli Cooperative Milk Producers Union Limited",
  "Trichirappalli District Cooperative Milk Producers’ Union Limited",
  "Telangana Dairy Development Cooperative Federation Limited",
  "Gomati Cooperative Milk Producers' Union Ltd"
] as const
const AUSTRALIA_GRAIN=[
  "Cargill Australia",
  "Louis Dreyfus",
  "Plum Grove",
  "Emerald Grain",
  "AWB (Agrium / Nutrien)"
] as const
const AIREA='https://airea.net/wp-content/uploads/2025/05/Governing-Body-Members-2025.pdf'
const DATES='https://ncpd.gov.sa/en/badge-holders'
const MILK='https://www.ncdfi.coop/index.php/civil-consumer-prices/'
const GRAIN='https://grain.net.au/traders-brokers/'
const UNICA='https://www.unicagroup.es/certificados/Unicagroup/ECOLOGICO/ECO%20UNICA%20GROUP%20Vig%2011-2026.pdf'
const VICASOL='https://vicasol.es/wp-content/uploads/2026/03/ES-ECO-003-AN.724-0012847.2025.001.pdf'


/**
 * Specific CROP-by-company marketing records from the COEXPHAL 2021/22 annual
 * report (pages 43, 47, 51, 71). Historical evidence of a marketed crop,
 * not of present-day farm ownership, exports, stock or qualification.
 */
const COEXPHAL_2022:Record<'tomato'|'cucumber'|'pepper'|'lettuce',readonly string[]>={
  "tomato": [
    "Acrena, S.A.T.",
    "Costa de Níjar, S.A.T.",
    "Las Hortichuelas, S.A.T.",
    "Agroaguadulce, S.L.",
    "Costa Dulce, S.A.T.",
    "Murgiverde, S.C.A.",
    "Agrocultivos Valle de Arthal, S.L.",
    "Dunamar, S.A.T.",
    "Naturalia Fresh, S.A.T.",
    "AgroIris, S.A.T.",
    "Duniagro, S.A.T.",
    "Nature Choice, S.A.T.",
    "Agrosol Export, S.L.",
    "Ecoinver Export, S.L.",
    "Níjar Sol, S.A.T.",
    "Almerifresh, S.A.T.",
    "Grupo Agroponiente",
    "Toledano Hortícola, S.L.",
    "Balcón de Níjar, S.L.",
    "Hortalizas Indasur, S.L.",
    "Unica Group, S.C.A.",
    "Bio-Sabor, S.A.T.",
    "Hortamar, S.C.A.",
    "Vega Cañada, S.A.",
    "Biosol Portocarrero, S.A.T.",
    "Import Export Fruva, S.L.",
    "Vicasol, S.C.A.",
    "Casi, S.C.A.",
    "Indasol, S.A.T.",
    "Zoi Agrícola, S.L.",
    "Coprohníjar, S.C.A.",
    "Inver, S.A.T."
  ],
  "cucumber": [
    "Acrena, S.A.T.",
    "Costa Ejido, S.A.T.",
    "José y Paco, S.L.",
    "Agroaguadulce, S.L.",
    "Dunamar, S.A.T.",
    "Las Hortichuelas, S.A.T.",
    "AgroIris, S.A.T.",
    "Ecoinver Export, S.L.",
    "Murgiverde, S.C.A.",
    "Agrosol Export, S.L.",
    "Ejidomar, S.C.A.",
    "Naturalia Fresh, S.A.T.",
    "Almerifresh, S.A.T.",
    "Frutas Escobi, S.L.",
    "Nature Choice, S.A.T.",
    "Bio-Sabor, S.A.T.",
    "Grupo Agroponiente",
    "Toledano Hortícola, S.L.",
    "Biosol Portocarrero, S.A.T.",
    "Hortamar, S.C.A.",
    "Unica Group, S.C.A.",
    "Casi, S.C.A.",
    "Hortofrutícola Mabe, S.A.T.",
    "Vega Cañada, S.A.",
    "Coprohníjar, S.C.A.",
    "Import Export Fruva, S.L.",
    "Vicasol, S.C.A.",
    "Costa de Níjar, S.A.T.",
    "Indasol, S.A.T.",
    "Zoi Agrícola, S.L.",
    "Costa Dulce, S.A.T.",
    "Inver, S.A.T."
  ],
  "pepper": [
    "Acrena, S.A.T.",
    "Costa Ejido, S.A.T.",
    "José y Paco, S.L.",
    "Agroaguadulce, S.L.",
    "Dunamar, S.A.T.",
    "Las Hortichuelas, S.A.T.",
    "Agrocultivos Valle de Arthal, S.L.",
    "Ecoinver Export, S.L.",
    "Murgiverde, S.C.A.",
    "AgroIris, S.A.T.",
    "Ejidomar, S.C.A.",
    "Naturalia Fresh, S.A.T.",
    "Agrosol Export, S.L.",
    "Frutas Escobi, S.L.",
    "Nature Choice, S.A.T.",
    "Almerifresh, S.A.T.",
    "Grupo Agroponiente",
    "Toledano Hortícola, S.L.",
    "Balcón de Níjar, S.L.",
    "Hortalizas Indasur, S.L.",
    "Unica Group, S.C.A.",
    "Bio-Sabor, S.A.T.",
    "Hortamar, S.C.A.",
    "Vega Cañada, S.A.",
    "Biosol Portocarrero, S.A.T.",
    "Hortofrutícola Mabe, S.A.T.",
    "Vicasol, S.C.A.",
    "Casi, S.C.A.",
    "Import Export Fruva, S.L.",
    "Zoi Agrícola, S.L.",
    "Coprohníjar, S.C.A.",
    "Indasol, S.A.T.",
    "Costa Dulce, S.A.T.",
    "Inver, S.A.T."
  ],
  "lettuce": [
    "Agrícola Navarro de Haro, S.L.",
    "Agrupapulpí, S.A.",
    "Grupo Agroponiente",
    "Primaflor, S.A.T.",
    "Tomasol, S.A.T.",
    "Unica Group, S.C.A.",
    "Zoi Agrícola, S.L."
  ]
}
const COEXPHAL_REPORT='https://www.coexphal.es/wp-content/uploads/2023/10/MEMORIA-COEXPHAL-2022.pdf'

export const ADDITIONAL_CROP_LISTINGS:readonly ExtraCropListing[]=[
  ...Object.entries(COEXPHAL_2022).flatMap(([commodity,names])=>
    names.map((name,index)=>({
      recordId:'COEX-2021-22-'+commodity+'-'+String(index+1),
      organizationName:name,commodityId:commodity,countryCode:'ES',countryName:'Spain',
      matchedProduct:commodity+' (marketed product, 2021/22 season)',
      sourceName:'COEXPHAL – annual report 2021/22 crop-specific marketers',
      sourceUrl:COEXPHAL_REPORT,evidenceType:'historical_crop_marketer' as const,
    }))),
  ...INDIA_RICE.map((name,index)=>({
    recordId:'AIREA-2024-25-'+String(index+1),
    organizationName:name,commodityId:'rice',countryCode:'IN',countryName:'India',
    matchedProduct:'Rice sector (association governing-body list 2024-25)',
    sourceName:'All India Rice Exporters Association – 2024-25 members',
    sourceUrl:AIREA,evidenceType:'crop_sector_association_member' as const,
  })),
  ...Object.entries(THAI_RICE).flatMap(([startingNumber,names])=>{
    const first=Number(startingNumber)
    const page=first===1?1:first===49?4:first===64?5:first===79?6:first===111?8:9
    return names.map((name,index)=>({
      recordId:'TREA-'+String(first+index),
      organizationName:name,commodityId:'rice',countryCode:'TH',countryName:'Thailand',
      matchedProduct:'Rice sector (exporters association membership)',
      sourceName:'Thai Rice Exporters Association – member directory',
      sourceUrl:'https://www.thairiceexporters.or.th/member_'+page+'.htm',
      evidenceType:'crop_sector_association_member' as const,
    }))
  }),
  ...SAUDI_DATES.map(([mark,name])=>({
    recordId:'NCPD-MARK-'+mark,organizationName:name,
    commodityId:'date',countryCode:'SA',countryName:'Saudi Arabia',
    matchedProduct:'Dates sector – Saudi Dates Mark listed organization',
    sourceName:'Saudi National Center for Palms and Dates – mark holders',
    sourceUrl:DATES,evidenceType:'national_dates_mark_holder' as const,
  })),
  ...MILK_COOPERATIVES.map((name,index)=>({
    recordId:'NCDFI-MILK-'+String(index+1),organizationName:name,
    commodityId:'milk',countryCode:'IN',countryName:'India',
    matchedProduct:'Milk (listed in cooperative consumer price records)',
    sourceName:'National Cooperative Dairy Federation of India – price listings',
    sourceUrl:MILK,evidenceType:'public_milk_price_listing' as const,
  })),
  ...AUSTRALIA_GRAIN.flatMap((name,index)=>
    (['wheat','barley'] as const).map(commodity=>({
      recordId:'AUGRAIN-'+String(index+1)+'-'+commodity,organizationName:name,
      commodityId:commodity,countryCode:'AU',countryName:'Australia',
      matchedProduct:commodity==='wheat'?'Wheat (third-party commodity listing)':
        'Barley (third-party commodity listing)',
      sourceName:'Grain.net.au – independent traders commodity summary',
      sourceUrl:GRAIN,evidenceType:'independent_commodity_listing' as const,
    }))),
  ...([
    ['Unica Group S.C.A',UNICA],['Vicasol S.C.A',VICASOL],
  ] as const).flatMap(([name,url],index)=>
    (['tomato','cucumber','pepper'] as const).map(commodity=>({
      recordId:'ES-VEG-'+String(index+1)+'-'+commodity,
      organizationName:name,commodityId:commodity,
      countryCode:'ES',countryName:'Spain',
      matchedProduct:commodity==='tomato'?'Tomato':
        commodity==='cucumber'?'Cucumber (pepino)':'Bell pepper (pimiento)',
      sourceName:'Operator-published EU organic product certificate (dated evidence)',
      sourceUrl:url,evidenceType:'company_product_document' as const,
    }))),
]
