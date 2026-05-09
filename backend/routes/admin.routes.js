const router = require('express').Router();
const { authRequired, adminRequired } = require('../middlewares/auth.middleware');
const admin = require('../controllers/admin.controller');

router.use(authRequired, adminRequired);
router.get('/stats', admin.stats);
router.get('/users', admin.listUsers);
router.get('/logs', admin.listLogs);
router.get('/ips', admin.listBannedIps);
router.get('/me-ip', admin.currentIp);
router.post('/users/:id/ban', admin.banUser);
router.post('/users/:id/unban', admin.unbanUser);
router.post('/users/:id/reset-password', admin.resetPassword);
router.post('/ips/ban', admin.banIp);
router.delete('/ips/:ip', admin.unbanIp);

module.exports = router;
