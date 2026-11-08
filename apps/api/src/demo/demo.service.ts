import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { koreanDayStart } from '../news/news.schedule';

const DAY = 86400000;
const HOUR = 3600000;

/** 화면 둘러보기용 샘플 데이터. 모두 isDemo=true 로 저장해 실제 데이터와 구분하고 한 번에 지울 수 있다. */
@Injectable()
export class DemoService {
  constructor(private readonly db: PrismaService) {}

  async status(userId: string) {
    const where = { userId, isDemo: true };
    const [tasks, events, notes] = await Promise.all([this.db.task.count({ where }), this.db.event.count({ where }), this.db.studyNote.count({ where })]);
    return { tasks, events, notes, total: tasks + events + notes };
  }

  async create(userId: string) {
    if ((await this.status(userId)).total) throw new ConflictException('이미 데모 데이터가 있습니다. 먼저 삭제한 뒤 다시 추가하세요.');
    const now = new Date();
    const today = koreanDayStart(now).getTime(); // 한국 시간 오늘 0시
    const at = (days: number, hours = 0) => new Date(today + days * DAY + hours * HOUR);
    const base = { userId, isDemo: true };
    await this.db.$transaction([
      this.db.task.createMany({ data: [
        { ...base, title: 'React 상태 관리 정리', description: 'useState·useReducer·Context 차이를 노트로 정리', priority: 'HIGH', category: 'STUDY', dueDate: at(0, 23) },
        { ...base, title: '운영체제 과제 제출', description: '스케줄링 알고리즘 비교 보고서', priority: 'URGENT', category: 'SCHOOL', dueDate: at(-1, 23) },
        { ...base, title: 'API 테스트 보강', description: '할 일·일정 권한 테스트 추가', priority: 'MEDIUM', category: 'DEV', dueDate: at(2, 18) },
        { ...base, title: '헬스장 등록하기', priority: 'LOW', category: 'PERSONAL' },
        { ...base, title: '지난주 회고 작성', priority: 'MEDIUM', category: 'GENERAL', dueDate: at(-1, 21), completed: true, completedAt: at(-1, 20) },
      ] }),
      this.db.event.createMany({ data: [
        { ...base, title: '알고리즘 스터디', location: '도서관 3층', category: 'STUDY', startAt: at(0, 10), endAt: at(0, 11) },
        { ...base, title: '팀 프로젝트 회의', description: '이번 주 진행 상황 공유', category: 'DEV', startAt: at(0, 14), endAt: at(0, 15.5) },
        { ...base, title: '자료구조 복습', category: 'STUDY', startAt: at(1, 19), endAt: at(1, 21) },
        { ...base, title: '중간고사', category: 'SCHOOL', allDay: true, startAt: at(3), endAt: at(4) },
      ] }),
      this.db.studyNote.createMany({ data: [
        { ...base, title: 'React Hooks 기본', tags: JSON.stringify(['react', 'frontend']), progress: 40,
          content: '# React Hooks 기본\n\n## useState\n컴포넌트의 상태를 저장한다. 값이 바뀌면 다시 렌더링된다.\n\n## useEffect\n렌더링 후 실행할 작업(데이터 불러오기, 구독)을 등록한다.\n\n```tsx\nuseEffect(() => {\n  const id = setInterval(tick, 1000);\n  return () => clearInterval(id);\n}, []);\n```\n' },
        { ...base, title: '프로세스와 스레드', tags: JSON.stringify(['운영체제', 'cs']), progress: 70, reviewCount: 1, lastStudiedAt: at(-2, 20), nextReviewAt: at(1, 20),
          content: '# 프로세스와 스레드\n\n- **프로세스**: 실행 중인 프로그램. 독립된 메모리 공간을 가진다.\n- **스레드**: 프로세스 안의 실행 흐름. 같은 프로세스의 메모리를 공유한다.\n\n> 스레드는 만들고 전환하는 비용이 프로세스보다 작지만 공유 자원 동기화가 필요하다.\n' },
        { ...base, title: 'SQL JOIN 정리', tags: JSON.stringify(['database', 'sql']), progress: 20, reviewCount: 1, lastStudiedAt: at(-5, 21), nextReviewAt: at(-1, 21),
          content: '# SQL JOIN 정리\n\n| 종류 | 결과 |\n|---|---|\n| INNER JOIN | 양쪽 모두 일치하는 행 |\n| LEFT JOIN | 왼쪽 전체 + 일치하는 오른쪽 |\n| RIGHT JOIN | 오른쪽 전체 + 일치하는 왼쪽 |\n' },
      ] }),
    ]);
    return this.status(userId);
  }

  async remove(userId: string) {
    const where = { userId, isDemo: true };
    const [tasks, events, notes] = await this.db.$transaction([
      this.db.task.deleteMany({ where }), this.db.event.deleteMany({ where }), this.db.studyNote.deleteMany({ where }),
    ]);
    return { tasks: tasks.count, events: events.count, notes: notes.count, total: tasks.count + events.count + notes.count };
  }
}
