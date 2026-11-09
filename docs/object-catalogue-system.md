# Church and heritage object catalogue

The platform stores a linked catalogue rather than a fixed list of icon pages. A church is the owning record for each heritage object. An object can be an icon, relic, manuscript, architectural feature, vessel, or another supported object type. Object details include its type, approximate date, location within the church, materials, dimensions, condition notes, language-specific title and description, images, audio, historical claims, and sources. Every object receives a stable public ID used for its QR page.

## Connections between objects

`object_relations` connects two objects in the same church. Supported links cover shared subject, artist, workshop, set, location, historical context, inspiration, and other editorially described relationships. A relation can include a description, display order, and public visibility. Public QR pages show the published, public relationships and link to the related QR pages. Editors can add and remove links from an object's admin page. RLS prevents linking records across churches and limits editing to authorized church editors or platform administrators.

## Import and review

Editors can open **Admin → Heritage objects → Import inventory**, select a church, and upload the UTF-8 CSV template at `public/templates/church-icon-inventory.csv`. Imports are capped at 250 rows and 2 MB per file. Each valid row is created as a draft with a generated QR ID. The results list reports IDs and row-level errors. The normal editorial workflow still applies: complete translations, attach images and sources, add historical claims and relationships, then submit for historical and church review before publication.

CSV columns: `object_type`, `title`, `description`, `approximate_date`, `location_in_church`, `materials`, `dimensions`, `condition_notes`, and `default_language`. `object_type` and `title` are required. Language codes must be active (currently English `en` and Arabic `ar`). Quoting follows standard CSV escaping. Use one import batch per church; relations and source citations are added after the object IDs have been created.

## Coverage and data quality

The application now supports a multi-church, related-object catalogue and bulk entry. It does not contain a verified exhaustive inventory of every church or every icon in Egypt. Inventory coverage must be built church by church from authorized catalogues and field review. Do not publish an unverified attribution, date, provenance, or image. Store claims with their supporting sources and submit uncertain information for review.
