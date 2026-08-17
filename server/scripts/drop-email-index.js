// 运维脚本：清理 User 集合的历史 email 唯一索引（职业系统改造后不再使用邮箱）
// 用法：node scripts/drop-email-index.js [dev|prod]
const mongoose = require('mongoose');
const target = process.argv[2] || 'dev';
const pass = 'xiuxian2026';
const hosts = 'ac-8sfwhqj-shard-00-00.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-01.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-02.kwtoj7y.mongodb.net:27017';
const db = target === 'prod' ? 'xiuxian-forum' : 'xiuxian-dev';
const uri = `mongodb://xiuxian:${pass}@${hosts}/${db}?tls=true&retryWrites=true&w=majority&authSource=admin`;

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('users');
  const indexes = await col.indexes();
  console.log(`[${db}] 当前索引:`, indexes.map((i) => i.name).join(', '));
  const emailIdx = indexes.find((i) => i.key && i.key.email);
  if (emailIdx) {
    await col.dropIndex(emailIdx.name);
    console.log(`[${db}] 已删除索引 ${emailIdx.name}`);
  } else {
    console.log(`[${db}] 无 email 索引`);
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
