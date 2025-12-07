// src/controllers/filtersController.js
const { getFiltersMetadata } = require('../services/csvService');

// dataset A
const FILE_ID = '1nEAyOeh9Z056XhyrDXcPn1FkGecch1y1';

async function getFilters(req, res) {
  try {
    const meta = await getFiltersMetadata(FILE_ID);
    res.json(meta);
  } catch (err) {
    console.error('getFilters error', err);
    res.status(500).json({ error: 'Failed to compute filters' });
  }
}

module.exports = { getFilters };
