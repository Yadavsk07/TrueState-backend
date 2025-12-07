// src/routes/filtersRoutes.js
const express = require('express');
const router = express.Router();
const { getFilters } = require('../controllers/filtersController');

router.get('/', getFilters);

module.exports = router;
