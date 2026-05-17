const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf-8');

/* ─── 1. CSS 추출 ─── */
const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
if (!cssMatch) { console.error('CSS not found'); process.exit(1); }
fs.mkdirSync(path.resolve(__dirname, '../src/styles'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, '../src/styles/slides.css'), cssMatch[1].trim() + '\n');
console.log('✓ src/styles/slides.css');

/* ─── 2. 슬라이드 HTML 추출 ─── */
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
if (!bodyMatch) { console.error('body not found'); process.exit(1); }
const body = bodyMatch[1];

const slides = [];
let pos = 0;
while (pos < body.length) {
  const start = body.indexOf('<div class="slide', pos);
  if (start === -1) break;

  // depth counting으로 closing </div> 찾기
  let depth = 0, i = start;
  while (i < body.length) {
    if (body[i] === '<') {
      if (body.startsWith('</div>', i)) {
        depth--;
        if (depth === 0) { slides.push(body.slice(start, i + 6)); pos = i + 6; break; }
        i += 6; continue;
      } else if (body.startsWith('<div', i)) {
        depth++;
      }
    }
    i++;
  }
  if (depth !== 0) break;
}

console.log(`✓ 슬라이드 ${slides.length}개 발견`);

fs.mkdirSync(path.resolve(__dirname, '../src/slides'), { recursive: true });
slides.forEach((slideHtml, idx) => {
  const n = String(idx + 1).padStart(2, '0');
  fs.writeFileSync(path.resolve(__dirname, `../src/slides/${n}.html`), slideHtml.trim() + '\n');
});

console.log('✓ src/slides/01.html ~ ' + String(slides.length).padStart(2,'0') + '.html');
console.log('\n완료! 이제 src/index.html은 더 이상 App.tsx에서 사용되지 않습니다.');
