const csv = require("csv-parser");
const { getDriveCSVStream } = require("./driveStream");

async function streamQuery({ fileId, q, region, page }) {
  const pageSize = 10;
  let results = [];
  let skipped = 0;
  const matchLimit = page * pageSize;
  const searchTerm = q?.toLowerCase();
  const regionFilter = region?.toLowerCase();

  const csvStream = await getDriveCSVStream(fileId);

  return new Promise((resolve, reject) => {
    csvStream
      .pipe(csv())
      .on("data", (row) => {
        let match = true;

        if (searchTerm) {
          const n = row.customer_name?.toLowerCase() || "";
          const p = row.phone_number?.toLowerCase() || "";
          match = n.includes(searchTerm) || p.includes(searchTerm);
        }

        if (match && regionFilter) {
          match = (row.customer_region?.toLowerCase() || "") === regionFilter;
        }

        if (!match) return;

        if (skipped < (page - 1) * pageSize) {
          skipped++;
          return;
        }

        results.push(row);

        if (results.length === pageSize) {
          csvStream.destroy();
          resolve({
            page,
            pageSize,
            results,
            total: "Unknown (stream mode)",
          });
        }
      })
      .on("end", () => {
        resolve({
          page,
          pageSize,
          results,
          total: "Unknown (stream mode)",
        });
      })
      .on("error", reject);
  });
}

module.exports = { streamQuery };
