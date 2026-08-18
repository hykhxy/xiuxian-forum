const test = require('node:test');
const assert = require('node:assert');
const { POSITIONS, JOIN_DEFAULT, PERM, can, resolveAppointment } = require('../utils/sectRoles');

test('五职务有序', () => {
  assert.deepStrictEqual(POSITIONS, ['宗主', '副宗主', '大长老', '亲传弟子', '外门弟子']);
  assert.strictEqual(JOIN_DEFAULT, '外门弟子');
});

test('权限矩阵（按用户给定表）', () => {
  assert.strictEqual(can('appoint', '宗主'), true);
  assert.strictEqual(can('appoint', '副宗主'), false);
  assert.strictEqual(can('announce', '宗主'), true);
  assert.strictEqual(can('announce', '副宗主'), true);
  assert.strictEqual(can('announce', '大长老'), true);
  assert.strictEqual(can('announce', '亲传弟子'), false);
  assert.strictEqual(can('announce', '外门弟子'), false);
  assert.strictEqual(can('declareWar', '宗主'), true);
  assert.strictEqual(can('declareWar', '副宗主'), true);
  assert.strictEqual(can('declareWar', '大长老'), false);
  assert.strictEqual(can('dissolve', '宗主'), true);
  assert.strictEqual(can('dissolve', '副宗主'), false);
  assert.strictEqual(can('announce', null), false);
});

test('立新宗主 → 旧宗主自动降副宗主', () => {
  const roles = new Map([['u1', '宗主'], ['u2', '外门弟子']]);
  resolveAppointment(roles, 'u2', '宗主');   // 连带降级
  roles.set('u2', '宗主');                    // 调用方设置新职务（与控制器一致）
  assert.strictEqual(roles.get('u1'), '副宗主');
  assert.strictEqual(roles.get('u2'), '宗主');
});
