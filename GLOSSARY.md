# ultra-herdr

여러 PC의 Herdr 세션을 함께 보면서 테마, 프로젝트 표시와 클라이언트를 관리하는 맥락의 용어입니다.

## Language

**Viewing PC**:
Herdr 화면을 보고 조작하는 PC입니다. 사이드바의 테마는 이 PC가 선택한 테마입니다.
_Avoid_: 모든 세션의 테마를 결정하는 PC

**Execution PC**:
해당 대화나 명령이 실행되는 PC입니다. 터미널과 대화·코드 색상은 이 PC의 테마를 따릅니다.
_Avoid_: 현재 선택한 머신과 항상 같은 PC

**Saved settings**:
다음 실행에도 사용할 수 있도록 저장된 테마와 글꼴 등의 선택입니다. 현재 열린 창에 반영되었다는 뜻은 아닙니다.
_Avoid_: 활성화 완료

**Client activation**:
새로 여는 Herdr 클라이언트가 선택한 설치본으로 실행되도록 준비된 상태입니다. 이미 실행 중인 클라이언트나 서버의 재시작과는 다릅니다.
_Avoid_: 서버 업데이트, 실행 중 GUI 교체

**Companion release**:
ultra-herdr의 화면·입력 기능을 포함한 Herdr 클라이언트 배포본입니다. 플러그인과 독립적인 버전을 가질 수 있습니다.
_Avoid_: 플러그인 버전과 반드시 같은 배포본
