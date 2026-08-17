// 部署时用后端真实地址替换 config.js 中的 API_BASE_URL
// 用法：node update-api-url.js https://<后端服务名>.onrender.com/api
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target || !/^https?:\/\//.test(target)) {
  console.error('用法: node update-api-url.js https://<后端服务名>.onrender.com/api');
  process.exit(1);
}

const file = path.join(__dirname, 'js', 'config.js');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /const API_BASE_URL = .*;/,
  `const API_BASE_URL = '${target}';`
);
fs.writeFileSync(file, content);
console.log('API_BASE_URL 已更新为:', target);
