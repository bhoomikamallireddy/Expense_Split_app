const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groups.controller');

router.post('/', groupsController.createGroup);
// This uses a URL parameter ":groupId"
router.post('/:groupId/members', groupsController.addMember);

module.exports = router;