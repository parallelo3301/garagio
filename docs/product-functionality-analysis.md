# Garagio: product functionality analysis

## Scope and product direction

This analysis describes the codebase reviewed on 2026-10-03. Current capabilities are based on the
implementation; proposed features are recommendations, not commitments or existing functionality.

Garagio is a lightweight, self-hosted inventory and knowledge base for a garage or workshop. Its
strongest use case is helping an owner or a small trusted group answer: **What do we have, where is
it, is it available, and how do we use it?** The phone-oriented interface, local storage, and linked
Wiki suit a workshop better than a general-purpose warehouse or business-management system.

## What the app does today

| Area | Implemented functionality | Code evidence |
| --- | --- | --- |
| Inventory | Create, view, edit, and delete items. Store name, description, non-negative integer quantity, free-text location, manufacturer, tags, photos, and external links. | [Item API](../routes/api/items/index.ts), [item detail API](../routes/api/items/[id].ts), [schema](../db/migrations/001_initial_schema.sql) |
| Availability | Select `in_stock`, `borrowed`, `damaged`, `maintenance`, or `retired` in the editor. Borrowed items can record a borrower and borrowing date. | [Inventory UI](../islands/InventoryApp.tsx) |
| Discovery | Alphabetical inventory list with photo thumbnails and case-insensitive substring search across name, description, location, manufacturer, status, borrower, tags, and link labels/URLs. Filtering happens in the browser. | [Inventory UI](../islands/InventoryApp.tsx), [repository](../db/repository.ts) |
| Workshop knowledge | Create, search, edit, and delete Wiki pages. Preview a limited Markdown subset, auto-link plain URLs, and insert uploaded images, including by drag-and-drop. | [Wiki API](../routes/api/wiki/index.ts), [Wiki detail API](../routes/api/wiki/[id].ts), [Wiki UI and renderer](../islands/InventoryApp.tsx) |
| Connected information | Associate multiple Wiki pages with an item; navigate from an item to a linked page and from a page to linked inventory. Useful for manuals, setup notes, and procedures. | [Relationship schema](../db/migrations/001_initial_schema.sql), [UI](../islands/InventoryApp.tsx) |
| Manufacturers | Settings lets users add and delete manufacturers. The API also supports updates; records include a name, website, and notes. | [Settings UI](../islands/InventoryApp.tsx), [manufacturer API](../routes/api/manufacturers/index.ts), [manufacturer detail API](../routes/api/manufacturers/[id].ts) |
| Images | Upload images up to 10 MB per file into local `uploads/` storage and display them in items or Wiki content. | [Upload API](../routes/api/uploads/index.ts), [image serving route](../routes/uploads/[file].ts) |
| Access | Shared-password login and logout, SQLite-backed sessions with 30-day expiry, and IP-based bans after five failed login attempts. Application data and APIs are access-controlled. | [Authentication](../config/auth.ts), [middleware](../routes/_middleware.ts) |
| Operation | Deno Fresh with Preact and SQLite, automatic transactional migrations, native executable builds, and Docker deployment. Backups require the database and uploaded files together. | [Database](../db/database.ts), [migrations](../db/migrate.ts), [tasks](../deno.json), [deployment and backup guidance](../README.md) |

An existing end-to-end workflow is: add a drill, enter its shelf location and manufacturer, attach a
photo and a setup Wiki page, find it through search, and manually change its status and borrower when
lending it out. The app captures the current record; it does not yet manage the whole loan lifecycle.

## Gaps and their practical impact

These are product limitations, not assertions that the existing functionality is defective.

| Gap | Why it matters in a workshop | Current boundary |
| --- | --- | --- |
| Structured discovery | Users need quick answers such as “all damaged tools on this shelf.” | Search is one text query, without dedicated combinable filters, saved views, or selectable sorting. Locations are free text. |
| Loan lifecycle | Tools can remain borrowed without a clear return expectation. | One status, borrower, and borrowing date apply to the entire item record. There are no due dates, loan history, partial-quantity loans, or dedicated return actions. |
| Consumable replenishment | Screws, abrasives, and fluids can run out unnoticed. | Quantity is editable, but there are no reorder thresholds, units of measure, stock movements, or low-stock view. |
| Maintenance planning | A maintenance status says a tool is unavailable, not when it should be serviced. | No service schedule, due date, or maintenance history. Procedures can already live in the Wiki. |
| Data onboarding and portability | Entering an existing workshop inventory one item at a time is costly. | No user-facing bulk import/export or bulk editing. File-based backup exists, but is not a spreadsheet interchange workflow. |
| Physical identification | Similar tools and storage bins are hard to distinguish by name alone. | No dedicated serial/asset identifiers, label generation, scanning, or item-specific deep-link workflow. |
| Richer reference material | Manuals are often PDFs, while kits have several related parts. | Uploads accept images, not general attachments. Relationships connect items to Wiki pages, not items to other items. |
| Collaboration and recovery | Shared workshops need attribution and protection from accidental changes. | Shared-password access has no individual identities or roles. Records have timestamps, but no user-visible revision history or undo; concurrent edits have no conflict detection. |
| Connectivity and growth | Workshop connectivity can be unreliable, and larger inventories may load slowly. | No offline synchronization workflow; inventory and Wiki lists are loaded as complete collections rather than paginated results. |

