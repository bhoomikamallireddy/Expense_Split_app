const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expenses.controller');

router.post('/:groupId/expenses', expensesController.createExpense);

module.exports = router;