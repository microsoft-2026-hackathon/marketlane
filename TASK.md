# 접수 여부가 불확실한 Checkout을 안전하게 재시도하기

## 업무 요청

Checkout 응답을 잃은 고객은 새 구매가 아니라 이미 접수된 주문을 안전하게 복구해야 합니다.
고객 범위의 명시적·선택적 idempotency key를 추가하고 브라우저에서 전송한 장바구니와
key의 생명주기를 연결하세요.

## 빠른 시작

루트에서 `MARKETLANE_DB=.data/checkout-idempotency.sqlite npm run dev`를 실행합니다.
main의 기본 DB나 다른 브랜치와 DB를 공유하지 마세요.
브랜치 전환·초기화 전 서버를 중지합니다. 필요할 때만 초기화하세요:
`MARKETLANE_DB=.data/checkout-idempotency.sqlite npm run db:reset -- --confirm`

## 현재 동작 관찰

`http://127.0.0.1:5178`에서 상품·재고 화면을 열고 주문 전 실제 수량을 확인하세요.

1. 두 번 구매할 재고가 충분할 때 같은 요청을 수동으로 두 번 보냅니다.

```sh
curl -X POST 'http://127.0.0.1:4310/api/orders?locale=en' \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"customer-ava","items":[{"productId":"product-arc-lamp","quantity":1}],"note":"Office purchase"}'
```

2. `GET /api/orders?customerId=customer-ava`, `GET /api/inventory`를 비교합니다.
   성공한 요청마다 별도 주문과 재고 이력이 생깁니다.
3. 브라우저는 접수 여부가 불확실할 때 자동 재시도하지 않습니다.
   현재 계약에는 key가 없으며 알 수 없는 JSON body 속성은 거부합니다.

## 수용 기준

1. 선택적 key의 HTTP 위치, 허용 문자, 길이, 공백·대소문자 정규화 정책을 공개합니다.
   Server 검증과 client 사용에 명시적으로 적용합니다. 다른 고객의 동일한 key는 독립적입니다.
2. 항목 순서, 생략·기본값 필드, 실제 locale, 메모, 기존 쿠폰 trim·대소문자 규칙을 포함해
   동등 요청을 정의합니다. 항목 순서만 다르면 동등합니다. 실제 상품·수량·쿠폰·locale·메모가
   바뀌면 결합된 key와 conflict이며 다른 주문을 생성하지 않습니다. Conflict 응답을 문서화합니다.
3. 같은 고객·key·동등한 접수 요청은 재시작 후에도 같은 주문 ID·번호·Checkout snapshot을
   반환합니다. 이후 가격·재고·고객 변경 때문에 복구를 새 견적이나 구매로 바꾸면 안 됩니다.
   이후 Fulfillment 변경을 되돌리지 않는 replay HTTP 동작을 문서화합니다.
4. 동시 동등 요청은 주문 하나, Checkout 이력 한 묶음, 항목당 재고 차감 한 번으로 수렴합니다.
   상충하는 동시 payload가 둘 다 성공하면 안 됩니다. 임시 in-progress 응답을 제공한다면
   안전한 retry 동작을 문서화합니다.
5. Commit 후 응답을 잃어도 원래 key·요청으로 복구할 수 있고 같은 DB의 재시작 후에도
   유지됩니다. 복구 반복은 재고를 다시 줄이지 않습니다. 남은 재고가 새 구매를 감당하지
   못하는 상황도 포함합니다.
6. 검증 오류·재고 부족·transaction 실패는 일부 주문·재고 변경이나 거짓 성공을 남기지
   않습니다. 거부된 시도가 key를 소모하는지와 retry 방법을 설명합니다. 실패로 key가
   무기한 진행 중 상태에 갇히면 안 됩니다.
7. UI는 불확실한 응답과 새로고침에도 전송한 요청의 key를 유지하고 명시적 복구 동작을
   제공합니다. 접수 확인 후에만 장바구니를 비웁니다. 고객·장바구니 변경이 retry를 다른
   구매에 연결하면 안 됩니다. 의도한 새 구매에는 새 key를 발급해 기존 주문을 replay하지 않습니다.
8. Key 없는 요청은 성공할 때마다 새 주문을 만드는 현재 동작을 유지합니다.
   장바구니·메모·제출 시각으로 key를 조용히 추론하지 않습니다.

## 범위와 결정

기존 로컬 고객 context를 사용하며 인증·payment processor는 추가하지 않습니다.
예약·inventory import identity는 전제 조건이 아닙니다. 가격 규칙, 주문 snapshot,
Fulfillment를 유지합니다. 새 요청·retry 계약을 문서화하고 기존 주문을 버리지 않고 DB를 migration합니다.

## 코드 시작점

- `shared/contracts.ts`, `server/app.ts`: Checkout 입력·오류 계약.
- `server/orders/service.ts`, `server/orders/repository.ts`: 접수 주문 저장.
- `server/db/migrations.ts`: 영속 key 상태와 기존 DB upgrade.
- `client/`: API client, 제출 상태, 고객 context, 브라우저 초안.
- `test/*.test.ts`: transaction·재시작·HTTP 테스트.
