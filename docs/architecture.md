# 아키텍처

```text
React feature views
  -> typed /api client
  -> Fastify input validation and error mapping
  -> catalog / pricing / inventory / order services
  -> SQLite repositories and transactions
```

`shared/contracts.ts`에서 JSON 계약을 정의합니다. Route 입력은 runtime에 검증하며,
TypeScript 타입만으로 요청을 검증할 수는 없습니다.

Catalog는 상품 데이터, 요청한 번역, 현재 재고를 join합니다. 가격 계산은 순수 함수입니다.
주문은 하나의 write transaction에서 고객·상품 조회, 가격 계산, 재고 변경, snapshot
저장을 수행합니다.

주입 가능한 `Clock`이 비즈니스 timestamp를 제공하므로 실제 대기 없이 시간 경계를
테스트할 수 있습니다. SQLite는 foreign key를 활성화하고 파일 DB에는 WAL을 사용합니다.
Schema는 `PRAGMA user_version`에 따라 순서대로 올리며 seed와 migration은 분리합니다.

HTTP application factory는 열린 DB와 Clock을 받습니다. 테스트는 포트 없이 Fastify의
in-process HTTP injection을 사용합니다. Entry point가 파일 DB와 shutdown을 관리합니다.

개발용 장애 옵션은 transaction commit 후 성공한 Checkout 응답 한 번을 끊습니다.
주문 접수·재시도 규칙이 아닌 transport만 바꾸며 실제 loopback 연결로 테스트합니다.
활성화·해제는 [실험 가이드](pairing.md)를 참고하세요. 동시 주문 injection 테스트는
한 프로세스·동기 SQLite 연결 하나를 사용하므로 분산 환경의 안전성을 입증하지 않습니다.

브라우저는 장바구니 상품 ID와 수량만 local storage에 저장합니다. 장바구니나 고객
context가 바뀌면 새 견적을 요청합니다. 늦은 견적이 더 최신의 장바구니 상태를 덮어쓸 수
없습니다. Checkout은 재고를 갱신하고 접수된 주문 응답을 받았을 때만 장바구니를 비웁니다.

과거 주문은 현재 상품·고객 정보를 join하지 않습니다. 보고·주문 처리 화면은 저장된
snapshot을 읽습니다.

개발 환경은 Vite와 API를 따로 실행합니다. Production build는 API와 같은 Fastify
프로세스에서 제공합니다. Asset은 모두 로컬이며 외부 이미지·폰트 의존성이 없습니다.
