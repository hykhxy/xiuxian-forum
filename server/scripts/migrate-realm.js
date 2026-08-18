// 运维脚本：第3轮境界体系数据迁移
// 旧 18 级（exp/realmLevel）→ 新 8 境界（qi/realm）
// 映射：1-9练气→1，10筑基→2，11金丹→3，12元婴→4，13化神→5，14炼虚/15合体→6，16大乘→7，17渡劫/18仙人→8
// 用法：node scripts/migrate-realm.js [dev|prod]
const mongoose = require('mongoose');

const target = process.argv[2] || 'dev';
const hosts = 'ac-8sfwhqj-shard-00-00.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-01.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-02.kwtoj7y.mongodb.net:27017';
const db = target === 'prod' ? 'xiuxian-forum' : 'xiuxian-dev';
const uri = `mongodb://xiuxian:xiuxian2026@${hosts}/${db}?tls=true&retryWrites=true&w=majority&authSource=admin`;

function mapRealm(oldLevel) {
  const lvl = Number(oldLevel) || 1;
  if (lvl <= 9) return 1;
  if (lvl === 10) return 2;
  if (lvl === 11) return 3;
  if (lvl === 12) return 4;
  if (lvl === 13) return 5;
  if (lvl <= 15) return 6;
  if (lvl === 16) return 7;
  return 8;
}

(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('users');
  const users = await col.find({}).toArray();
  let migrated = 0;
  for (const u of users) {
    const setObj = {};
    const unsetObj = {};

    if (u.qi === undefined) setObj.qi = u.exp || 0;          // 旧修为转灵气（新用户为 0）
    if (u.realm === undefined) setObj.realm = mapRealm(u.realmLevel);
    if (u.exp !== undefined) unsetObj.exp = '';
    if (u.realmLevel !== undefined) unsetObj.realmLevel = '';

    const ops = {};
    if (Object.keys(setObj).length) ops.$set = setObj;
    if (Object.keys(unsetObj).length) ops.$unset = unsetObj;
    if (!Object.keys(ops).length) continue;                  // 已迁移过

    await col.updateOne({ _id: u._id }, ops);
    migrated++;
  }
  console.log(`[${db}] 迁移完成：${migrated}/${users.length} 位用户`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
