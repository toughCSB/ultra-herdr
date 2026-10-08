# Herdr 0.9.1 companion client

v3.0.20의 전체 source patch는 `herdr-0.9.1-ultra-3.0.20.patch`입니다.
공식 v0.9.1에 한 번만 적용하며 이전 전체 patch와 중복 적용하지 않습니다.
사용자 화면 검토를 반영해 3.0.19의 글자별 배지 배경을 없애고, 상태 글자/아이콘의
원래 테마 색을 복원합니다. 강조는 더 선명한 상태 행 배경과 굵은 채움 아이콘에
적용합니다. 선택은 왼쪽 테마색 선/`›`로 구분해 상태 행 배경을 가리지 않습니다.
관리 JSON은 version 2이며 아이콘 색과 상태 글자색을 분리합니다. 일반 글자의 대비
보정은 유지하되 원래 상태 색상은 그대로 보존합니다. 서버·wire·TOML schema는 유지합니다.

아래는 이전 버전 참고입니다.

v3.0.19의 전체 source patch는 `herdr-0.9.1-ultra-3.0.19.patch`입니다.
공식 v0.9.1에 한 번만 적용하며 이전 전체 patch와 중복 적용하지 않습니다.
3.0.18의 대화·코드·Markdown 대비 수정을 포함하고, 로컬 플러그인이 관리하는
`plugins/config/local.ultra-herdr/sidebar-status.json`에서 상태별 배지와 행 배경을
읽습니다. 파일은 시작/설정 갱신 시에만 읽으며 렌더 루프에서 파일 I/O를 하지 않습니다.
선택 배경이 상태 배지를 덮지 않도록 렌더 순서를 조정하고, 좁은 목록에서도 상태
문구에 공간을 먼저 배정합니다. API/config TOML/wire schema와 서버는 변경하지 않습니다.
새 설정 파일이 없거나 다른 테마의 오래된 파일이면 기존 표시로 돌아갑니다.
검증은 세 테마 × 다섯 상태 × 선택/미선택 × 로컬/원격 × 24/32/36열, workspace와
접힌 목록, Done→Idle 확인 처리, 원격 terminal/local sidebar 색상 분리를 포함합니다.

아래는 이전 버전 참고입니다.

v3.0.18의 전체 source patch는 `herdr-0.9.1-ultra-3.0.18.patch`입니다.
Blue/RED의 어두운 terminal에도 palette 기반 대비 보정을 적용합니다. 실행 PC
배경과 반대 밝기의 오래된 palette는 무시합니다. 실제 Glow 3.0.0 Markdown 본문·표·
코드 출력 및 SV Claude 출력 재생 검사를 포함합니다. 아래 patch와 중복 적용하지 않습니다.

v3.0.16의 전체 source patch는 `herdr-0.9.1-ultra-3.0.16.patch`입니다.
한글/CJK의 보이지 않는 두 번째 칸이 retained update에서 기본 배경으로 초기화되는
경우에도 메시지 인식을 유지하며, 명시적인 메시지 배경의 빈 여백을 포함합니다.
원본 PTY와 wire schema는 변경하지 않습니다. 아래 3.0.15 설명은 이전 버전 참고입니다.

v3.0.15의 전체 source patch는 `herdr-0.9.1-ultra-3.0.15.patch`입니다.
공식 v0.9.1 기반 위에 적용하며 이전 patch와 중복 적용하지 않습니다.
기존 sidebar/원격 테마 분리를 유지하고, 플러그인의 `ultra_user_message_*`,
`ultra_code_block_*` workspace tokens로 대화창과 코드블럭을 표시합니다.
원본 PTY cells, 서버, wire schema는 유지합니다. 색상 변경은 최종 클라이언트 합성에만
적용하고 선택 영역은 그 위에 표시합니다. 부분 frame은 경계 변경에 맞춰 재합성합니다.

아래는 3.0.14 및 초기 Pink patch 참고 설명입니다.


v3.0.14의 전체 source patch는 `herdr-0.9.1-ultra-3.0.14.patch`입니다.
기존 sidebar 수정, 실행 PC terminal 색상 전달, 밝은 테마의 중립색 보정과
스크롤 patch/전체 frame 색상 일치를 포함합니다. 서버와 wire schema는 바꾸지 않습니다.
플러그인 매니저는 release binary를 검증해 설치하므로 일반 사용자는 직접 빌드할 필요가 없습니다.
아래 sidebar-only 안내와 이전 patch는 이전 버전 참고용입니다.

이 renderer 패치는 ultra-herdr Pink 사이드바 `#ffebea`와 선택 행 `#febab9`의
일반 sidebar 글자를 `#480d30`으로 표시합니다. 알려진 provider 고유색과
Working 외 상태 아이콘의 색은 유지하고 상태 glyph는 채운 원형 `●`로 표시합니다.
Pink Working 아이콘·문구·activity 마커는 팔레트의 진한 주황색 `#d65a00`을 사용하며,
done/idle은 진한 녹색 `#168a45`를 사용합니다. mobile header,
switcher, navigator overlay는 원래 아이콘을 유지합니다.
Herdr 0.9.1 전용 companion 클라이언트가 필요합니다.

- 기반: 공식 `herdrdev/herdr` 태그 `v0.9.1`
- commit: `065ef9d6a531c49fb8bee7e818ef837065b21ee9`
- 범위: 클라이언트 사이드바 렌더링과 회귀 테스트
- 서버 코드, 설정 스키마, 통신 프로토콜 변경 없음
- 적용 조건: sidebar background `#ffebea`; 선택 행 색상은 renderer에서 `#febab9`로 제한 적용

Stock Herdr 0.9.1에는 sidebar chrome의 text foreground를 별도로 지정하는
설정이 없습니다. 플러그인은 provider fallback/brand rules 및 data token 색을
설정하고 이 patch가 section headings/buttons/separators를 보정합니다.

공식 소스의 빌드 안내에 따라 Rust와 Zig 0.16.0을 준비한 뒤:

```sh
git apply /path/to/herdr-0.9.1-ultra-pink.patch
cargo test --locked --bin herdr ultra_pink_sidebar_darks_chrome_and_colors_working_icons
cargo test --locked --bin herdr client::shell::tests::
cargo build --release --locked
```

실행 파일은 공식 Herdr와 별도 폴더에 보관합니다. Windows에서는 공식
0.9.1 실행 파일 폴더의 ConPTY DLL·OpenConsole·라이선스도 함께 보관합니다.
기존 서버를 종료하거나 교체하지 않고 새 클라이언트만 연결합니다.
원본 실행 파일과 기존 실행기 설정 백업을 보존합니다.

이 패치는 0.9.1 전용입니다. 다른 Herdr 버전으로 옮길 때는 다시 검증해야
합니다. Herdr 본체와 이 파생 패치는 원본의 Apache-2.0 라이선스를 따릅니다.
