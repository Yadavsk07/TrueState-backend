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

Service account credentials (credentials.json)

To stream files from Google Drive the backend uses a Google service account key. Follow these steps to create and use credentials safely:

1. Go to the Google Cloud Console and open (or create) the project that owns the Drive file.
2. In **IAM & Admin > Service accounts** create a new service account (give it a name like `truestate-backend-sa`).
3. Grant the service account access to the Drive file (you can share the Drive file with the service account email), or grant a minimal role that allows readonly access to the file if appropriate.
4. Create a JSON key for the service account and download it. Save the file as `credentials.json` in the `backendd` directory (next to `package.json`).
5. IMPORTANT: Do NOT commit `credentials.json`. This repository already contains `.gitignore` which excludes `credentials.json`.

If you'd like to keep a trackable example, use `credentials.example.json` (no secrets) as a template and store your real key only locally.

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

