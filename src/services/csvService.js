// src/services/csvService.js
const csv = require('csv-parser');
const { getDriveFileStream } = require('../utils/driveClient');

// Config
const DEFAULT_PAGE_SIZE = 10;
const MAX_BUFFER_FOR_NAME_SORT = 200000; // safety cap: if more matches than this for name sort, ask user to narrow filters

// Simple binary heap (min-heap) for numbers and dates
class MinHeap {
  constructor(compare) {
    this.heap = [];
    this.compare = compare || ((a,b)=> a - b);
  }
  size(){ return this.heap.length; }
  peek(){ return this.heap[0]; }
  push(item){
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }
  pop(){
    if(this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if(this.heap.length > 0){
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  _siftUp(idx){
    while(idx > 0){
      const p = Math.floor((idx-1)/2);
      if(this.compare(this.heap[idx], this.heap[p]) < 0){
        [this.heap[idx], this.heap[p]] = [this.heap[p], this.heap[idx]];
        idx = p;
      } else break;
    }
  }
  _siftDown(idx){
    const n = this.heap.length;
    while(true){
      let smallest = idx;
      const l = 2*idx + 1;
      const r = 2*idx + 2;
      if(l < n && this.compare(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if(r < n && this.compare(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if(smallest !== idx){
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else break;
    }
  }
  toArray(){
    return this.heap.slice();
  }
}

// Helper to normalize CSV row keys to predictable keys (camelCase)
function normalizeRow(row) {
  // map common headers to internal keys (case-insensitive)
  const map = {};
  for (const k of Object.keys(row)) {
    const key = k.trim();
    const lower = key.toLowerCase();
    // create canonical keys used below
    if (lower === 'transaction id') map.transactionId = row[k];
    else if (lower === 'date') map.date = row[k];
    else if (lower === 'customer id') map.customerId = row[k];
    else if (lower === 'customer name') map.customerName = row[k];
    else if (lower === 'phone number') map.phoneNumber = row[k];
    else if (lower === 'gender') map.gender = row[k];
    else if (lower === 'age') map.age = row[k];
    else if (lower === 'customer region') map.customerRegion = row[k];
    else if (lower === 'customer type') map.customerType = row[k];
    else if (lower === 'product id') map.productId = row[k];
    else if (lower === 'product name') map.productName = row[k];
    else if (lower === 'brand') map.brand = row[k];
    else if (lower === 'product category') map.productCategory = row[k];
    else if (lower === 'tags') map.tags = row[k];
    else if (lower === 'quantity') map.quantity = row[k];
    else if (lower === 'price per unit') map.pricePerUnit = row[k];
    else if (lower === 'discount percentage') map.discountPercentage = row[k];
    else if (lower === 'total amount') map.totalAmount = row[k];
    else if (lower === 'final amount') map.finalAmount = row[k];
    else if (lower === 'payment method') map.paymentMethod = row[k];
    else if (lower === 'order status') map.orderStatus = row[k];
    else if (lower === 'delivery type') map.deliveryType = row[k];
    else if (lower === 'store id') map.storeId = row[k];
    else if (lower === 'store location') map.storeLocation = row[k];
    else if (lower === 'salesperson id') map.salespersonId = row[k];
    else if (lower === 'employee name') map.employeeName = row[k];
    else {
      // unknown header: keep original
      map[key] = row[k];
    }
  }

  // normalize types
  if (map.age !== undefined) map.age = map.age === '' ? null : Number(map.age);
  if (map.quantity !== undefined) map.quantity = map.quantity === '' ? 0 : Number(map.quantity);
  if (map.date) map._dateObj = new Date(map.date);
  if (map.tags && typeof map.tags === 'string') {
    // tags comma-separated
    map.tags = map.tags.split(',').map(t => t.trim()).filter(Boolean);
  } else if (!map.tags) {
    map.tags = [];
  }
  // lower-case copies for search
  map._customerNameLower = (map.customerName || '').toString().toLowerCase();
  map._phoneLower = (map.phoneNumber || '').toString().toLowerCase();
  map._regionLower = (map.customerRegion || '').toString().toLowerCase();
  map._genderLower = (map.gender || '').toString().toLowerCase();
  map._productCategoryLower = (map.productCategory || '').toString().toLowerCase();
  map._paymentLower = (map.paymentMethod || '').toString().toLowerCase();
  map._tagsLower = (map.tags || []).map(t => t.toString().toLowerCase());
  return map;
}

// In-memory metadata cache
let metadataCache = null;
let metadataCacheTimestamp = 0;
const METADATA_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

async function getFiltersMetadata(fileId) {
  const now = Date.now();
  if (metadataCache && (now - metadataCacheTimestamp) < METADATA_CACHE_TTL_MS) {
    return metadataCache;
  }

  // scan CSV once and gather unique values (small memory footprint)
  const genders = new Set();
  const regions = new Set();
  const paymentMethods = new Set();
  const productCategories = new Set();
  const tags = new Set();
  let minAge = Infinity, maxAge = -Infinity;
  let minDate = null, maxDate = null;
  let totalRows = 0;

  const stream = await getDriveFileStream(fileId);
  return new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (raw) => {
        totalRows++;
        const row = normalizeRow(raw);

        if (row.gender) genders.add(row.gender);
        if (row.customerRegion) regions.add(row.customerRegion);
        if (row.paymentMethod) paymentMethods.add(row.paymentMethod);
        if (row.productCategory) productCategories.add(row.productCategory);
        if (row.tags && Array.isArray(row.tags)) row.tags.forEach(t => tags.add(t));

        if (typeof row.age === 'number' && !Number.isNaN(row.age)) {
          if (row.age < minAge) minAge = row.age;
          if (row.age > maxAge) maxAge = row.age;
        }

        if (row._dateObj && !isNaN(row._dateObj.getTime())) {
          if (!minDate || row._dateObj < minDate) minDate = row._dateObj;
          if (!maxDate || row._dateObj > maxDate) maxDate = row._dateObj;
        }
      })
      .on('end', () => {
        metadataCache = {
          totalRows,
          genders: Array.from(genders).sort(),
          regions: Array.from(regions).sort(),
          paymentMethods: Array.from(paymentMethods).sort(),
          productCategories: Array.from(productCategories).sort(),
          tags: Array.from(tags).sort(),
          ageRange: {
            min: isFinite(minAge) ? minAge : null,
            max: isFinite(maxAge) ? maxAge : null
          },
          dateRange: {
            min: minDate ? minDate.toISOString().slice(0,10) : null,
            max: maxDate ? maxDate.toISOString().slice(0,10) : null
          }
        };
        metadataCacheTimestamp = Date.now();
        resolve(metadataCache);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * streamQuery:
 *  - fileId: drive file id
 *  - options:
 *     q - search string (matches name or phone, case-insensitive substring)
 *     regions - array of region strings
 *     genders - array
 *     categories - array
 *     tags - array (match if any tag in row)
 *     payments - array
 *     ageMin, ageMax - numbers
 *     dateFrom, dateTo - ISO date strings
 *     sort - 'date_desc' | 'quantity_desc' | 'customer_asc' (default date_desc)
 *     page - 1-indexed
 *     pageSize - default 10
 */
async function streamQuery(fileId, options = {}) {
  const {
    q,
    regions = [],
    genders = [],
    categories = [],
    tags = [],
    payments = [],
    ageMin,
    ageMax,
    dateFrom,
    dateTo,
    sort = 'date_desc',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  const searchLower = q ? q.toString().toLowerCase() : null;
  const regionSet = new Set((regions || []).map(r => r.toString().toLowerCase()).filter(Boolean));
  const genderSet = new Set((genders || []).map(s => s.toString().toLowerCase()).filter(Boolean));
  const categorySet = new Set((categories || []).map(s => s.toString().toLowerCase()).filter(Boolean));
  const paymentSet = new Set((payments || []).map(s => s.toString().toLowerCase()).filter(Boolean));
  const tagSet = new Set((tags || []).map(s => s.toString().toLowerCase()).filter(Boolean));
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSizeNum = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);

  // For date bounds
  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(dateTo) : null;

  // We'll count matches; depending on sort, choose streaming strategy.
  // For date_desc / quantity_desc -> keep a min-heap of size K = pageNum * pageSizeNum for top-K.
  // For customer_asc -> must collect all matches (buffer). We'll cap buffer to avoid OOM.
  const sortMode = sort || 'date_desc';

  const stream = await getDriveFileStream(fileId);

  return new Promise((resolve, reject) => {
    let totalMatches = 0;
    let finished = false;

    // Helper: check if row matches filters
    function rowMatches(row) {
      // search
      if (searchLower) {
        const nameMatch = row._customerNameLower && row._customerNameLower.includes(searchLower);
        const phoneMatch = row._phoneLower && row._phoneLower.includes(searchLower);
        if (!nameMatch && !phoneMatch) return false;
      }
      if (regionSet.size > 0 && !regionSet.has((row._regionLower || '').toLowerCase())) return false;
      if (genderSet.size > 0 && !genderSet.has((row._genderLower || '').toLowerCase())) return false;
      if (categorySet.size > 0 && !categorySet.has((row._productCategoryLower || '').toLowerCase())) return false;
      if (paymentSet.size > 0 && !paymentSet.has((row._paymentLower || '').toLowerCase())) return false;
      if (tagSet.size > 0) {
        const hasTag = row._tagsLower && row._tagsLower.some(t => tagSet.has(t));
        if (!hasTag) return false;
      }
      if (typeof ageMin === 'number' && !Number.isNaN(ageMin)) {
        if (typeof row.age !== 'number' || Number.isNaN(row.age) || row.age < ageMin) return false;
      }
      if (typeof ageMax === 'number' && !Number.isNaN(ageMax)) {
        if (typeof row.age !== 'number' || Number.isNaN(row.age) || row.age > ageMax) return false;
      }
      if (fromDate && row._dateObj && row._dateObj < fromDate) return false;
      if (toDate && row._dateObj && row._dateObj > toDate) return false;
      return true;
    }

    // Depending on sort
    if (sortMode === 'date_desc' || sortMode === 'quantity_desc') {
      // Build min-heap that keeps top K items according to sort descending
      const K = pageNum * pageSizeNum;
      const compare = (a, b) => {
        // min-heap compare: a < b => negative
        if (sortMode === 'date_desc') {
          const ta = a._dateObj ? a._dateObj.getTime() : 0;
          const tb = b._dateObj ? b._dateObj.getTime() : 0;
          return ta - tb;
        } else {
          const qa = Number(a.quantity || 0);
          const qb = Number(b.quantity || 0);
          return qa - qb;
        }
      };
      const heap = new MinHeap(compare);

      stream
        .pipe(csv())
        .on('data', (raw) => {
          try {
            const row = normalizeRow(raw);
            if (!rowMatches(row)) return;
            totalMatches++;
            if (heap.size() < K) {
              heap.push(row);
            } else {
              // if current row should be in top K
              const top = heap.peek();
              if (compare(row, top) > 0) {
                heap.pop();
                heap.push(row);
              }
            }
          } catch (err) {
            // ignore row parsing errors
          }
        })
        .on('end', () => {
          // heap contains top K items by ascending compare; we need descending for date_desc/quantity_desc
          const arr = heap.toArray();
          // sort descending
          arr.sort((a,b) => {
            if (sortMode === 'date_desc') return (b._dateObj?.getTime()||0) - (a._dateObj?.getTime()||0);
            return (Number(b.quantity||0)) - (Number(a.quantity||0));
          });
          const start = (pageNum -1) * pageSizeNum;
          const pageItems = arr.slice(start, start + pageSizeNum);
          resolve({
            page: pageNum,
            pageSize: pageSizeNum,
            total: totalMatches,
            totalPages: Math.ceil(totalMatches / pageSizeNum),
            results: pageItems
          });
        })
        .on('error', (err) => reject(err));
      return;
    }

    // Else if customer_asc (A-Z)
    if (sortMode === 'customer_asc') {
      // Buffer matches; careful about memory. Cap buffer to MAX_BUFFER_FOR_NAME_SORT
      const buffer = [];
      let exceeded = false;

      stream
        .pipe(csv())
        .on('data', (raw) => {
          if (exceeded) return;
          try {
            const row = normalizeRow(raw);
            if (!rowMatches(row)) return;
            totalMatches++;
            buffer.push(row);
            if (buffer.length > MAX_BUFFER_FOR_NAME_SORT) {
              exceeded = true;
              // destroy stream
              try { stream.destroy(); } catch(e){}
            }
          } catch (err) {}
        })
        .on('end', () => {
          if (exceeded) {
            // inform user to narrow filters
            return resolve({
              error: `Too many results for alphabetical sort. Narrow filters (e.g., region/date) or use other sort. Matches exceeded ${MAX_BUFFER_FOR_NAME_SORT}.`,
              page: pageNum,
              pageSize: pageSizeNum,
              total: totalMatches,
              results: []
            });
          }
          // sort buffer by customerName A-Z
          buffer.sort((a,b) => {
            const na = (a.customerName||'').toString().toLowerCase();
            const nb = (b.customerName||'').toString().toLowerCase();
            if (na < nb) return -1;
            if (na > nb) return 1;
            return 0;
          });
          const start = (pageNum -1) * pageSizeNum;
          const pageItems = buffer.slice(start, start + pageSizeNum);
          resolve({
            page: pageNum,
            pageSize: pageSizeNum,
            total: totalMatches,
            totalPages: Math.ceil(totalMatches / pageSizeNum),
            results: pageItems
          });
        })
        .on('error', (err) => reject(err));
      return;
    }

    // default fallback: no special sort (use streaming order)
    const results = [];
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum - 1;
    let matchedSoFar = 0;

    stream
      .pipe(csv())
      .on('data', (raw) => {
        try {
          const row = normalizeRow(raw);
          if (!rowMatches(row)) return;
          const idx = matchedSoFar;
          matchedSoFar++;
          totalMatches++;
          if (idx >= startIndex && idx <= endIndex) {
            results.push(row);
          }
        } catch (err) {}
      })
      .on('end', () => {
        resolve({
          page: pageNum,
          pageSize: pageSizeNum,
          total: totalMatches,
          totalPages: Math.ceil(totalMatches / pageSizeNum),
          results
        });
      })
      .on('error', (err) => reject(err));
  });
}

module.exports = {
  getFiltersMetadata,
  streamQuery
};
