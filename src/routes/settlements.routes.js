const express = require('express');
const router = express.Router();
const settlementsController = require('../controllers/settlements.controller');
router.post('/:groupId/settlements', settlementsController.createSettlement);
module.exports = router;
