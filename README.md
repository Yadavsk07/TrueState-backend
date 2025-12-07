# TruEstate Backend

This is the Node/Express backend for the TruEstate Sales Management System. It streams CSV data stored on Google Drive, applies filters, and returns paginated results to the frontend.

Quick overview
- Location: `backendd/src`
- Entry point:`backendd/src/index.js` 
- Run script:`npm run dev` (from the `backendd` directory)

Dependencies
- `express`, `cors`, `morgan` — server and middleware
- `csv-parser` — streaming CSV parsing
- `googleapis` — Google Drive streaming via a service account key

API endpoints
- `GET /api/transactions`
  - Query params supported (examples):
    - `q` — text search across customer name and phone
    - `regions`, `genders`, `categories`, `tags`, `payments` — comma-separated lists
    - `ageMin`, `ageMax` — numeric range
    - `startDate`, `endDate` — ISO date strings
    - `sort` — `date_desc` (default), `quantity_desc`, `customer_asc`
    - `page`, `pageSize` — pagination (1-indexed)

- `GET /api/filters` — scans the CSV once and returns available filter options and ranges (regions, genders, payment methods, product categories, tags, ageRange, dateRange)

Important notes & setup
- The backend streams CSV data directly from Google Drive. A service account key file named `credentials.json` must be placed in the `backendd` folder (next to `package.json`) and must have readonly Drive access.
- The CSV file ID is referenced in the code (example ID used: `1nEAyOeh9Z056XhyrDXcPn1FkGecch1y1`). Update the file ID in `backendd/src/controllers/transactionsController.js` / `backendd/src/controllers/filtersController.js` or pass it via a small config if you prefer.
- Default port: `4000`. You can set `PORT` in the environment when starting the app.

Running locally
1. Install dependencies and start the server:

```powershell
Set-Location -Path "E:\TrueState Sales System\backendd"
npm install
npm run dev
```

2. Verify endpoints:

```powershell
curl "http://localhost:4000/api/filters"
curl "http://localhost:4000/api/transactions?page=1&pageSize=10"
```

Implementation notes
- See `backendd/src/services/csvService.js` for the streaming query implementation. It supports top-K streaming for `date_desc` and `quantity_desc` sorts with a bounded min-heap, and a buffered approach for alphabetical `customer_asc` sorts (capped to avoid large memory usage).
- `backendd/src/utils/driveClient.js` and `backendd/src/driveStream.js` contain Google Drive helpers using `googleapis`.

