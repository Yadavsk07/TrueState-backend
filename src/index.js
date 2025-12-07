// src/index.js
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const transactionsRoutes = require('./routes/transactionsRoutes');
const filtersRoutes = require('./routes/filtersRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Mount routes
app.use('/api/transactions', transactionsRoutes);
app.use('/api/filters', filtersRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`TruEstate backend running on http://localhost:${PORT}`);
});
