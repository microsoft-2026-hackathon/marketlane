# 발송 전 주문 취소

## 업무 요청

운영자가 잘못 접수한 주문을 발송 전에 취소하고 재고를 되돌리되 과거 기록은 남겨야 합니다.
Placed·packing 주문의 취소를 추가하세요. Shipped 주문은 이 작업의 범위 밖입니다.

## 빠른 시작

루트에서 `MARKETLANE_DB=.data/order-cancellation.sqlite npm run dev`를 실행합니다.
main의 기본 DB나 다른 브랜치와 DB를 공유하지 마세요.
브랜치 전환·초기화 전 서버를 중지합니다. 필요할 때만 초기화하세요:
`MARKETLANE_DB=.data/order-cancellation.sqlite npm run db:reset -- --confirm`

## 현재 동작 관찰

`http://127.0.0.1:5178`의 상품·주문·재고 화면을 엽니다. 상단 요약에서 운영 합계를 확인합니다.

1. 실제 재고를 확인하고 customer-ava로 소량 주문하세요. 새 주문 ID와 재고 이력을 기록합니다.
   Seed 주문 상태를 추측하지 마세요.
2. 해당 ID로 `GET /api/orders/:id`를 조회하고 UI 또는 `PATCH /api/orders/:id/status`의
   `{ "status": "packing" }`으로 포장을 시작하세요.
3. `GET /api/inventory`, `GET /api/overview`를 비교합니다. 포장은 재고를 다시 변경하지 않고
   접수 금액은 주문 매출로 집계됩니다. 현재 상태 입력은 packing·shipped만 허용하며
   취소 endpoint나 UI는 없습니다.

## 수용 기준

1. 종료 상태 cancelled, 영속 schema, 문서화된 취소 API를 추가합니다. Placed·packing은
   취소할 수 있고 shipped는 구조화된 conflict로 거부합니다. 취소된 주문은 포장·발송할 수
   없습니다. 상태 검증, 필터, 공유 타입, 기존 DB migration을 함께 갱신합니다.
2. 공백만 있는 값이 아닌 취소 사유를 필수로 받고 trimming·길이 제한을 문서화합니다.
   서버 Clock의 UTC 취소 시각을 기록합니다. createdAt, 존재하는 packedAt과 원래 고객·상품·분류·
   가격·쿠폰·배송비·합계·메모 snapshot을 보존합니다. 취소를 금액 0인 주문으로 바꿔 쓰지 않습니다.
3. 과거 주문 수량을 현재 물리 재고로 정확히 한 번 복원하고 주문을 참조하는 이력을 남깁니다.
   상태·사유·시각·재입고·이력은 함께 commit합니다. Transaction 실패 시 모두 변경되지 않아야 합니다.
4. 재시작 후에도 같은 취소를 반복하면 기존 취소 주문을 반환하며 재입고·취소 metadata를
   바꾸지 않습니다. 이미 취소된 주문에 다른 사유를 보내면 감사 기록을 덮어쓰지 말고 conflict로 처리합니다.
5. 동시 취소는 이력을 중복 생성하지 않습니다. Packing 주문의 발송·취소 경합은 정확히 하나의
   종료 결과만 만들고 패한 요청은 conflict입니다. 발송 성공과 취소 재입고가 공존하면 안 됩니다.
6. bookedSalesCents는 취소 주문을 제외하고 나머지에는 배송비를 포함합니다. 분류 수량·매출은
   취소 항목을 제외하며 할인 후 금액, 배송비 제외 기준을 유지합니다. openOrderCount는
   placed·packing만 포함합니다. 최근 목록에는 취소 상태를 명확히 표시할 수 있습니다.
   결제 정산이 아닌 운영 집계라는 의미를 문서화합니다.
7. UI는 가능한 상태에서만 취소를 제공하고 사유를 받으며 제출 전 결과를 알립니다.
   이후 사유·시각과 원래 주문 상세를 표시하고 재고·요약을 갱신합니다. 발송·취소 conflict를
   드러내야 하며 낙관적 취소를 실제 완료처럼 표시하지 않습니다.
8. 기존 주문 접수와 placed -> packing -> shipped를 유지하고 처리 중 재고를 추가 차감하지
   않습니다. Migration 후 과거 주문을 읽을 수 있어야 하며 상태 필터로 취소 주문도 조회할 수 있습니다.

## 범위와 결정

환불·반품·payment provider·발송 후 되돌리기·새 인증 모델은 없습니다.
예약·새 프로모션·Checkout idempotency에 의존하지 마세요. 기존 main의 주문 snapshot과
재고 이력에서 동작해야 합니다. 취소 endpoint를 명확히 정하고 제품·아키텍처·API 문서를 갱신합니다.

## 코드 시작점

- `server/orders/service.ts`, `server/orders/repository.ts`: 상태 전이와 주문 데이터.
- `server/inventory/service.ts`, `server/db/migrations.ts`: 재입고 이력과 schema.
- `server/app.ts`, `shared/contracts.ts`: 상태·API 검증과 요약 계약.
- `client/`, `test/*.test.ts`: 주문 UI, 운영 요약, transaction 동작.
