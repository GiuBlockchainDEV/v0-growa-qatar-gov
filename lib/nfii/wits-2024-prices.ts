/**
 * Frozen, public 2024 Qatar import rows transcribed from World Bank WITS
 * UN Comtrade HS 1988/92 (H0) 2024 pages on 2026-11-01.
 *
 * Values are THOUSANDS OF USD; weights are KILOGRAMS, not supplier quotes.
 * Only table rows with positive value AND weight are represented; where a
 * few long-tail rows are omitted, the national "World" aggregate is kept
 * separately for an unbiased Qatar-wide historical average. Explicit source
 * commodity codes are stored (some are narrower than the NFII crop label).
 *
 * This snapshot is a provenance-labelled historical fallback ONLY when live
 * UN Comtrade gives no usable origins. Do not represent it as 2025/2026
 * prices, current availability, farm production or a live data feed.
 */
import type {YearObservation,PartnerObservation} from './origin-price-model'
import {countryName} from './world-countries'

type MoneyRow=readonly [countryCode:string,valueThousandsUsd:number,netWeightKg:number]
type PublishedWitsTable={
 hs:string;scope:string;world:readonly [valueThousandsUsd:number,netWeightKg:number]
 data?:readonly MoneyRow[]
 datasets?:readonly {hs:string;rows:readonly MoneyRow[]}[]
}
const WITS_BASE='https://wits.worldbank.org/trade/comtrade/en/country/QAT/year/2024/tradeflow/Imports/partner/ALL/product/'
const HISTORICAL_WITS_TABLES:Readonly<Record<string,PublishedWitsTable>>={
  "tomato": {
    "hs": "070200",
    "scope": "Fresh or chilled tomatoes (HS H0 070200)",
    "world": [
      19540.61,
      57356400
    ],
    "data": [
      [
        "IR",
        4797.92,
        35033000
      ],
      [
        "JO",
        3635.17,
        9076940
      ],
      [
        "MA",
        2621.13,
        746748
      ],
      [
        "OM",
        2257.19,
        3725140
      ],
      [
        "NL",
        1775.29,
        367342
      ],
      [
        "EG",
        1278.93,
        3854260
      ],
      [
        "SY",
        991.92,
        2817880
      ],
      [
        "ES",
        815.26,
        146335
      ],
      [
        "IN",
        351.69,
        444472
      ],
      [
        "MY",
        245.99,
        201120
      ],
      [
        "LB",
        215.19,
        52155
      ],
      [
        "AZ",
        128,
        94500
      ],
      [
        "SA",
        110.04,
        618600
      ],
      [
        "TN",
        102.41,
        29695
      ],
      [
        "TR",
        81.46,
        104743
      ],
      [
        "BE",
        81.31,
        17082
      ]
    ]
  },
  "cucumber": {
    "hs": "070700",
    "scope": "Fresh or chilled cucumbers and gherkins (HS H0 070700)",
    "world": [
      3638.15,
      10417700
    ],
    "data": [
      [
        "SA",
        1298.51,
        2355650
      ],
      [
        "IR",
        904.29,
        6310150
      ],
      [
        "JO",
        482.71,
        1069560
      ],
      [
        "IN",
        462.36,
        269827
      ],
      [
        "OM",
        138.72,
        294626
      ],
      [
        "NL",
        134.95,
        30796
      ],
      [
        "LB",
        115.79,
        28969
      ],
      [
        "ES",
        72.47,
        16641
      ],
      [
        "BD",
        13.43,
        9971
      ],
      [
        "EG",
        9.05,
        9500
      ],
      [
        "AF",
        5.88,
        22060
      ]
    ]
  },
  "pepper": {
    "hs": "070960",
    "scope": "Fresh Capsicum/Pimenta fruit, including peppers (HS H0 070960)",
    "world": [
      16185.18,
      19542500
    ],
    "data": [
      [
        "IN",
        5874.49,
        4985830
      ],
      [
        "JO",
        2499.64,
        5571310
      ],
      [
        "SA",
        1969.75,
        2650050
      ],
      [
        "NL",
        1374.89,
        227690
      ],
      [
        "OM",
        953.31,
        1127860
      ],
      [
        "ES",
        798.26,
        122736
      ],
      [
        "UG",
        582.93,
        160625
      ],
      [
        "IR",
        579.39,
        3942270
      ],
      [
        "TH",
        446.09,
        60591
      ],
      [
        "PK",
        426.64,
        251751
      ],
      [
        "EG",
        310.88,
        351295
      ],
      [
        "MA",
        146.6,
        21946
      ],
      [
        "KE",
        108.99,
        35989
      ],
      [
        "LB",
        89.86,
        21569
      ],
      [
        "BD",
        23.44,
        10969
      ]
    ]
  },
  "lettuce": {
    "hs": "070511 + 070519",
    "scope": "Head/cabbage and non-head lettuce (HS H0 070511 + 070519; excludes chicory)",
    "world": [
      11928.609999999999,
      21291760
    ],
    "datasets": [
      {
        "hs": "070511",
        "rows": [
          [
            "ES",
            2751.2,
            525388
          ],
          [
            "NL",
            2745.87,
            477043
          ],
          [
            "IR",
            1876.78,
            13897500
          ],
          [
            "OM",
            1387.37,
            2771150
          ],
          [
            "IT",
            1204.45,
            147668
          ],
          [
            "JO",
            322.11,
            646808
          ],
          [
            "SA",
            291.81,
            381961
          ],
          [
            "EG",
            180.94,
            430819
          ],
          [
            "IN",
            136.97,
            65784
          ],
          [
            "US",
            69.52,
            13187
          ],
          [
            "LB",
            57.15,
            16407
          ],
          [
            "KE",
            31.33,
            7523
          ],
          [
            "BE",
            9.78,
            1537
          ],
          [
            "FR",
            6.4,
            726
          ],
          [
            "TH",
            5.96,
            843
          ]
        ]
      },
      {
        "hs": "070519",
        "rows": [
          [
            "JO",
            592.55,
            1618500
          ],
          [
            "OM",
            115.74,
            217928
          ],
          [
            "IT",
            58.68,
            7223
          ],
          [
            "NL",
            38.65,
            5392
          ],
          [
            "EG",
            26.64,
            55900
          ],
          [
            "ES",
            18.7,
            2510
          ]
        ]
      }
    ]
  },
  "date": {
    "hs": "080410",
    "scope": "Fresh or dried dates (HS H0 080410)",
    "world": [
      32053.04,
      11729500
    ],
    "data": [
      [
        "SA",
        15135.09,
        6085330
      ],
      [
        "JO",
        9983.74,
        2998280
      ],
      [
        "PS",
        2491.85,
        339023
      ],
      [
        "AE",
        1585.01,
        397777
      ],
      [
        "TN",
        974.75,
        472785
      ],
      [
        "IQ",
        566.49,
        891027
      ],
      [
        "US",
        556.21,
        68481
      ],
      [
        "KW",
        190.14,
        60474
      ],
      [
        "OM",
        163.87,
        26036
      ],
      [
        "DZ",
        149.67,
        137450
      ],
      [
        "IR",
        87.04,
        159860
      ],
      [
        "EG",
        74.5,
        75966
      ],
      [
        "PE",
        55.15,
        5452
      ],
      [
        "NA",
        25.69,
        3430
      ],
      [
        "PK",
        13.86,
        8100
      ]
    ]
  },
  "barley": {
    "hs": "1003",
    "scope": "Barley (HS H0 1003; including feed use)",
    "world": [
      76299.42,
      271564000
    ],
    "data": [
      [
        "RU",
        30190.49,
        110304000
      ],
      [
        "DE",
        18808.3,
        69846200
      ],
      [
        "FR",
        13111.77,
        52499600
      ],
      [
        "RO",
        11061.85,
        28313800
      ],
      [
        "BG",
        3127,
        10600000
      ]
    ]
  },
  "milk": {
    "hs": "040110",
    "scope": "Milk/cream not concentrated, fat ≤1% (HS H0 040110; narrower than all milk)",
    "world": [
      818.82,
      449009
    ],
    "data": [
      [
        "KW",
        492.12,
        302190
      ],
      [
        "IT",
        176.72,
        88029
      ],
      [
        "SA",
        58.03,
        2700
      ],
      [
        "AE",
        52.97,
        36995
      ],
      [
        "BE",
        29.4,
        15480
      ],
      [
        "GB",
        9.58,
        3615
      ]
    ]
  },
  "rice": {
    "hs": "1006",
    "scope": "Rice, all types (HS H0 1006)",
    "world": [
      201724.27,
      214290000
    ],
    "data": [
      [
        "IN",
        174255.34,
        188952000
      ],
      [
        "VN",
        9777.02,
        11688800
      ],
      [
        "PK",
        8441.51,
        7095110
      ],
      [
        "AU",
        4796.49,
        3395330
      ],
      [
        "TH",
        1786.18,
        1837230
      ],
      [
        "US",
        1101.7,
        136482
      ],
      [
        "IT",
        364.65,
        185965
      ],
      [
        "LK",
        341.92,
        333910
      ],
      [
        "JP",
        187.7,
        52143
      ],
      [
        "AR",
        135.95,
        115035
      ],
      [
        "BD",
        87.68,
        89974
      ],
      [
        "CN",
        86.6,
        135200
      ],
      [
        "PH",
        80.58,
        56600
      ],
      [
        "ES",
        77.54,
        66146
      ],
      [
        "PT",
        67.01,
        50004
      ],
      [
        "LB",
        43.65,
        37344
      ],
      [
        "TR",
        37.13,
        16800
      ],
      [
        "IR",
        31.47,
        18309
      ],
      [
        "EG",
        24.15,
        27500
      ]
    ]
  },
  "wheat": {
    "hs": "1001",
    "scope": "Wheat and meslin (HS H0 1001)",
    "world": [
      32903.96,
      103340000
    ],
    "data": [
      [
        "RU",
        18831.74,
        62298000
      ],
      [
        "AU",
        7496.77,
        20970000
      ],
      [
        "RO",
        6441,
        19818500
      ],
      [
        "US",
        55.56,
        4715
      ],
      [
        "UA",
        27.03,
        129300
      ],
      [
        "OM",
        24.29,
        44000
      ],
      [
        "YE",
        20.05,
        75000
      ],
      [
        "MX",
        7.51,
        535
      ]
    ]
  }
}

