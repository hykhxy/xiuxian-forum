const mongoose = require('mongoose');

// 战争（第17轮）：武斗全自动结算 / 文斗问答状态机
const teamMemberSchema = new mongoose.Schema(
  {
    position: { type: String, required: true },   // 宗主/副宗主/大长老/亲传弟子/外门弟子
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    realmLevel: Number,
    total: { atk: Number, def: Number, hp: Number, qi: Number }  // 开战快照
  },
  { _id: false }
);

const battleSchema = new mongoose.Schema(
  {
    position: String,
    rounds: [{ by: String, dmg: Number, hpA: Number, hpB: Number, forfeit: Boolean }],
    winner: { type: String, enum: ['attacker', 'defender', 'draw', null] },
    timeout: Boolean
  },
  { _id: false }
);

const debateRoundSchema = new mongoose.Schema(
  {
    question: { type: String, default: '' },
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answer: { type: String, default: '' },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    votes: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, pass: Boolean }],
    passed: { type: Boolean, default: null },       // 本轮判定（true 得分）
    winner: { type: String, enum: ['attacker', 'defender', null], default: null }
  },
  { _id: false }
);

const warSchema = new mongoose.Schema(
  {
    attackerSect: { type: mongoose.Schema.Types.ObjectId, ref: 'Sect', required: true },
    defenderSect: { type: mongoose.Schema.Types.ObjectId, ref: 'Sect', required: true },
    warType: { type: String, enum: ['武斗', '文斗'], required: true },
    status: { type: String, enum: ['准备中', '进行中', '已结束'], default: '准备中' },
    attackerTeam: [teamMemberSchema],
    defenderTeam: [teamMemberSchema],
    battles: [battleSchema],        // 武斗
    rounds: [debateRoundSchema],    // 文斗
    score: { attacker: { type: Number, default: 0 }, defender: { type: Number, default: 0 } },
    result: { type: String, enum: ['attacker', 'defender', 'draw', null], default: null },
    endedAt: Date
  },
  { timestamps: true }
);

warSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('War', warSchema);
