# CSV 재고 조정 미리보기와 적용

## 업무 요청

운영자는 재고 정정과 입고 내역을 CSV 묶음으로 받습니다. 읽기 쉬운 미리보기와 명시적인
all-or-nothing 적용을 추가하세요. 응답을 잃어도 같은 묶음을 중복 반영하지 않고 복구할 수
있도록 identity와 감사 기록을 남겨야 합니다.

## Pair 시작 질문

> TASK.md의 CSV 재고 조정 과제를 같이 진행하려고 해.
> 운영자가 여러 조정 내역을 파일로 받아 확인한 뒤 한 번에 적용할 수 있게 하고 싶어.
> 과제 설명과 현재 재고 조정 흐름에서 어디부터 확인하면 좋을까?
> 아직 구체적인 구현 방법은 정하지 않았어.

## 빠른 시작

루트에서 `MARKETLANE_DB=.data/inventory-import.sqlite npm run dev`를 실행합니다.
main의 기본 DB나 다른 과제와 DB를 공유하지 마세요.
브랜치 전환·초기화 전 서버를 중지합니다. 필요할 때만 초기화하세요:
`MARKETLANE_DB=.data/inventory-import.sqlite npm run db:reset -- --confirm`

## 현재 동작 관찰

`http://127.0.0.1:5178`에서 재고 화면을 열고 DSK-001의 실제 수량을 확인합니다.

```sh
curl -X POST http://127.0.0.1:4310/api/inventory/adjustments \
  -H 'Content-Type: application/json' \
  -d '{"productId":"product-arc-lamp","delta":1,"reason":"Shelf recount","reference":"count-desk-01"}'
```

`GET /api/inventory`에서 조정과 이력을 확인하세요. 한 번에 상품 ID 하나를 처리하며
reference는 설명용이므로 같은 조정의 반복을 막지 않습니다. CSV 미리보기·적용은 없습니다.
[sample-adjustments.csv](sample-adjustments.csv)는 소량 입력 예시이지 초기 재고 가정이 아닙니다.
중복 SKU 행은 서로 다른 reference를 사용합니다.

## 수용 기준

1. sku,delta,reason,reference 컬럼을 받습니다. Encoding, header, 공백, 빈 행,
   byte·행·필드 제한을 문서화합니다. 선택적 BOM의 UTF-8, LF/CRLF, 인용된 쉼표·줄바꿈,
   escape된 따옴표를 처리합니다. 잘못된 인용, 누락·초과 필드, 한도 초과는 조용히 자르지
   말고 위치를 알 수 있는 오류로 거부합니다.
2. 미등록 SKU, 0·소수·범위 밖 delta, 사유·reference 누락을 행·필드별 오류로 알립니다.
   Import의 reference는 공백뿐일 수 없으며 정규화를 문서화하고 파일 내 중복을 거부합니다.
   SKU 반복은 허용하되 처리 의미를 문서화합니다. Delta 합산으로 음수 재고 제한을 우회하면 안 됩니다.
3. 미리보기는 재고·이력·import 상태를 쓰지 않는 읽기 전용입니다. 파싱한 조정, 행 오류,
   SKU별 현재·예상 수량을 보여줍니다. 파일 오류가 하나라도 있으면 적용을 막고 일부만 유효한
   파일을 적용 가능한 것처럼 표시하지 않습니다.
4. 적용 시 미리보기 합계를 믿지 말고 제출 행과 실제 재고를 다시 검증합니다. Checkout·수동
   조정으로 유효했던 묶음이 위험해졌다면 전체를 거부하고 조치 가능한 정보를 제공합니다.
   미등록 SKU나 적용 후 음수 재고도 거부합니다.
5. 성공하면 모든 재고 변경·사유·reference와 접수한 import를 함께 저장합니다.
   중간 실패 시 모든 SKU, 변동 이력, 접수 import 결과가 그대로여야 하며 부분 성공은 없습니다.
6. 서버 재시작·브라우저 새로고침 후에도 유지되는 import identity와 retry 계약을 정합니다.
   접수된 identity의 동시·반복 적용은 이력을 다시 만들지 않고 기존 결과 또는 명확한 이미
   적용됨 결과를 반환합니다. 같은 identity의 행 변경은 conflict입니다. 실제 새 입고에
   별도 identity를 주는 방법을 설명합니다.
7. UI는 파일 선택, 오류·합계 확인, 명시적 적용, 같은 identity로 불확실한 응답을 복구하는
   흐름을 지원합니다. 오래된 미리보기로 실패하면 다시 검토하게 하고 수정 내용을 자동 재적용하지 않습니다.
8. 기존 `POST /api/inventory/adjustments`의 선택적·비멱등 설명용 reference를 유지합니다.
   Import identity 때문에 해당 endpoint의 reference를 전역 고유 key로 바꾸거나 Checkout
   재고 이력을 변경하지 않습니다.

## 범위와 결정

로컬 CSV 작업이며 spreadsheet 편집기·공급업체 연동·job platform이 아닙니다.
Checkout idempotency를 전제하지 마세요. 파일의 업무 의미를 바꾸지 않는 parsing·identity
방식을 정하고 API·한도·영속 schema migration을 문서화합니다. 접수 주문 snapshot은 유지합니다.

## 코드 시작점

- `server/inventory/service.ts`: 조정 검증과 변동 기록.
- `server/db/database.ts`, `server/db/migrations.ts`: 원자적 저장과 import 이력.
- `server/app.ts`, `shared/contracts.ts`: 미리보기·적용 계약, 구조화된 행 오류.
- `client/`, `test/*.test.ts`: 재고 흐름과 격리된 persistence 검증.