export type Wits2024Snapshot={
  year:2024
  sourceName:'World Bank WITS / UN Comtrade published 2024'
  sourceUrls:string[]
  hsCode:string
  productScope:string
  worldImportValueUsd:number
  worldImportWeightKg:number
  observation:YearObservation
}
/** Source-verified published annual customs partner tables; NO simulated values. */
export function getWits2024Snapshot(commodity:string):Wits2024Snapshot|null{
  const source=HISTORICAL_WITS_TABLES[commodity]
  if(!source)return null
  const grouped=new Map<string,PartnerObservation>()
  const datasets=source.datasets??[{hs:source.hs,rows:source.data??[]}]
  for(const set of datasets){
    for(const [iso,valueThousandsUsd,weight] of set.rows){
      if(!(valueThousandsUsd>0&&weight>0))continue
      const prior=grouped.get(iso)
      const tradeValueUsd=valueThousandsUsd*1000
      grouped.set(iso,{
        countryCode:iso,countryName:countryName(iso),
        importValueUsd:(prior?.importValueUsd??0)+tradeValueUsd,
        importWeightKg:(prior?.importWeightKg??0)+weight,
        estimatedNetWeight:false,
      })
    }
  }
  const sourceUrls=datasets.map(data=>WITS_BASE+encodeURIComponent(data.hs))
  return {
    year:2024,sourceName:'World Bank WITS / UN Comtrade published 2024',
    sourceUrls,hsCode:source.hs,productScope:source.scope,
    worldImportValueUsd:source.world[0]*1000,
    worldImportWeightKg:source.world[1],
    observation:{
      year:2024,partners:[...grouped.values()],
      worldTotal:{
        countryCode:'',countryName:'World',
        importValueUsd:source.world[0]*1000,
        importWeightKg:source.world[1],estimatedNetWeight:false,
      },
      // We transcribed commercially meaningful known rows from HTML tables.
      // The country chart may omit tiny origins; World mean uses published total.
      incompletePreview:true,
      sourceUrl:sourceUrls[0],
    },
  }
}
