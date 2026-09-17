# Marketlane

**Wellactually의 테스트 및 데모용 repository**입니다.
일하는 공간을 위한 상품 스토어와 주문·재고 운영 콘솔을 갖추고 있습니다.

상품 탐색, 장바구니 구성, 서버 기준 견적, 주문 접수와 발송을 경험할 수 있습니다.
운영자는 상품 정보를 수정하고 재고를 조정하며 변동 이력을 확인할 수 있습니다.
실제 업무에 가까운 태스크를 통해 Wellactually Pair와 Driver의 협업을 실험합니다.

## 로컬 실행

Node.js 20.19 이상, npm 10 이상, 최신 브라우저가 필요합니다.

```sh
npm ci
npm run dev
```

**http://127.0.0.1:5178** 을 엽니다. API는 **4310** 포트에서 실행되고,
Vite가 `/api` 요청을 전달합니다. 첫 실행 시 `.data/marketlane.sqlite`에
SQLite DB와 seed 데이터를 만듭니다. 의존성 설치 후에는 외부 계정, API key,
네트워크 서비스가 필요하지 않습니다.

단일 프로세스로 실행하려면:

```sh
npm run build
npm start
```

**http://127.0.0.1:4310** 을 엽니다. `PORT`로 API/production 포트를,
`MARKETLANE_DB`로 DB 파일 위치를 바꿀 수 있습니다.

```sh
npm test
npm run typecheck
npm run db:reset -- --confirm
```

마지막 명령은 설정된 Marketlane DB만 초기화해 상품, 고객, 재고 이력, 주문을 복원합니다.
먼저 서버를 중지하세요. 로컬 DB 파일은 버전 관리하지 않습니다.

feature branch에서는 별도 `MARKETLANE_DB` 파일을 사용하세요. 특히 schema 변경 시
DB를 공유하면 안 됩니다. `TASK.md`가 있으면 해당 실행 명령을 따릅니다.
브랜치 전환 전 서버를 중지하세요. 새로운 schema를 자동으로 낮추거나 초기화하지 않습니다.

## 주요 기능

- **상품:** 검색, 분류, 정렬, pagination, 한국어·영어 상품 정보, 서버 기준 가격.
- **장바구니:** 고객별 브라우저 초안, 쿠폰, 견적 확인, 주문 접수.
- **주문:** 고객 선택, 상세 정보, 과거 가격 snapshot, 포장·발송 상태 전이.
- **재고:** 현재 수량, 변동 이력, 수동 조정, 언어별 상품 수정.
- **운영 요약:** 누적 주문 매출, 진행 중인 주문, 재고 부족 상품 수.

초기 상품은 Desk, Carry, Paper 분류의 18개입니다.
`WELCOME10`은 상품 금액 $50 이상일 때 10% 할인합니다.
배송비는 $5.90이며 할인 후 상품 금액이 $100 이상이면 무료입니다.
금액은 정수 USD cents로 저장합니다. 화면은 한국어가 기본이며, 상품 정보 언어를
바꿔도 환율 변환은 하지 않습니다. 영어 fallback 예시도 유지합니다.

## 제품 범위

신뢰할 수 있는 로컬 운영자 한 명을 전제로 합니다. 고객 선택은 계정 context 선택이지
인증이 아닙니다. 서버는 loopback에만 바인딩합니다. 인증과 적절한 배포 통제 없이
인터넷에 노출하지 마세요. 고객은 가상 데이터이며 example.com 주소를 사용합니다.
Checkout은 주문만 기록하고 실제 결제나 payment provider 호출은 하지 않습니다.

장바구니는 브라우저 초안이며 재고 예약이 아닙니다. 견적은 재고나 가격을 보장하지 않습니다.
Checkout은 하나의 transaction에서 현재 가격과 재고를 읽습니다.
성공한 요청마다 새 주문이 생성되며 상태는 `placed -> packing -> shipped`로 진행합니다.

## 코드 구조

| 경로 | 역할 |
| --- | --- |
| `client/` | React UI, API client, 장바구니 상태, 기능별 화면 |
| `shared/` | client와 server가 공유하는 JSON API 계약 |
| `server/db/` | SQLite 연결, 버전별 migration, seed 데이터 |
| `server/catalog/` | 언어별 상품 조회와 정보 수정 |
| `server/pricing/` | 정수 금액 계산과 쿠폰 규칙 |
| `server/inventory/` | 재고 변경과 변동 이력 |
| `server/orders/` | Checkout transaction, 불변 주문 항목, 주문 처리 |
| `test/` | 격리된 domain, persistence, HTTP 계약 테스트 |

동작 변경 전 [제품 규칙](docs/product-rules.md), [아키텍처](docs/architecture.md),
[HTTP API](docs/api.md)를 읽으세요. 진행할 작업이 있으면 `TASK.md`에 정의됩니다.

## Pairing 실험

[실험 가이드](docs/pairing.md)에 따라 짧은 업무 요청과 동일한 초기 DB를 가진
네 mode의 독립 workspace를 만들 수 있습니다. 상세 기준과 단계별 후속 질문은
별도 평가자 폴더로 내보냅니다. 상세 계약 기반 실습에는 기존 태스크 브랜치를 사용합니다.
개발 모드에서만 활성화할 수 있는 주문 응답 유실 재현 방법도 가이드에 있습니다.
