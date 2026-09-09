# Map-Centric User Experience

← [[05-Intelligence-Workspaces]] | [[00-Index]] | Next: [[07-Compliance-Governance]]

---

## Design Philosophy

Agriculture is inherently spatial. Growa treats the **interactive satellite map** as the persistent operating surface — not a secondary widget. All analytical workspaces slide over the map, preserving geographic context while presenting data.

> *Every number on a dashboard should lead to a place on the ground.*

---

## Map Shell Architecture

```
┌──────────────────────────────────────────────┐
│  Header (org context, user menu, language)   │
├──────────┬───────────────────────────────────┤
│ Sidebar  │                                   │
│ (modules)│     Satellite Map (persistent)    │
│          │                                   │
│          │  ┌─────────────────────────┐      │
│          │  │ Workspace Panel         │      │
│          │  │ (slides from left)      │      │
│          │  └─────────────────────────┘      │
└──────────┴───────────────────────────────────┘
```

---

## Map Capabilities

| Capability | Description |
|------------|-------------|
| National → site zoom | From country view to individual farm |
| Layer presets | Toggle operational overlays |
| Search & locate | Find farms, facilities, points |
| Saved views | Persist operational map configurations |
| Custom map points | User-drawn markers (farm, facility, sensor) |
| Polygon overlays | Operational areas with crop and resource metrics |
| Scope switching | National, regional, or inspection-focused views |

---

## Custom Map Objects

### Map Points
User-placed markers representing farms, facilities, sensors, or other operational sites. Bilingual labels supported.

### Polygons
Drawn operational areas linked to:
- Crop type assignment
- Production, water, and energy totals
- Performance scores
- External reference links (when authorized)

### Crop Insights
Per-point analytical records aggregating production and resource metrics — the foundation for intelligence workspace calculations.

---

## Navigation Integration

- Module selection via `?module=` query parameter keeps map mounted
- Clicking a data table row pans/zooms map to corresponding location
- Inspector role receives inspection-focused map submenu items
- Admin role receives national and regional map views

---

## UX IP Claims

1. **Persistent map shell** — Analytical panels are overlays, not page replacements
2. **Bidirectional data-map linking** — Tables and map are always connected
3. **Role-aware map modes** — Same map, different operational lenses per role
4. **Progressive module loading** — Registry-defined shells render before full backend wiring

---

## Related Notes

- [[04-Module-Registry]]
- [[05-Intelligence-Workspaces]]
- [[09-Data-Model]]
