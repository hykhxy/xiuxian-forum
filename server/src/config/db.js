const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('缺少环境变量 MONGODB_URI（参见 .env.example）');
  await mongoose.connect(uri);
  console.log('[db] MongoDB 已连接');
}

module.exports = connectDB;
