# NFII | Crop-led supplier evidence expansion (2026-11-01)

## Implemented

The crop-first sourcing endpoint `GET /api/nfii/procurement/crop-producers?commodity=rice&country=IN`
now returns an attributed, deduplicated **multi-publisher research directory** instead of
only the initial nine FairTSA organization records.

The expanded collection adds **238 crop–organization associations** from published
directory snapshots. A single organization may appear for several commodities, so
**238 is not a count of distinct suppliers, verified growers or export-ready firms**.

- **Rice, India:** 41 published industry association participants from All India Rice
  Exporters Association 2024–25 governing-body list, source:
  https://airea.net/wp-content/uploads/2025/05/Governing-Body-Members-2025.pdf
- **Rice, Thailand:** 50 named listings transcribed from the Thai Rice Exporters
  Association member directory (pages 1, 4, 5, 6, 8, 9); source:
  https://www.thairiceexporters.or.th/member_1.htm
- **Dates, Saudi Arabia:** 12 organizations and mark identifiers listed by the
  Saudi National Center for Palms and Dates; source:
  https://ncpd.gov.sa/en/badge-holders
- **Milk, India:** 14 cooperative operators listed with milk in published consumer
  price schedules; source:
  https://www.ncdfi.coop/index.php/civil-consumer-prices/
- **Wheat / barley, Australia:** 5 sector participants each (10 associations)
  named against both commodities by an independent grain-sector publication;
  source: https://grain.net.au/traders-brokers/
- **Tomato / cucumber / pepper / lettuce, Spain:** COEXPHAL's 2021/22
  annual report lists **32 tomato, 32 cucumber, 34 pepper and 7 lettuce**
  crop-specific marketing-organization associations (105 source rows).
  Data is historical and does not establish current supplier activity.
  Source: https://www.coexphal.es/wp-content/uploads/2023/10/MEMORIA-COEXPHAL-2022.pdf
- **Tomato / cucumber / pepper, Spain:** 2 named cooperative operators each
  (6 associations) linked to documented product certificates published by
  the operators. Certificate snapshots are not live authorization checks.

The earlier FairTSA registry excerpt remains available with its original certifier
and record identifiers. The API publishes per-result `sourceName`, `sourceUrl`,
`matchedProduct`, `evidenceType`, `recordId`, `countryCode` and review date.
It also returns `sourceCount`, `countryCount` and `evidenceBreakdown`.
No provider can write, approve or qualify a supplier through the research endpoint.

## Interpretation matters

The source categories are intentionally non-equivalent:

- `product_listed_in_certification_directory`: product claim published in
  certification directory, but current validity and grower role not reverified.
- `company_product_document`: an operator has published a dated product
  document; scope/expiry require independent confirmation.
- `crop_sector_association_member`: member of a commodity-specific trade group;
  no demonstrated farm cultivation or available stock.
- `national_dates_mark_holder`: named organization in a national dates mark list;
  not proof of export capability, production volume or an active commercial offer.
- `public_milk_price_listing`: organization appears with milk price observations;
  not proof of raw milk producer status or international availability.
- `historical_crop_marketer`: organization listed as a marketer of the specified
  crop in a dated agricultural association annual report; not proof of current stock.
- `independent_commodity_listing`: third-party sector summary, not certification
  or direct producer confirmation.

Every row deliberately sets `cropGrowerConfirmed=false`,
`currentCertificateConfirmed=false`, `exportCapabilityConfirmed=false`,
`supplierApproved=false` and `capacityTonnes=null`.

## Display and limits

The UI displays 20 entries initially and adds 30 on each "Show more" click.
The research shortlist is limited to 250 and exports an evidence-aware TSV.
All records are in the shipped curated snapshot, so this is **not** a continuously
updated global census, live supplier API, live availability service or proof of
current eligibility. A missing match does not imply there are no producers.
The source URLs should be rechecked before outreach and onboarding.

A future expansion to many thousands of suppliers requires licensed direct
data feeds or permissioned registry imports, a refresh cadence, source
versioning, country/commodity taxonomy and manual qualification workflow.
