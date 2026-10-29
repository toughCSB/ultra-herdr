# 구조 개선의 범위와 검증

Codex와 `claude-opus-5-5`의 초기 교차 검토에서 다음 순서로 범위를 확정했습니다.

1. 테마 정의의 locality: 현재 출력값을 고정하고 색상·OMO 값·밝기 의미를 `themes.mjs`에 모읍니다.
2. 적용 module의 depth: 준비·검증·파일 교체·복구와 외부 활성화를 구분합니다.
3. 클라이언트 활성화: 모든 설정을 준비한 뒤 안정 포인터를 마지막에 전환합니다.
4. native 릴리스 검증: 고정 upstream·누적 patch·native 검사·배포 asset hash를 추적합니다.

## 보존할 동작

- Viewing PC의 사이드바와 Execution PC의 터미널 색상 소유권을 유지합니다.
- Blue/Pink/Red/Brown의 출력 색상, 전체 선택 배경, 상태 의미색과 provider 색을 유지합니다.
- 보관함, CJK 인식, native renderer와 frozen wire 계약은 변경하지 않습니다.
- plugin과 companion의 독립 버전 관리를 유지합니다. 최초 구조 검증 기준은 plugin 3.0.28과 companion 3.0.27이며, 통합 정식 배포는 3.0.29입니다.
- 기존 서버·대화·클라이언트 프로세스를 종료하지 않습니다.
- Windows Terminal과 바로가기는 직접 binary 경로를 유지합니다. PowerShell의 공식 CLI 라우팅과 server-stop 보호도 유지합니다.

## 준비, 파일 저장, 활성화

`files.mjs`의 interface는 읽은 원문을 기준으로 변경을 준비하고 외부 편집을 검사합니다.
테마 적용은 Herdr와 Ghostty의 임시 설정을 검증한 뒤 파일을 교체합니다.
파일 교체 실패 시 역순으로 복구하되, 현재 내용이 이번 작업이 쓴 내용과 다르면 새 편집을 보존하고 복구 충돌을 보고합니다.
각 파일의 mode를 유지하며 기존 설정 symlink의 실제 대상을 갱신합니다.

여러 파일과 외부 창을 하나의 원자적 작업으로 보장하지 않습니다.
파일 저장이 끝나면 GUI·server reload·metadata·activity를 각각 시도합니다.
실패에는 `persisted=true`, `failed` 단계 목록이 있으며, 같은 설정을 다시 적용할 수 있습니다.
창이 없어도 OMO·Markdown·상태 설정 저장을 중단하지 않습니다.

Windows shortcut은 파일 저장 뒤의 COM 동작입니다. 실패하면 포인터와 Terminal 설정은 유지하고 shortcut 실패를 명시합니다.
클라이언트 활성화 확인과 실제 GUI 재실행 확인은 구분합니다.

## 검증

```sh
npm test
npm run check
```

`theme-outputs.test.mjs`는 리팩터 전 `8dad0b6`의 네 테마 출력 hash를 고정합니다.
`application.test.mjs`와 `activation.test.mjs`는 임시 파일로 검증·쓰기·복구 충돌·GUI·shortcut 실패와 재시도를 검사합니다.
실제 사용자 설정이나 실행 중인 Herdr 서버에 테스트 명령을 보내지 않습니다.

## native 릴리스 검증

```sh
ZIG=/path/to/zig-0.16.0/zig node release-check.mjs \
  --source /path/to/local-herdr-git-clone \
  --assets-dir /path/to/released-archives
```

원본 checkout을 변경하지 않고 OS 임시 디렉터리의 새 clone에만 pinned commit과 patch를 적용합니다.
`--source`를 생략하면 manifest의 공식 저장소를 clone합니다.
`--workdir PARENT`는 새 검증 디렉터리의 부모, `--target-dir CACHE`는 선택적인 Cargo cache입니다.
검사 로그·toolchain 버전·결과는 새 디렉터리의 `report.json`에 남깁니다.
test HOME과 Herdr 관련 환경을 분리하며 서버·GUI를 시작하지 않습니다.

- `--prepare-only`: source/patch 준비와 asset 대조만 수행합니다.
- `--skip-build`: native test를 수행하되 release build는 건너뜁니다.
- `--download-assets`: 로컬 archive 대신 이미 배포된 archive를 내려받아 manifest hash와 비교합니다.
- 종료 코드 `0`: 모든 검사 통과, `1`: 실패, `3`: 통과한 검사와 명시적 건너뜀이 함께 있음.
- 다른 OS의 conditional native build는 해당 OS에서 별도로 검사해야 하며 통과로 표시하지 않습니다.

기존 배포 archive의 hash 일치는 입력 파일 검증입니다. 새 빌드가 기존 archive와 바이트 단위로 같거나, 과거 archive가 이 source로 만들어졌음을 증명하는 attestation은 아닙니다.
patch와 기존 asset을 변경하지 않으며 검증 중 생성한 binary를 설치하거나 배포하지 않습니다.

## 2026-10-27 검증 결과

- Opus 5.5의 초기 검토, 적용 코드 재검토, 최종 네 단계 검토를 진행했습니다.
- 최종 검토의 조건은 잘못된 staged config가 실제 Herdr에서 거부되는지 확인하는 것이었으며, Herdr와 Ghostty 모두 정상 파일은 종료 코드 0, 잘못된 파일은 종료 코드 1로 확인했습니다.
- Node 검사: 111개 통과, 실패 0, Windows 실행 전용 1개 건너뜀. 문법 검사와 diff 공백 검사 통과.
- 네 테마의 Herdr·OMO·Terminal·Markdown·sidebar·workspace metadata 출력은 리팩터 전 hash와 일치합니다.
- 공식 v0.9.5의 고정 commit에 기존 누적 patch를 새 clone에서 적용했습니다.
- native 검사: 보관함 25개, 활동 우선 정렬 9개, sidebar 상태 8개, clipboard 16개 통과. 필터 간 중복은 있을 수 있습니다.
- Mac release build 통과. 기존 Mac·Windows archive 두 개의 hash가 manifest와 일치합니다.
- native 검증의 종료 코드 3은 Windows 호스트 빌드가 미수행이라는 명시적 건너뜀 때문입니다. 실제 Cargo/Rust 버전은 1.94.0, Zig는 0.16.0으로 기록됐습니다.
- Windows의 실제 Terminal/profile rename·COM shortcut·PowerShell 실행 검증과 GUI 재실행은 수행하지 않았습니다.
- 현재 결과는 로컬 source 변경입니다. 실제 설치본 업데이트, 버전 인상, commit, push, release, 기기 배포는 이 검증에 포함하지 않습니다.
