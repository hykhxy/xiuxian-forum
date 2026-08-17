require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] 灵脉已开启：http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[server] 启动失败：', err.message);
    process.exit(1);
  });
