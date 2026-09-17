# Opaque cursor로 상품 목록 이어 보기

## 업무 요청

상품 목록을 이어 보는 동안 앞쪽에 새 상품이 추가됐다는 이유만으로 이미 본 상품이
다시 나타나면 안 됩니다. 기존 정렬에 cursor 순회를 추가하고 locale·필터 동작을
명확하게 유지하며, 실제로 보장하는 탐색 범위를 UI에 표시하세요.

## 빠른 시작

루트에서 `MARKETLANE_DB=.data/catalog-pagination.sqlite npm run dev`를 실행합니다.
main의 기본 DB나 다른 브랜치와 DB를 공유하지 마세요.
브랜치 전환·초기화 전 서버를 중지합니다. 필요할 때만 초기화하세요:
`MARKETLANE_DB=.data/catalog-pagination.sqlite npm run db:reset -- --confirm`

## 현재 동작 관찰

`http://127.0.0.1:5178`에서 상품 화면을 엽니다. 초기 상품은 세 분류의 18개입니다.

```sh
curl 'http://127.0.0.1:4310/api/catalog?locale=en&sort=price-asc&page=1&pageSize=6'
curl 'http://127.0.0.1:4310/api/catalog?locale=en&sort=price-asc&page=2&pageSize=6'
```

상품 ID와 CatalogPage의 total, page, pageCount를 비교하세요. 현재는 page/offset입니다.
격리된 DB에서 상품 편집기로 가격·이름이 같은 사례를 만들 수 있습니다.
새 상품 삽입은 통제된 로컬 데이터로 관찰하세요. 공개 API는 수정만 지원하고 생성은 지원하지 않습니다.

## 수용 기준

1. Featured, price-asc, price-desc, 표시 언어의 name 정렬에 opaque cursor 기반 처음·다음
   조회를 제공하고 문서화합니다. 정렬 의미와 상품 ID tiebreak를 유지합니다. Client가 cursor를
   해독하거나 다음 위치를 만들어내지 않아도 결과 끝을 응답에서 알 수 있어야 합니다.
2. 이어 보기는 실제 적용한 locale, search, category, inStock, sort에 결합합니다.
   영어 fallback과 문자 그대로의 `%`/`_` 검색을 유지합니다. 정규화와 중간 pageSize 변경
   허용 여부를 문서화하고 최대 24를 유지합니다. 결합된 조회 조건이 바뀌면 거부합니다.
3. 변경 없는 18개 상품을 필터 없이 6개씩 순회하면 고유 ID 18개 뒤 종료됩니다.
   크기 5, 결과 없는 필터, 마지막의 일부 묶음, 경계를 걸치는 같은 가격·표시 이름 상품
   각각 최소 3개를 검증합니다. Featured 동률, 한국어·영어 fallback도 포함합니다.
   이름이나 목록 길이뿐 아니라 ID를 관찰합니다.
4. Cursor 앞에 삽입해도 정렬 필드가 바뀌지 않은 기존 반환 상품이 중복되면 안 됩니다.
   앞에 추가된 상품은 새 탐색 때 보여도 됩니다. 뒤에 삽입된 상품의 노출 여부는 문서화합니다.
   신규·기존 상품의 1차 정렬 값이 같은 경우에도 이 보장이 성립해야 합니다.
5. 요청 사이 가격, 이름·번역, featured, 필터 포함 여부 변경 시 동작을 문서화합니다.
   누락·재등장 가능성 또는 재시작 요구를 명시하고 제공하지 않는 불변 결과를 약속하지 않습니다.
   Anchor 상품이 inStock 결과에서 빠져도 설명 없는 서버 오류를 내면 안 됩니다.
6. 잘못된 형식, 과도한 크기, 잘림, 미지원 버전, 오래된 필터의 cursor에는 구조화된 client
   오류를 반환합니다. 무관한 500이나 조용한 첫 페이지 fallback은 금지합니다.
   수명·버전 무효화 제한을 두면 문서화합니다.
7. 기존 page API 호출자를 유지하거나, API 버전을 명시하고 소유한 모든 호출자·문서를 갱신합니다.
   Page 번호를 cursor로 재해석하거나 제거한 필드를 기존 CatalogPage 호출자가 기대하게 두지 않습니다.
8. UI는 가상의 페이지 수 없이 처음·다음 탐색과 종료 상태를 제공합니다. 검색, locale, 분류,
   정렬, 재고 조건 변경 시 순회를 초기화하며 크기 변경도 문서화합니다. 이전 검색의 늦은
   응답은 새 결과를 덮어쓰거나 덧붙이면 안 됩니다. Cursor 오류 후 탐색을 다시 시작할 수 있어야 합니다.

## 범위와 결정

Cache, 예약, 외부 검색 서비스, 상품 생성 UI는 필요하지 않습니다.
불변 snapshot은 선택이며 전제 조건이 아닙니다. 실시간 수정 의미와 호환 정책을 선택·설명하되
가격·언어 처리·Checkout의 검증 권한은 바꾸지 마세요.

## 코드 시작점

- `server/catalog/repository.ts`: 필터, 정렬 식, tiebreak, offset.
- `shared/contracts.ts`, `server/app.ts`: CatalogQuery/CatalogPage와 runtime 검증.
- `client/`: 상품 탐색, query 상태, 늦은 응답 처리.
- `server/db/seed.ts`, `test/*.test.ts`: 18개 상품과 정렬 동률 데이터.
