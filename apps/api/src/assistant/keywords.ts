// 한국어 조사·어미를 떼고 검색에 쓸 만한 키워드만 남긴다. (형태소 분석기 없이 쓰는 가벼운 규칙)
const PARTICLES = ['에서부터', '으로부터', '로부터', '에서는', '에게서', '까지는', '부터는', '이라는', '라는', '에서', '에게', '한테', '으로', '까지', '부터', '처럼', '보다', '이랑', '하고', '이나', '에는', '에도', '와의', '과의', '은', '는', '이', '가', '을', '를', '에', '의', '도', '만', '로', '와', '과', '랑', '나'];
const STOPWORDS = new Set([
  '오늘', '내일', '어제', '이번', '지금', '최근', '관련', '관한', '대한', '대해', '위한', '있는', '없는', '하는', '했던', '그리고', '그런데', '하지만', '어떻게', '어떤', '무엇', '뭐야', '뭐지', '뭔가', '언제', '어디', '누가', '얼마나',
  '알려줘', '알려주세요', '보여줘', '보여주세요', '찾아줘', '정리해줘', '요약해줘', '추천해줘', '해줘', '해주세요', '해야', '할까', '있어', '있나', '있을까', '좀', '그거', '이거', '저거', '모든', '전체', '목록', '내용', '정도',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'how', 'are', 'was', 'you', 'can', 'about', 'into', 'show', 'tell',
]);

function stripParticle(word: string) {
  for (const p of PARTICLES) if (word.length - p.length >= 2 && word.endsWith(p)) return word.slice(0, -p.length);
  return word;
}

export function extractKeywords(text: string, limit = 8) {
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}|[가-힣]{2,}/g) ?? [];
  const out: string[] = [];
  for (const raw of words) {
    const word = /[가-힣]/.test(raw) ? stripParticle(raw) : raw.replace(/[.-]+$/, '');
    if (word.length < 2 || STOPWORDS.has(word) || out.includes(word)) continue;
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}
