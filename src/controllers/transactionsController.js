// src/controllers/transactionsController.js
const { streamQuery } = require('../services/csvService');

// Use dataset A file ID
const FILE_ID = '1nEAyOeh9Z056XhyrDXcPn1FkGecch1y1';

function parseArrayParam(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

async function listTransactions(req, res) {
  try {
    // parse query parameters
    const q = req.query.q || null;
    const regions = parseArrayParam(req.query.region || req.query.regions);
    const genders = parseArrayParam(req.query.gender || req.query.genders);
    const categories = parseArrayParam(req.query.category || req.query.categories || req.query.product_category);
    const tags = parseArrayParam(req.query.tags);
    const payments = parseArrayParam(req.query.payment || req.query.payment_method);
    const ageMin = req.query.ageMin ? Number(req.query.ageMin) : undefined;
    const ageMax = req.query.ageMax ? Number(req.query.ageMax) : undefined;
    const dateFrom = req.query.startDate || req.query.dateFrom || null;
    const dateTo = req.query.endDate || req.query.dateTo || null;
    const sort = req.query.sort || 'date_desc';
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 10;

    const result = await streamQuery(FILE_ID, {
      q, regions, genders, categories, tags, payments, ageMin, ageMax, dateFrom, dateTo, sort, page, pageSize
    });

    // if error object returned
    if (result && result.error) {
      return res.status(413).json({ error: result.error, page: result.page, total: result.total || 0 });
    }

    // map internal keys back to CSV-like headers for frontend compatibility (optional)
    const mapped = (result.results || []).map(r => {
      // recreate the original-looking keys (keep original CSV header names)
      return {
        "Transaction ID": r.transactionId || r["Transaction ID"] || '',
        "Date": r.date || '',
        "Customer ID": r.customerId || '',
        "Customer Name": r.customerName || '',
        "Phone Number": r.phoneNumber || '',
        "Gender": r.gender || '',
        "Age": r.age != null ? String(r.age) : '',
        "Customer Region": r.customerRegion || '',
        "Customer Type": r.customerType || '',
        "Product ID": r.productId || '',
        "Product Name": r.productName || '',
        "Brand": r.brand || '',
        "Product Category": r.productCategory || '',
        "Tags": (r.tags || []).join(','),
        "Quantity": r.quantity != null ? String(r.quantity) : '',
        "Price per Unit": r.pricePerUnit || '',
        "Discount Percentage": r.discountPercentage || '',
        "Total Amount": r.totalAmount || '',
        "Final Amount": r.finalAmount || '',
        "Payment Method": r.paymentMethod || '',
        "Order Status": r.orderStatus || '',
        "Delivery Type": r.deliveryType || '',
        "Store ID": r.storeId || '',
        "Store Location": r.storeLocation || '',
        "Salesperson ID": r.salespersonId || '',
        "Employee Name": r.employeeName || ''
      };
    });

    res.json({
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
      results: mapped
    });
  } catch (err) {
    console.error('listTransactions error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { listTransactions };
