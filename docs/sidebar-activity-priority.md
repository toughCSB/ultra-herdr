# 머신·프로젝트·세션 활동 우선 정렬

목표는 여러 PC의 진행 작업과 확인 요청을 스크롤로 찾아다니는 시간을 줄이는 것이다.
사이드바는 보는 PC의 ultra-herdr 설정으로 제어하고 서버·세션의 저장 순서는 변경하지 않는다.
Codex HUD 실행기는 companion의 프로세스 인식 및 실제 footer 감지 규칙으로 지원한다.

## 동작

- 기본 우선순위: Blocked → 아직 보지 않은 Done → Working → Idle → Unknown.
- 머신은 내부 세션 중 가장 높은 우선순위를 기준으로 정렬한다. 인증·연결 오류도 확인 대상으로 올린다.
- 프로젝트 묶음과 worktree 부모·자식 구조는 보존한다. 접힌 프로젝트 내부 상태도 정렬에 포함한다.
- Idle은 마지막 실제 작업 시각의 내림차순으로 정렬한다. 출력량·스피너 프레임·단순 선택은 순서에 영향을 주지 않는다.
- 기본 세션 목록은 `active · priority`로 전체 세션의 우선순위를 따른다. `active · grouped`를 직접 선택하면 프로젝트 묶음을 보존한다.
- `ultra_last_work_ms` metadata는 작업 시작·종료 전환 때 저장한다. 저장값이 없는 기존 세션은 서버의 상태 변경 순서를 사용한다.
- 머신 오른쪽에 테마별 기존 상태색으로 `▲1 ▶2 ✔1`처럼 상태별 개수를 표시한다.
  좁은 사이드바에서는 우선순위가 가장 높은 아이콘부터 남긴다. 기존 연결·인증 배지는 별도로 유지한다.
- 연결이 끊긴 머신의 과거 Working·Done 캐시는 현재 진행 상태로 표시하지 않는다.
- Done 확인 후 Idle로 바뀌는 기존 client lifecycle projection을 사용한다.
- 현재 선택한 섹션의 전체 배경, 글자·아이콘 색상, 터미널 본문·폰트는 유지한다.
- 사용자/플러그인이 명시한 별도 Agent View의 필터와 정렬은 존중한다.

제어 파일: ultra-herdr가 생성하는 `sidebar-status.json`의 `activity_priority: true`.
기존 파일에는 이 필드가 없어도 정상적으로 이전 동작을 유지한다.

## 참고한 사례와 적용 범위

- [cmux](https://github.com/manaflow-ai/cmux): 상위 탭의 알림 배지와 pane 표시로 확인이 필요한 위치를 드러낸다.
  이를 머신 헤더의 상태별 아이콘·개수에 적용한다. 별도 세션 복제나 새 작업창은 만들지 않는다.
- [VS Code Test Explorer](https://code.visualstudio.com/docs/debugtest/testing): 트리 구조와 상태별 필터/정렬을 함께 제공한다.
  프로젝트 계층은 유지하면서 활동 순서를 적용하는 근거로 삼는다.
- [JetBrains Services](https://www.jetbrains.com/help/idea/services-tool-window.html): 여러 실행 대상을 하나의 트리로 모으고 연결 상태를 표시한다.
  머신의 연결 상태와 내부 작업 상태를 각각 읽을 수 있도록 구분한다.

추가 제안: 이후 필요하면 `확인 필요·실행 중만 보기` 필터를 추가할 수 있다.
이번 변경은 자동 정렬과 머신 상태 요약에 집중한다.
