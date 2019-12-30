const Koa = require('koa');
const router = require('./router');
const cors = require('koa2-cors');
const app = new Koa();

// cors
app.use(cors());

// router
app.use(router.routes());

// error solver 
app.on('error', err => {
  console.error("error:", err);
});

app.listen(4550);