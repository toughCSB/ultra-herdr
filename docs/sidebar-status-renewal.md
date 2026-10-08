# 사이드바 상태 리뉴얼 확정안

기준 코드: `dc938946b193925ac2bfb1fc0a11be612be49d2c` (3.0.18).
리뉴얼 전 플러그인 코드와 companion client 전체 source patch가 이 commit에 보존되어 있다.

## 표시 규칙

| 상태 | 아이콘 | 의미 | 강조 |
| --- | --- | --- | --- |
| Idle | ○ | 입력 대기 / 답변 확인 완료 | 중립 회색, 기본 행 배경 |
| Working | ◔ | 처리 중 | 노랑/주황 배지, 옅은 행 배경 |
| Blocked | ! | 승인 또는 답변 필요 | 빨강 배지, 옅은 행 배경 |
| Done | ✓ | 새 답변 완료 / 확인 대기 | 에메랄드 배지, 옅은 행 배경 |
| Unknown | ? | 상태 판별 불가 | 중립색, 완료와 구분 |

세 테마에서 의미와 아이콘을 통일하고 밝기에 맞춰 foreground와 배지 배경을 조정한다.
행 앞에 상태색 세로선을 표시한다. 선택한 행의 첫 칸은 `›`로 표시하고 기존 테마의
선택 배경을 우선한다. 선택된 행에서도 상태 배지의 foreground/background는 유지한다.
행 배경은 상태 foreground를 기존 sidebar 배경에 12% 섞는다. Idle/Unknown은 기본 배경을 유지한다.

상태는 실제 Herdr lifecycle projection을 따른다. Done을 확인하면 Idle로 바뀌며,
프로젝트 전체 완료나 테스트 성공으로 단정하지 않는다. 기존 프로젝트 그룹과 정렬은 유지한다.

## 색상

Blue/Red 배지: Idle `#c7d2e0` / `#354252`, Working `#fcd34d` / `#493614`,
Blocked `#fda4af` / `#50212b`, Done `#6ee7b7` / `#103d30`.
Pink 배지: Idle `#604f5a` / `#f0e4e9`, Working `#914600` / `#fff0d3`,
Blocked `#a61b29` / `#ffe0e5`, Done `#116c46` / `#dcf5e7`.

제안 시안의 배지/본문/선택 글자 최소 대비: Red 5.20:1, Blue 4.78:1, Pink 5.61:1.
리뉴얼 구현에서도 실제 native render 결과로 이 기준을 검증한다.

## 제어와 보존 범위

색상과 아이콘은 ultra-herdr의 테마 데이터에서 관리한다. native companion client는
로컬 플러그인 설정에서 읽어 client presentation에만 적용한다. 렌더 루프에서 파일을 읽지 않는다.
서버/API/wire schema, 에이전트 상태 감지와 확인 처리, terminal 본문 및 코드블럭,
글꼴, provider identity는 변경하지 않는다. sidebar는 보는 PC의 테마를 유지한다.

## 검증

세 테마의 모든 상태 × 선택/미선택, 로컬/원격 workspace·agent 목록, collapsed 목록,
Done→Idle 갱신과 선택 표시를 검증한다. native renderer를 통해 글자/배지 대비와
프로젝트 구성을 확인하고, 1/15개 항목의 반복 렌더 및 현재 안정판 대비 성능을 확인한다.
Mac/SV/HOME에 접근 가능한 범위에서 설치·실행 결과를 각각 기록한다.

참고: [GitHub Primer](https://primer.style/product/ui-patterns/notification-messaging/),
[VS Code Theme Color](https://code.visualstudio.com/api/references/theme-color),
[W3C Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

## 3.0.19 검증 결과

리뉴얼 전 기준 상태와 이 확정안은 `fcf9319`로 먼저 커밋했다.
플러그인 테스트 83개와 syntax check, Mac shell 테스트 311개 및 protocol 테스트
146개, Windows shell 테스트 309개 및 protocol 테스트 145개가 통과했다.
각 플랫폼의 shell 테스트 3개는 기존 ignored 항목이다.
실제 native Buffer의 모든 일반 글자와 상태 배지에서 대비 4.5:1 이상을 검증했다.
provider 로고와 장식 구분선은 이 텍스트 대비 보정에서 제외한다.

실제 renderer의 합성 데이터를 별도 뷰어에 표시하여 Blue/Pink/Red의 선택/미선택,
한글 폭, provider 로고, 다섯 상태를 확인했다. 이 확인은 실제 사용자 창의 캡처가 아니다.
고정 32×60 사이드바에 1개/15개 행을 반복 렌더링했고, 기존 3.0.18 대비 release
performance smoke(두 라운드, 각 10초 샘플)가 통과했다. hidden50은 7.580→7.580
CPU points, visible30은 3.415→3.170이었다. 짧은 샘플의 성능 점검이며 장기 측정은 아니다.
