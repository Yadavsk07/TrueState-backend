const express = require("express");
const router = express.Router();
const { runQuery } = require("./queryStream");

router.get("/transactions", (req, res) => {
  const { q, region, page } = req.query;

  const data = runQuery({
    q,
    region,
    page: Number(page) || 1
  });

  res.json(data);
});

module.exports = router;
