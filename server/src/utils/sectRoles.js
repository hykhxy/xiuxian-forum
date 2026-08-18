// 宗门职务与权限矩阵（第17轮）
const POSITIONS = ['宗主', '副宗主', '大长老', '亲传弟子', '外门弟子'];
const JOIN_DEFAULT = '外门弟子';

// 各操作允许的职务（出战/评委全员可用，不在此表）
const PERM = {
  appoint: ['宗主'],
  announce: ['宗主', '副宗主', '大长老'],
  declareWar: ['宗主', '副宗主'],
  dissolve: ['宗主']
};

// can('announce', role) → bool
function can(action, role) {
  if (!role) return false;
  return (PERM[action] || []).includes(role);
}

// 任命连带：立新宗主 → 旧宗主自动降为副宗主
function resolveAppointment(rolesMap, targetUserId, newRole) {
  if (newRole === '宗主') {
    for (const [uid, r] of rolesMap.entries()) {
      if (r === '宗主' && uid !== String(targetUserId)) rolesMap.set(uid, '副宗主');
    }
  }
}

module.exports = { POSITIONS, JOIN_DEFAULT, PERM, can, resolveAppointment };
