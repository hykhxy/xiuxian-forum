// 运维工具：直连指定 Atlas 节点检查主从状态
// 用法：node scripts/hello-check.js [节点序号0-2]
const mongoose = require('mongoose');
const idx = process.argv[2] || '0';
const host = `ac-8sfwhqj-shard-00-0${idx}.kwtoj7y.mongodb.net`;
const uri = `mongodb://xiuxian:xiuxian2026@${host}:27017/xiuxian-dev?tls=true&authSource=admin&directConnection=true&serverSelectionTimeoutMS=10000`;

mongoose.connect(uri).then(async () => {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  console.log(`NODE ${idx} (${host})`);
  console.log('ismaster:', hello.ismaster);
  console.log('primary:', hello.primary);
  console.log('me:', hello.me);
  process.exit(0);
}).catch((e) => { console.log(`NODE ${idx} ERR:`, e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 15000);
