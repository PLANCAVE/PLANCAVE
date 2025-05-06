const express = require('express');
const router = express.Router();

const categories = [
  { id: 1, name: 'Apartments' },
  { id: 2, name: 'Luxury villas' },
  { id: 3, name: 'Rustic plans' },
  { id: 4, name: 'Contemporary plans ' },
  { id: 5, name: 'Hotels & Lodges' },
  { id: 6, name: 'Residentials' },
];

// Define the /api/categories route
router.get('/', (_req, res) => {
  res.json(categories);
});

module.exports = router;
