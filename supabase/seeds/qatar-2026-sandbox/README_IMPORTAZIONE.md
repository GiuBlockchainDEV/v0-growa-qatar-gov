# NFII Qatar 2026 | Sandbox dataset (SYNTHETIC)

## Visualizzazione senza SQL (metodo consigliato)

**Non eseguire i seed SQL solo per vedere il dataset.** Le pagine esistenti
Watchtower, Procurement, Logistics, Strategic Reserves e Scenario Room usano ora
gli esempi *già inclusi nel repository* quando non vi sono dati reali
autorizzati e completi. I 53 record operativi provengono da
\`03_dataset_preview.json\`; i bilanci alimentari utilizzano il generatore
esistente \`lib/food-security/demo-data.ts\`. Non serve alcuna migrazione
aggiuntiva né creare utenti, organizzazioni, tabelle o approvazioni.

- L'anteprima è disponibile ai normali utenti autenticati della dashboard,
  anche senza appartenenza a un'organizzazione sandbox.
- Fornitori, contratti, ordini, spedizioni, magazzini e lotti risultano
  interconnessi visivamente, **ma non sono transazioni verificate**.
- Gli esempi sono **sola lettura**: non si possono confermare spedizioni,
  approvare contratti, rilasciare scorte o modificare dati reali.
- Quando esistono record Supabase autorizzati, la visualizzazione live ha la
  precedenza. Il modulo operativo può passare all'esempio per confronto.
- Un'etichetta “Dati illustrativi / Example data” distingue l'anteprima dai
  dati reali. Non ometterla: il progetto riguarda sicurezza alimentare e
  continuità nazionale.
- Nessun utente ottiene accesso ai dati di altre organizzazioni. Cambiano solo
  i dati di esempio, uguali per gli utenti della dashboard.

**Perché i due seed SQL si fermano:** il codice richiede deliberatamente una
singola organizzazione riconoscibile come SANDBOX/DEMO e due utenti test
indipendenti e attivi. Se queste condizioni non sono soddisfatte, il blocco
SQL interrompe l'operazione per evitare di creare contratti, approvazioni e
scorte inesistenti in un'organizzazione di produzione. Non rimuovere questa
protezione. Per la sola visualizzazione, questi script non sono necessari.

---


> **NOT REAL QATAR GOVERNMENT RECORDS.** Invented companies, quotes, contracts, bills of lading, reserve locations, stock levels and approval outcomes. Geographic references are illustrative. Keep this entire dataset inside a dedicated, restricted **SANDBOX / DEMO / SIMULATION** organization. This package does **not** modify your database automatically.

## Correzioni rispetto al primo ZIP

- **SQL 01**: riparati i due apostrofi mancanti dopo `v_item->>'location'` e `v_item->>'purpose'`, che rendevano il codice PL/pgSQL non compilabile.
- **SQL 02**: eliminati i segnaposto obbligatori; il controllo UUID non fallisce più quando una sandbox è identificabile senza ambiguità.
- Entrambi gli script selezionano automaticamente gli ID **solo se** esiste esattamente UNA organizzazione con **NFII** e **SANDBOX**, **DEMO** o **SIMULATION** nel nome, e questa ha esattamente DUE membri con `status='active'`.
- Se ci sono 0 o più organizzazioni idonee, oppure non ci sono esattamente due membri attivi, **gli script si fermano prima di scrivere**. Non selezionano account a caso.

## Contenuto

- `00_PRECHECK_READONLY.sql` - controllo preventivo: elenca organizzazione, UUID dei due utenti e stato di idoneità. **Sola lettura**.
- `01_nfii_qatar_sandbox_operations.sql` - 53 record operativi interconnessi tramite le RPC audit della 00041, con stati simulati e controlli di quantità.
- `02_nfii_qatar_sandbox_food_pending.sql` - 621 record alimentari sintetici, sempre `pending_review`.
- `03_dataset_preview.json` - anteprima dati, assunzioni e riferimenti.

## Come eseguire in Supabase

1. **Usa un progetto staging**, oppure un'organizzazione di test isolata. Esegui un backup.
2. Verifica che le migrazioni `00039`, `00040` e `00041` siano già state applicate.
3. Crea un'organizzazione, ad esempio **`NFII QATAR SANDBOX - SYNTHETIC DATA`**, e assegna **due utenti di test differenti** come membri `active`. Non creare nuovi utenti direttamente via SQL.
4. Esegui **solo** `00_PRECHECK_READONLY.sql` nel SQL Editor. Deve apparire una riga con `READY FOR AUTO-SELECTION`.
5. Esegui il **file SQL 01 completo**, da `BEGIN;` a `COMMIT;`. Non eseguire singole righe: sono dentro un blocco PL/pgSQL.
6. Esegui il **file SQL 02 completo**, da `BEGIN;` a `COMMIT;`.
7. Apri le sezioni Procurement, Logistics e Strategic Reserves dell'app con un membro autorizzato. I KPI verificati della Food Security Watchtower **resteranno invariati** finché i record alimentari non sono verificati tramite fonti vere, come previsto.

Se il precheck restituisce zero righe, la sandbox NFII non è stata trovata: crea/rinomina correttamente l'organizzazione. Se indica più di una sandbox o un numero di membri diverso da 2, usa gli **override opzionali** indicati nell'intestazione degli script:

```sql
-- Script 01, nel blocco DECLARE:
v_org_text TEXT := 'UUID_ORGANIZZAZIONE_SANDBOX';
v_creator_text TEXT := 'UUID_UTENTE_TEST_1';
v_reviewer_text TEXT := 'UUID_UTENTE_TEST_2';

