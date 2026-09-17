# Pairing 실험

상세 계약을 구현하는 실습과 사용자·Pair·Driver의 반복 대화로 판단을 발견하는 실험을
구분합니다. 비교할 때 어떤 조건이었는지 명시하세요. 앱 테스트는 Navigator 품질이나
개발자의 학습 효과를 측정하지 않습니다.

## 과제와 첫 질문

원본 repository의 [TASK.md](../TASK.md)는 과제 목록과 첫 실습 안내입니다.
각 `tasks/<태스크>/TASK.md`에는 업무 요청, Pair 시작 질문, 관찰 방법, 수용 기준,
범위와 코드 시작점이 있습니다. `main`에서 바로 읽고 선택한 문서를 Pair에 첨부할 수
있습니다. 기존 `task/*` 브랜치로 전환할 필요는 없습니다.

상세 계약을 처음부터 공유하는 실습에서는 선택한 원문을 사용하세요. 아래 명령으로
내보내는 발견 중심 실험은 **짧은 업무 요청과 시작 질문**만 전달합니다. 출력의
`TASK.md`와 `RUN.md`에 질문이 함께 들어가므로 별도 질문을 찾을 필요가 없습니다.
여기서 말하는 원본 과제 모음은 내보낸 mode 폴더에는 없습니다.

## 독립 실행 환경 준비

원본 repository에서 의존성을 설치하고 저장소 밖의 새 폴더로 내보냅니다.

```sh
npm ci
npm run pairing:prepare -- catalog-cache ../marketlane-cache-session-01
```

태스크: `catalog-cache`, `catalog-pagination`, `checkout-idempotency`, `daily-sales`,
`inventory-import`, `order-cancellation`, `promotion-rules`, `stock-reservations`.
우선 현재 `tasks/<name>/TASK.md`와 같은 폴더의 입력 예시를 읽습니다. 현재 `main`만
clone해도 여덟 과제를 준비할 수 있습니다. 해당 정본 파일이 없는 이전 작업 환경만
로컬 `task/<name>`, `origin/task/<name>` 순서로 찾아 호환합니다.
브랜치 전환·reset·commit·태스크 구현은 수행하지 않습니다.
기존 출력 경로와 원본 저장소 내부 경로는 거부합니다.

현재 소스, 로컬 변경, application 폴더의 ignore되지 않은 새 파일을 snapshot으로 만듭니다.
기능 구현 후가 아니라 실험 기준으로 삼을 baseline에서 실행하세요.
평가자 manifest에는 source commit, working tree 상태, 복사 경로, seed 시각을 기록합니다.
한 번에 만든 네 mode는 같은 소스와 하나의 seed DB 복사본을 받아 과거 주문 ID와
timestamp까지 같습니다. 별도 실행 묶음에서는 새 ID가 생성됩니다.

```text
marketlane-cache-session-01/
  beginner/      소스, 짧은 TASK.md, RUN.md, 전용 .data/marketlane.sqlite
  easy/          동일한 초기 소스와 데이터
  intermediate/  동일한 초기 소스와 데이터
  advanced/      동일한 초기 소스와 데이터
  evaluator/     상세 기준, GUIDE.md, manifest, baseline DB, 입력 예시
```

VS Code에서는 mode 폴더 하나만 열고 상위 폴더나 원본 repository는 열지 마세요.
Git 이력·의존성·생성 build·전체 과제 모음·실험 준비 코드와 테스트를 제외한 source snapshot입니다.
해당 폴더에서 `npm ci`를 실행합니다. `npm test`, `npm run build`도 사용할 수 있습니다.
`npm run dev`로 실행하고 **http://127.0.0.1:5178** 을 엽니다. 해당 `RUN.md`를 따르세요.

다른 서버를 먼저 중지하고 상속된 `MARKETLANE_DB`, `MARKETLANE_FAULT`, `PORT`를 해제합니다.
기본 DB가 열린 mode에 속해야 합니다. 실행마다 브라우저 저장소도 비우세요.
같은 origin의 서로 다른 폴더는 브라우저 장바구니를 공유할 수 있습니다.