The [schema](../db/migrations/001_initial_schema.sql), [repository](../db/repository.ts),
[interactive UI](../islands/InventoryApp.tsx), and [authentication model](../config/auth.ts) establish
these boundaries. For example, one item row has one quantity and one borrower, so independent loans
of two identical tools would require a richer model, not merely another status option.

## Features worth building next

Priorities below favor everyday value and preserve the simple self-hosted model. Effort is relative
to this codebase, not a delivery estimate.

### 1. Faster finding: filters and actionable views

**Value:** Make finding and checking availability easier without requiring more data entry.
**Relative effort:** Small.

- Add combinable status, location, manufacturer, and tag filters alongside existing text search.
- Offer “Borrowed,” “Needs attention” (damaged or maintenance), and “Out of stock” views.
- Add selectable sorting, such as name and location. Label record counts clearly: an item record is
  not the same as the sum of quantities.
- Reuse existing fields first; introduce controlled locations only if inconsistent names become a
  demonstrated problem.

**Success criterion:** A user can locate available tools in a chosen location without editing data
or relying on a carefully composed text query.

### 2. Reliable lending: checkout and return

**Value:** Reduce forgotten loans and make availability trustworthy. **Relative effort:** Medium.

- Add explicit checkout/return actions, an optional due date, and a borrowed/overdue view.
- Record loan events instead of overwriting the only record of a borrower.
- Define quantity semantics before implementing partial loans: distinguish total owned, currently
  available, and loaned quantities, and prevent lending more than is available.
- Start with in-app overdue visibility; external reminders can follow if users need them.

**Success criterion:** A user can identify outstanding loans, record a return, and inspect prior
loans without losing history.

### 3. Consumables: low-stock visibility and quantity adjustments

**Value:** Avoid interrupting work because supplies have run out. **Relative effort:** Medium.

- Add an optional minimum quantity and unit of measure for consumables.
- Provide a low-stock view and simple replenish/use actions with dated quantity changes.
- Keep replenishment manual initially; a suggested shopping list is a better first step than
  supplier integrations or automated purchasing.

**Success criterion:** Users can see supplies below their configured threshold and understand why
the current quantity changed.

### 4. Easier adoption and safer data handling

**Value:** Reduce initial entry effort and improve confidence in long-lived workshop data.
**Relative effort:** Medium.

- Start with CSV inventory export, then add import with a preview, field validation, and an explicit
  duplicate-handling policy. Treat spreadsheet formulas safely in exported user-entered cells.
- Explain that CSV is not a full backup: Wiki pages, relationships, and image files need a complete
  export or the existing database-plus-uploads backup.
- Add a guided backup/restore workflow or clearer in-app backup guidance before promising recovery.
  Restore should validate the archive and avoid silently overwriting live data.

**Success criterion:** Users can move inventory to a spreadsheet and rehearse a complete restore
without losing images or linked knowledge.

### Later, when usage justifies it

- **QR labels and stable item links:** Open a specific tool or bin from a phone. Establish deep links
  first; scanning must not bypass authentication.
- **Maintenance dates and service logs:** Link recurring service records to existing Wiki procedures.
- **PDF attachments and kits:** Support manuals and item-to-item relationships, with upload size,
  content handling, and access controls appropriate to the new file types.
- **Named accounts, roles, and history:** Prioritize if shared workshops need read-only access or
  attribution. Enforce permissions in APIs, not only by hiding UI controls.
- **Offline access and larger-list performance:** Measure connectivity and inventory size first.
  Read-only offline access is simpler than conflict-safe offline editing.

## Recommended sequence and guardrails

Build discovery improvements first, then validate whether users struggle more with lending,
consumables, or initial data entry before choosing the next slice. Avoid building all proposed
features at once. Ask workshop users how often they lend tools, whether they track individual assets
or quantities, and whether several people edit the inventory.

Keep deployment lightweight and data local. Reuse the existing SQLite migration and API structure;
new workflows should preserve existing records and item/Wiki links. The configured tasks currently
include type checking and builds but no automated test task. Before changing stock, loan, import, or
permission behavior, add focused tests for those rules and migration compatibility.

Accounting, invoicing, customer management, full warehouse logistics, and mandatory cloud services
are not recommended next steps: they would broaden the product beyond its strongest workshop use
case without evidence of demand.
