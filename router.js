const Router = require('koa-router');
const update = require('./hookUpdate');

const router = new Router();

module.exports = router.post('/fe_share_update', update);