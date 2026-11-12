// 빠른 입력 창 설정 (단축키 후보와 앱 창 로그인 읽기)

/** 차례로 시도하는 단축키. 첫 번째가 다른 프로그램에 잡혀 있으면 다음 것을 쓴다 */
const QUICK_SHORTCUTS = ['CommandOrControl+Shift+Space', 'CommandOrControl+Alt+Space', 'CommandOrControl+Shift+J'];

/** 앱 창에서 지금 로그인 토큰을 읽는다 (로그인 유지 여부에 따라 둘 중 한 곳에 있다) */
const QUICK_TOKEN_SCRIPT = "sessionStorage.getItem('devmata-session-token') || localStorage.getItem('devmata-remembered-token') || ''";

/** 트레이 메뉴에 보여 줄 단축키 이름 (예: Ctrl+Shift+Space) */
function shortcutLabel(accelerator) {
  return String(accelerator || '').replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl');
}

module.exports = { QUICK_SHORTCUTS, QUICK_TOKEN_SCRIPT, shortcutLabel };
