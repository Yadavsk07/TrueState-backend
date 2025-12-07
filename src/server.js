const express = require("express");
const cors = require("cors");
const { streamQuery } = require("./queryStream");

const app = express();
app.use(cors());
app.use(express.json());

const FILE_ID = "1nEAyOeh9Z056XhyrDXcPn1FkGecch1y1";

app.get("/api/transactions", async (req, res) => {
  const { q, region, page = 1 } = req.query;
  const data = await streamQuery({
    fileId: FILE_ID,
    q,
    region,
    page: Number(page),
  });
  res.json(data);
});

app.listen(4000, () =>
  console.log(`🚀 Streaming API running @ http://localhost:4000`)
);
