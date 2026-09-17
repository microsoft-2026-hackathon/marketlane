# HTTP API

모든 경로는 `/api`로 시작합니다. Body는 JSON이며 정의하지 않은 속성은 거부합니다.
오류 응답 형식은 다음과 같습니다. `code`와 필드명은 영어를 유지하고 사용자 설명은
한국어로 제공합니다. Zod 등의 세부 진단은 원문을 유지합니다.

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "상품 재고가 부족합니다.",
    "details": { "sku": "DSK-001", "available": 2, "requested": 3 }
  }
}
```

| Method와 경로 | 입력 | 응답 |
| --- | --- | --- |
| `GET /health` | 없음 | `{ status, service }` |
| `GET /config` | 없음 | `StoreConfig` |
| `GET /customers` | 없음 | `{ items: Customer[] }` |
| `GET /catalog` | `locale`, `q`, `category`, `sort`, `page`, `pageSize`, `inStock` | `CatalogPage` |
| `GET /products/:id` | `locale` | `{ product: Product }` |
| `PATCH /products/:id` | `ProductUpdate` | `{ product: Product }` |
| `POST /quotes` | `QuoteRequest`; query `locale` | `CartQuote` |
| `POST /orders` | `CheckoutRequest`; query `locale` | `201 { order: Order }` |
| `GET /orders` | 선택: `customerId`, `status`, `limit` | `{ items: Order[] }` |
| `GET /orders/:id` | 없음 | `{ order: Order }` |
| `PATCH /orders/:id/status` | `{ status: "packing" \| "shipped" }` | `{ order: Order }` |
| `GET /inventory` | `locale` | `InventoryState` |
| `POST /inventory/adjustments` | `InventoryAdjustment` | `201 { product, movement }` |
| `GET /overview` | 없음 | `Overview` |

정확한 응답 필드는 `shared/contracts.ts`를 참고하세요.

API의 `locale` 기본값은 `en`입니다. 한국어 UI는 명시적으로 `ko`를 전달합니다.
Catalog의 `page` 기본값은 1, `pageSize`는 6(최대 24), `sort`는 `featured`입니다.
정렬은 `featured`, `price-asc`, `price-desc`, `name`을 지원합니다.
`inStock`은 `true` 또는 `false`입니다. 주문 목록은 기본 최근 50건, 최대 100건입니다.

```sh
curl 'http://127.0.0.1:4310/api/catalog?locale=ko&category=desk&pageSize=6'
curl -X POST http://127.0.0.1:4310/api/quotes \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"customer-ava","items":[{"productId":"product-arc-lamp","quantity":1}],"couponCode":"WELCOME10"}'
```

인증 없이 신뢰된 운영자가 로컬에서 사용하는 API입니다. 브라우저의 변경 요청은
설정된 로컬 UI origin에서만 허용합니다. 이 검사는 네트워크 배포에서 인증을 대체하지 않습니다.
