# Catalog 반복 조회의 DB 작업 줄이기

## 업무 요청

같은 상품 목록을 반복 방문할 때 DB 작업이 크게 줄어야 합니다.
고객은 올바른 언어의 상품과 현재 재고를 볼 수 있어야 하며,
운영자가 저장한 상품 수정은 freshness 유예 시간 없이 바로 확인할 수 있어야 합니다.

## 빠른 시작

Repository 루트에서 `MARKETLANE_DB=.data/catalog-cache.sqlite npm run dev`를 실행합니다.
main의 기본 DB나 다른 브랜치의 DB를 공유하지 마세요.
브랜치 전환·초기화 전에 서버를 중지합니다. 필요할 때만 초기화하세요:
`MARKETLANE_DB=.data/catalog-cache.sqlite npm run db:reset -- --confirm`

## 현재 동작 관찰

1. `http://127.0.0.1:5178`의 상품 화면에서 한국어·영어, 필터, 정렬을 비교합니다.
2. 아래 조회를 반복하고 catalog SQL 작업량을 관찰합니다.

```sh
curl 'http://127.0.0.1:4310/api/catalog?locale=en&category=desk&sort=price-asc&page=1&pageSize=6&inStock=true'
```

3. 재고 화면에서 DSK-001의 실제 수량을 확인하고 상품 수정과 유효한 재고 조정을 수행합니다.
   다시 조회해 보세요. 현재 구현은 요청마다 SQLite에서 metadata와 재고를 읽습니다.
   초기 수량을 추측하지 마세요.

## 수용 기준

1. Locale, 영어 fallback, 문자 그대로의 `%`/`_` 검색, 분류, 네 정렬과 ID tiebreak,
   page/pageSize, inStock 의미를 유지합니다. 서로 다른 조회 조건의 항목·개수·contentLocale이
   섞이면 안 됩니다.
2. Metadata는 commit된 변경보다 최대 30초까지만 늦을 수 있습니다. Freshness 측정 방법과
   cold start를 포함한 경계 동작을 문서화합니다. 반복 조회가 같은 저장 결과의 허용 수명을
   무한히 연장하면 안 됩니다.
3. `PATCH /api/products/:id` 성공 후 영향받는 모든 조건의 목록·상세 조회에 수정이 즉시
   반영됩니다. 정렬·검색 포함 여부도 포함하며 실패한 수정의 미commit 데이터는 노출하지 않습니다.
4. Checkout·재고 조정 commit 후 시작한 조회는 현재 재고를 반영합니다. 재고 감소 후 이전의
   판매 가능 표시가 남으면 안 됩니다. 배지뿐 아니라 inStock 포함 여부, total/pageCount,
   페이지 내용도 갱신해야 합니다.
5. 견적·Checkout의 현재 가격·재고 검증 권한을 유지합니다. 과거의 재고 표시로 초과 판매를
   허용하지 않으며 실패한 Checkout은 주문·재고의 기존 all-or-nothing 동작을 유지합니다.
6. 위 URL 그대로 query count를 재현하는 절차를 제공합니다. Cold 조회 1회를 별도 보고하고
   freshness 내 같은 warm 조회 20회를 수행합니다. 같은 데이터·요청 순서의 uncached 20회와
   비교해 metadata 읽기가 최소 80% 줄어야 합니다. 집계 SQL을 명시하고 mixed query와
   refresh의 metadata 작업도 포함합니다. 재고 전용 읽기와 전체 읽기는 별도로 보고하며
   경과 시간만으로 입증하지 않습니다.
7. 동시 조회·만료·수정 시 조회 조건이 섞이거나 freshness 허용치를 넘으면 안 됩니다.
   허용치를 지킬 수 없다면 오래된 값을 현재 값처럼 제시하지 말고 기존 구조화된 오류를
   반환합니다. 재시작도 정합성을 깨뜨리지 않습니다.

## 범위와 결정

조회 사이에 무엇을 유지할지 결정하고 운영 trade-off를 설명하세요. 아무것도 유지하지
않는 선택도 가능합니다. Redis나 외부 서비스는 필수가 아닙니다. 현재 page API, 가격 규칙,
브라우저 초안, 물리 재고의 의미를 유지합니다. 예약은 범위 밖입니다.
사용자가 인지하는 freshness 계약은 제품·API 문서에 반영하세요.

## 코드 시작점

- `server/catalog/repository.ts`: 언어별 조회, 개수, 정렬, 상품 수정.
- `server/inventory/service.ts`, `server/orders/service.ts`: commit된 재고 변경.
- `server/app.ts`, `shared/contracts.ts`: catalog HTTP 입력과 응답 보장.
- `server/db/database.ts`, `test/*.test.ts`: DB 접근과 격리된 query 관찰.