평가자 폴더는 workspace와 agent context 밖에 둡니다. 이는 우발적 발견을 줄일 뿐
filesystem 접근 차단이 아닙니다. 넓은 파일·shell 권한으로는 옆 폴더도 읽을 수 있습니다.
강한 격리가 필요하면 다른 장치·계정에 자료를 두고 filesystem 접근을 제한하세요.
프롬프트에 평가자 자료 경로를 넣지 마세요.

상세 태스크는 `evaluator/TASK.full.md`에 그대로 보존합니다. 그 문서의 과제별 실행 명령은
내보낸 환경에 적용하지 않습니다. 평가자 가이드는 후속 상황·관찰 기록·데이터 복원을 안내합니다.
CSV 업무 입력은 처음부터 제공하고 일별 매출 timestamp 경계 예시는 평가자가 공개할 때까지 보관합니다.

발견 중심 실험은 짧은 요청과 기존 제품 규칙으로 시작합니다. 질문받은 비즈니스 제약은
알려주고 숨은 요구사항으로 채점하지 마세요. 계약 실습에서는 시작 전에 상세 수용 기준을
공유하고 별도 조건으로 기록합니다. 두 조건의 결과를 섞지 않습니다.

모델·버전, 도구, 언어, 초기 데이터, 시간을 맞추고 Pair·Driver 세션을 새로 만듭니다.
사용자가 판단과 Driver 지시를 직접 작성하고 작업을 관찰한 뒤 Pair로 돌아옵니다.
참여자별 mode 순서를 바꿔 학습·순서 효과를 줄이세요. 특정 문구·횟수가 아니라 유용한
기여와 불필요한 개입을 기록합니다.

## Checkout 응답 유실 재현

폐기 가능한 실험 환경에서 API를 중지하고 개발 모드를 명시적으로 실행합니다.

```sh
MARKETLANE_FAULT=drop-order-response-once npm run dev
```

유효한 주문을 한 번 제출하고 재시도 전에 주문·재고 화면을 확인하세요.
주문·snapshot·재고 이력은 commit되지만 성공 응답은 유실됩니다. Vite가 upstream 연결
종료를 HTTP 500으로 바꿔도 접수 확인 응답은 없습니다. Baseline에는 idempotency가 없으므로
다시 주문하면 별도 주문이 생성됩니다. 이 옵션이 retry나 idempotency를 구현하지는 않습니다.

같은 서버에서 API로 직접 재현하려면:

```sh
curl -i --max-time 5 http://127.0.0.1:4310/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"customer-ava","items":[{"productId":"product-arc-lamp","quantity":1}]}'
```

시작 후 첫 성공 Checkout이면 curl은 2xx 대신 empty reply 또는 connection reset을
보고합니다. 의도한 transport 오류이며 rollback이 아닙니다. 일반 조회 API로 주문을
확인하세요. curl의 자동 retry 옵션은 사용하지 않습니다.

- 기본값은 비활성입니다. 프로세스당 성공한 `POST /api/orders` 응답 한 번만 끊습니다.
  견적·유효하지 않은 주문·조회는 횟수를 소모하지 않으며 특정 고객에 한정되지 않습니다.
- 환경변수가 남아 있으면 watch를 포함한 재시작마다 다시 활성화됩니다.
  정상 동작으로 돌아가려면 변수를 해제하고 재시작하세요.
- 알 수 없는 값과 `npm start`에서는 거부합니다. 서버 `--dev` 옵션과 test factory에서만 허용합니다.
- Commit 후 연결만 끊습니다. 프로세스 crash, 디스크 오류, 모든 네트워크 장애를 재현하지 않습니다.

실제 loopback socket으로 저장된 주문 수·재고, 다음 정상 응답, 설정 제한을 검증합니다.

```sh
node --import tsx --test --test-name-pattern='opt-in fault' test/api.test.ts
node --import tsx --test --test-name-pattern='response-loss faults' test/persistence.test.ts
```

## 검증 범위

현재 태스크에는 단일 프로세스 SQLite baseline을 유지합니다. 동시 HTTP injection 테스트가
여러 DB 연결, 별도 서버, Redis, 분산 race의 근거는 아닙니다. 그 경계를 실제 도입하는
태스크에 필요한 harness만 추가하세요. 인증·messaging·외부 서비스 장애도 별도 요청이
필요하며 기존 catalog·Checkout 실습의 암묵적 요구사항은 아닙니다.