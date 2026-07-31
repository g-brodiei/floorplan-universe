/*
 * 把模組化的原始碼打包成單一 HTML 檔。
 * 用途：想用 file:// 直接開、或丟到不方便放多個檔案的地方時使用。
 * 平常開發不需要跑這支，直接改原始碼重整就好。
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'dist', 'floorplan-editor.html');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

const order = ['schema', 'geom', 'store', 'render', 'interact', 'ui', 'tour', 'main'];
const js = order
  .map(n => `/* ===== js/${n}.js ===== */\n` + fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'))
  .join('\n');

html = html.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + css + '\n</style>');
order.forEach(n => {
  html = html.replace(`<script src="js/${n}.js"></script>\n`, '');
});
html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
console.log('已產生 ' + path.relative(root, out) + '（' + (html.length / 1024).toFixed(0) + ' KB）');
