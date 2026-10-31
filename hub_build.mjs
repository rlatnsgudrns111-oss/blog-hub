// 구글이 우리 네이버 블로그 새 글을 찾게 하는 허브 페이지 생성기: node hub_build.mjs  (결과 → _site/, 미리보기용)
// 10/26 만든 이유: 블로그 홈은 구글봇에 noindex,nofollow · RSS는 봇 차단 · blog.naver.com은 서치콘솔 소유확인 불가
//   → 구글은 바깥 링크로만 새 글을 찾는다(지금화제는 blogchart 링크로 잡히고, 바깥 링크 없는 강원나우는 구글 0건).
//   우리가 소유확인할 수 있는 허브(GitHub Pages)에 모든 글 링크 + sitemap → 서치콘솔에 sitemap 제출.
// 글 목록 = 모바일 post-list API(공개·검색허용 글만), 링크 = m.blog.naver.com(구글이 색인하는 주소).
// 공개: GitHub Actions(.github/workflows/hub.yml)가 2시간마다 이 스크립트를 돌려 Pages에 배포(10/26 운영자 「A로 가」) — PC가 꺼져 있어도 갱신
import fs from 'node:fs';
const BASE = (process.env.HUB_BASE || 'https://rlatnsgudrns111-oss.github.io/blog-hub/').replace(/\/?$/, '/');
const OUT = new URL('./_site/', import.meta.url);
const GSV = process.env.GSV || ''; // 서치콘솔 HTML 태그 소유확인 값(content=…)
const BLOGS = [
  { id: 'hwaje_now', name: '지금화제', about: '방송·연예 화제를 공식 발표와 방송 내용 기준으로 정리' },
  { id: 'gangwon_now', name: '강원나우', about: '강원 18개 시·군 축제·여행·분양 정보를 공고문 기준으로 정리', text: 'https://rlatnsgudrns111-oss.github.io/gangwon-now/' }, // text = 구글·AI용 글자판 사이트(10/31 공개)
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

async function posts(id) {
  const all = [];
  for (let p = 1; p <= 40; p++) {
    const r = await fetch(`https://m.blog.naver.com/api/blogs/${id}/post-list?categoryNo=0&itemCount=30&page=${p}`, { headers: { 'user-agent': UA, referer: `https://m.blog.naver.com/${id}` } });
    const items = (await r.json()).result.items;
    if (!items.length) break;
    all.push(...items.filter(i => i.allOpenPost && i.searchYn && !i.postBlocked));
  }
  if (!all.length) throw new Error(`${id} 글 0편 — API 응답 이상, 배포 안 함(빈 목록으로 덮어쓰지 않게)`);
  return all.map(i =>({ no: String(i.logNo), t: i.titleWithInspectMessage, d: day(i.addDate), c: i.categoryName, b: (i.briefContents || '').replace(/\s+/g, ' ').slice(0, 140) }));
}

const page = (title, desc, body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">${GSV ? `<meta name="google-site-verification" content="${esc(GSV)}">` : ''}
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#222;background:#fff}a{color:#0b57d0}li{margin:0 0 14px}small{color:#666}p.b{margin:2px 0 0;color:#444;font-size:14px}</style></head><body>${body}</body></html>`;

const textLink = B => B.text ? ` · <a href="${B.text}">${B.name} 글 전문 보기(사진 없는 글자판)</a>` : '';
const site = [];
for (const B of BLOGS) {
  B.list = await posts(B.id);
  const li = B.list.map(p => `<li><a href="https://m.blog.naver.com/${B.id}/${p.no}">${esc(p.t)}</a> <small>${p.d} · ${esc(p.c)}</small><p class="b">${esc(p.b)}…</p></li>`).join('\n');
  site.push([`${B.id}.html`, page(`${B.name} 전체 글 목록`, `${B.name}(네이버 블로그) — ${B.about}. 전체 ${B.list.length}편.`,
    `<h1>${B.name} 전체 글</h1><p>${esc(B.about)}. <a href="https://blog.naver.com/${B.id}">블로그 바로가기</a>${textLink(B)} · <a href="./">처음으로</a></p><ol>\n${li}\n</ol>`), B.list[0]?.d]);
}
const latest = B => B.list.slice(0, 10).map(p => `<li><a href="https://m.blog.naver.com/${B.id}/${p.no}">${esc(p.t)}</a> <small>${p.d}</small></li>`).join('\n');
site.unshift(['index.html', page('지금화제 · 강원나우 블로그 글 모음', '네이버 블로그 지금화제와 강원나우의 새 글 목록', `<h1>블로그 글 모음</h1>` +
  BLOGS.map(B => `<h2><a href="${B.id}.html">${B.name}</a></h2><p>${esc(B.about)}. 전체 ${B.list.length}편.${textLink(B)}</p><ol>\n${latest(B)}\n</ol><p><a href="${B.id}.html">${B.name} 전체 글 보기 →</a></p>`).join('')),
  BLOGS.map(B => B.list[0]?.d).sort().pop()]);

fs.mkdirSync(OUT, { recursive: true });
for (const [f, html] of site) fs.writeFileSync(new URL(f, OUT), html);
fs.writeFileSync(new URL('sitemap.xml', OUT), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  site.map(([f, , d]) => `<url><loc>${BASE}${f === 'index.html' ? '' : f}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(new URL('.nojekyll', OUT), '');
fs.writeFileSync(new URL('google1c77007b912eef19.html', OUT), 'google-site-verification: google1c77007b912eef19.html'); // 서치콘솔 소유확인(10/26) — 지우면 확인 풀림
console.log('허브 생성:', BLOGS.map(B => `${B.name} ${B.list.length}편(최신 ${B.list[0]?.d})`).join(' · '), '→', OUT.pathname);