-- Script 02, nel blocco DECLARE:
v_org_text TEXT := 'UUID_ORGANIZZAZIONE_SANDBOX';
v_submitter_text TEXT := 'UUID_UTENTE_TEST_1';
```

Inserisci UUID reali esistenti, non gli esempi con parole. Non modificare la condizione `SANDBOX/DEMO/SIMULATION` né forzare stati `verified` per i dati sintetici.

**Nota:** l'importazione via SQL Editor è una simulazione amministrativa, non la registrazione di eventi fisici reali e non costituisce un'approvazione istituzionale. Se un file fallisce, il suo `BEGIN ... COMMIT` non dovrebbe lasciare dati parziali; verifica comunque i conteggi prima di rilanciarlo.

## Verifica successiva (sola lettura)

```sql
SELECT 'suppliers' AS table_name, count(*) FROM public.nfii_suppliers WHERE code LIKE 'SIMQA26-%'
UNION ALL SELECT 'contracts', count(*) FROM public.nfii_contracts WHERE contract_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'orders', count(*) FROM public.nfii_purchase_orders WHERE order_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'shipments', count(*) FROM public.nfii_shipments WHERE shipment_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'warehouses', count(*) FROM public.nfii_warehouses WHERE code LIKE 'SIMQA26-%'
UNION ALL SELECT 'lots', count(*) FROM public.nfii_reserve_lots WHERE lot_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'releases', count(*) FROM public.nfii_reserve_releases WHERE release_ref LIKE 'SIMQA26-%';
```

**Atteso, a dataset mai importato prima:** 10 / 11 / 10 / 10 / 3 / 5 / 4.

## Dataset coherence checks

- Qatar local vegetable and dairy counterparties are represented separately from grain import suppliers.
- Rice sourcing examples use India and Pakistan; the approved backup supplier uses Vietnam. Country names and trade directions are plausible, not live trade confirmations.
- Wheat is sourced from Australia; barley from Germany; peppers from Turkey; dates from Oman. These are **illustrative contracts**, not claims about current Qatar trade by supplier.
- Every PO fits its parent contract; every shipment fits its approved PO; combined delivered warehouse lots do not exceed their shipment quantities; every proposed or executed release fits available approved lot quantities.
- 3 warehouses in Doha Industrial Area, Mesaieed and Al Khor are **fictional facilities**, not actual certified national reserve depots.
- QAR/t prices are synthetic illustrative procurement assumptions, not a 2026 quote or binding offer.
- Open stock and per-day supply numbers describe ONE fictional operator, not Qatar national demand or official reserves.
- Dates anchor to **the Doha day on execution**. A Watchtower horizon starting on a later day requires a new independently reviewed opening snapshot, by design. Do not re-run the one-time seed to refresh stocks.
- Under the current aggregate balance model, weekly/monthly forecast quantities are dated at the **beginning** of their interval; this is fine for a period-ending sandbox illustration but cannot resolve within-week stockouts or real delivery ETAs. That limitation is deliberately documented.
- Audit entries generated from the SQL simulation have genuine database events but do **not** constitute legal or institutional approvals.

## Post-insertion check

```sql
SELECT 'suppliers' kind, count(*) FROM public.nfii_suppliers
 WHERE code LIKE 'SIMQA26-%'
UNION ALL SELECT 'contracts', count(*) FROM public.nfii_contracts
 WHERE contract_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'orders', count(*) FROM public.nfii_purchase_orders
 WHERE order_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'shipments', count(*) FROM public.nfii_shipments
 WHERE shipment_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'warehouses', count(*) FROM public.nfii_warehouses
 WHERE code LIKE 'SIMQA26-%'
UNION ALL SELECT 'lots', count(*) FROM public.nfii_reserve_lots
 WHERE lot_ref LIKE 'SIMQA26-%'
UNION ALL SELECT 'releases', count(*) FROM public.nfii_reserve_releases
 WHERE release_ref LIKE 'SIMQA26-%';
```

These counts are **all organizations** by prefix; add `organization_id = '<your sandbox UUID>'` for a tenant-specific check. Expect 10 / 11 / 10 / 10 / 3 / 5 / 4 with the current fixture.

## Basis and provenance

Real official/public context only guides relative direction and scaling. The seed's invented transaction values are NOT directly measured by the following references:

- Qatar News Agency (15 October 2026): 2025 self-sufficiency ~99% for fresh dairy and poultry, ~47% for basic vegetables. https://qna.org.qa/en/news/news-bulletins-details?date=15%2F10%2F2026&id=0083-qatar-targets-sustainable-food-production-as-self-sufficiency-reaches-99-for-fresh-poultry-and-dairy
- WITS/UN Comtrade (2024) rice imports 214,290 t; ~188,952 t from India. https://wits.worldbank.org/trade/comtrade/en/country/QAT/year/2024/tradeflow/Imports/partner/ALL/product/1006
- WITS/UN Comtrade (2024) barley imports 271,564 t; leading sources include Germany. https://wits.worldbank.org/trade/comtrade/en/country/QAT/year/2024/tradeflow/Imports/partner/ALL/product/1003
- WITS/UN Comtrade (2024) wheat imports 103,340 t. https://wits.worldbank.org/trade/comtrade/en/country/ALL/year/2024/tradeflow/Imports/partner/WLD/product/1001
- Qatar National Food Security Strategy 2030: priority sectors are local perishable production, strategic dry food reserves and diversified imports; 55% fresh strategic vegetables is a 2030 target, **not a 2026 observed figure**. https://www.npc.qa/en/media/Doc/Documents/NPC_EN_Report.pdf

## No-guessing policy

No prices, suppliers, contracts, lot inventories, vessel ETAs or countrywide operational stock values in this package are official statistics. Do not publish, export to ministries or claim the data are verified. For production, replace sample values with sourced/imported records and a real independent review.
