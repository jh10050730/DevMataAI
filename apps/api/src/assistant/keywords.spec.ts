import { extractKeywords } from './keywords';

describe('extractKeywords', () => {
  it('strips Korean particles and request words from a chat sentence', () => {
    expect(extractKeywords('리액트를 공부한 노트에서 상태관리에 관한 내용 알려줘')).toEqual(['리액트', '공부한', '노트', '상태관리']);
  });
  it('keeps short words that would become a single syllable', () => {
    expect(extractKeywords('파이 데이터베이스는')).toEqual(['파이', '데이터베이스']);
  });
  it('keeps tech terms, dedupes and lowercases', () => {
    expect(extractKeywords('NestJS와 Prisma로 API 서버, nestjs 배포 (node.js)')).toEqual(['nestjs', 'prisma', 'api', '서버', '배포', 'node.js']);
  });
  it('respects the limit and drops stopwords', () => {
    expect(extractKeywords('오늘 the 그리고 docker kubernetes redis kafka', 2)).toEqual(['docker', 'kubernetes']);
    expect(extractKeywords('오늘 뭐야?')).toEqual([]);
  });
});
