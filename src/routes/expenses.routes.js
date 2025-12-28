const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expenses.controller');


router.post('/:groupId/expenses', expensesController.createExpense);
router.get('/:groupId/balances', expensesController.getBalances);
router.get('/:groupId/expenses', expensesController.getGroupExpenses);
router.get('/:groupId/simplified',expensesController.getSimplifiedBalances);

module.exports = router;