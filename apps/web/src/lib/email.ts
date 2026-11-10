const TYPOS: Record<string, string> = {
  'gmali.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.comm': 'gmail.com', 'gmail.cmo': 'gmail.com',
  'navre.com': 'naver.com', 'naevr.com': 'naver.com', 'nvaer.com': 'naver.com', 'naver.con': 'naver.com', 'naver.comm': 'naver.com',
  'daum.con': 'daum.net', 'daum.nte': 'daum.net', 'hanmail.nte': 'hanmail.net',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'hotmail.con': 'hotmail.com', 'icloud.con': 'icloud.com',
};
export function emailDomainError(value: string) {
  const suggestion = TYPOS[value.trim().toLowerCase().split('@')[1]];
  return suggestion ? `이메일 도메인에 오타가 있습니다. ${suggestion} 주소인지 확인해 주세요.` : null;
}
