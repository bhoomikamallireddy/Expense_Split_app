const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groups.controller');

router.post('/', groupsController.createGroup);
// This uses a URL parameter ":groupId"
router.post('/:groupId/members', groupsController.addMember);
router.patch('/:groupId/members/:userId/leave', groupsController.leaveGroup);

module.exports = router;