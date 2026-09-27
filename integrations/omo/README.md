# OMO / Senpi 상태 reporter (선택 설치)

이 디렉터리는 `ultra-herdr` 본체와 분리된 선택적 OMO/Senpi reporter입니다. Herdr
sidebar에서 OMO 작업의 실제 상태를 더 잘 보이게 하려는 경우에만 설치하세요.

검증 기준은 **Herdr 0.9.1**, **OMO 5.0.0-beta.90**입니다. 다른 버전의 OMO/Senpi
내부 이벤트 계약은 호환을 보장하지 않습니다.

> [!IMPORTANT]
> 이 reporter는 설치한 **로컬 HOST**의 OMO만 보고합니다. 원격 workspace를 보는
> viewer PC에 투명하게 설치되거나 실행되지 않습니다. Herdr 0.9.1 plugin action은
> remote workspace에서는 그 원격 HOST에서 실행됩니다.

## 제공하는 보고

reporter는 화면 문자열을 폴링하거나 `working`을 영구 고정하지 않습니다. 다음의 실제
Senpi lifecycle 이벤트를 받아 상태를 갱신합니다.

- turn
- blocked
- children
- monitor
- settled
- quit

Herdr에는 `custom:senpi`, agent `omo`로 보고합니다. 따라서 OMO/Senpi를 native Pi
세션으로 가장하지 않습니다. native Pi resume, `agent explain`, 또는 Pi 내부 기능과의
호환을 약속하지 않으며, 실행 중 세션의 live inspector를 열거나 침습적으로 검사하라고
안내하지 않습니다.

## 설치

1. 이 저장소에서 reporter의 **동일 basename인 `.js`와 `.mjs` 파일을 모두** OMO가
   사용하는 agent-extension 디렉터리에 함께 설치합니다. `.mjs`만 복사하면 안 됩니다.
   파일명을 임의로 바꾸거나 둘을 서로 다른 디렉터리에 두지 마세요.
2. `.js`는 OMO 5.0.0-beta.90의 자동 발견용 entrypoint이고 `.mjs`를 export합니다.
   beta.90은 standalone `.mjs`를 자동 발견하지 않으므로 이 wrapper가 필수입니다.
3. 두 파일은 설치된 Senpi CLI의 **실제 경로**를 기준으로 Senpi 내부 모듈을 import합니다.
   저장소 복제 경로나 현재 작업 디렉터리를 가정하지 않습니다. OMO/Senpi CLI가 없는
   PC에 reporter 파일만 복사해도 동작하지 않습니다.
4. OMO 설정에서 이 extension을 활성화합니다. 이 단계는 OMO의 설치 경로와 사용자
   설정에 따르므로, 기존 OMO extension 설정을 덮어쓰지 말고 백업 후 병합하세요.

설치 후에는 idle 상태에서 OMO 설정을 안전하게 reload하거나 새 OMO 세션을 시작하세요.
실행 중인 turn을 강제로 재시작하거나 reporter가 붙었다는 이유만으로 live 세션을
재구성하지 마세요. 기존 세션은 안전한 idle reload 경계를 기다릴 수 있고, 새 세션이
정상 발견되는지와 현재 세션이 즉시 바뀌는지를 구분해 확인해야 합니다.

## 확인 방법

1. 새 로컬 OMO/Senpi 세션을 시작합니다.
2. 실제 turn을 실행해 Herdr의 agent가 `custom:senpi` / `omo`로 나타나는지 봅니다.
3. 입력/승인이 필요한 실제 상황에서 `blocked`, 자식 작업 또는 monitor가 실제로
   보고되는 상황에서 그 상태 변화를 확인합니다.
4. 작업이 settled되거나 세션이 quit될 때 `working`이 남아 있지 않은지 확인합니다.
5. 원격 workspace를 viewer로 보고 있다면 상태와 ANSI 색은 원격 HOST의 것이며,
   viewer PC에서 reporter 또는 테마가 실행된 것처럼 판단하지 않습니다.

`unknown`은 reporter의 실패를 뜻할 수도 있지만, 먼저 실제 agent lifecycle 이벤트와
Herdr pane 정보를 대조하세요. 한 번 `working`을 보았다는 사실만으로 지속적인 상태
복구를 입증하지 않습니다.

## 제한 사항

- OMO 메시지·도구 박스의 Blue / Pink / RED 색은 `ultra-herdr`를 설치한 로컬 HOST의
  사용자 테마만 변경합니다.
- 원격 agent가 출력하는 ANSI 색은 원격 HOST가 결정하며 reporter가 변경하지 않습니다.
- Codex, Claude 등 임의의 CLI 내부 박스를 다시 칠하지 않습니다.
- 이 integration은 테마 플러그인의 필수 구성요소가 아니며, 설치하지 않아도
  `ultra-herdr`의 목록·배지·글꼴 기능은 동작합니다.

## 업데이트와 제거

업데이트 전 OMO 설정과 설치한 `.js`/`.mjs` reporter 쌍을 백업합니다. 두 파일은 항상
같은 버전으로 함께 교체하세요. 제거할 때도 OMO 설정에서 extension을 먼저 비활성화한
뒤 두 파일을 함께 제거하고, idle reload 또는 새 세션으로 발견 결과를 확인합니다.

테마 플러그인을 제거해도 reporter 파일과 OMO 설정은 자동으로 지워지지 않습니다.
반대로 reporter를 제거해도 기존 OMO 사용자 테마는 자동 복원되지 않으므로 각 백업본을
필요할 때 복원하세요.
