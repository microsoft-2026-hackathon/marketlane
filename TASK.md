# Marketlane 태스크와 시작 질문

이 파일은 태스크 안내입니다. 아래에서 선택한 과제의 정의를 읽으세요.
`main`에서도 과제를 읽을 수 있으며 문서를 보려고 브랜치를 전환할 필요는 없습니다.
과제는 추가할 동작의 요구사항이지 이미 구현된 기능 목록이 아닙니다.
사용자가 다른 과제를 선택하지 않았다면 첫 실습은 **catalog-cache**로 시작합니다.

## 바로 시작하기: Catalog 반복 조회 개선

**[과제 정의와 수용 기준](tasks/catalog-cache/TASK.md)**

같은 상품 목록을 반복 조회할 때 DB 작업을 줄이되, 상품 수정과 현재 재고를 올바르게
반영하는 과제입니다. Redis 등 구현 기술은 미리 정하지 않습니다.

Marketlane을 연 VS Code의 `Copilot` 세션에서 Wellactually Easy 또는 비교할 Pair
모드를 선택하고 다음 질문을 보냅니다.

> tasks/catalog-cache/TASK.md의 과제를 같이 진행하려고 해.
> 같은 상품 목록을 반복해서 조회할 때 DB 작업을 줄이고 싶어.
> 과제 설명과 현재 코드를 기준으로 어디부터 확인하면 좋을까?
> 아직 구현 방법은 정하지 않았어.

Pair와 범위를 논의한 뒤 Driver 세션을 만들고, 사용자가 구현 지시를 직접 작성합니다.
위 질문은 Pair 대화를 시작하기 위한 예시이지 Driver 지시나 정해진 대화 대본이 아닙니다.

각 과제 문서의 **Pair 시작 질문**을 사용할 때는 그 문서를 함께 첨부하거나 실제
경로를 알려 주세요. 원본에서는 `tasks/<태스크>/TASK.md`를, 내보낸 mode 폴더에서는
루트 `TASK.md`를 사용합니다. 같은 모델·과제·시작 질문으로 모드를 비교하되 이후에는
실제 응답과 본인의 판단에 따라 대화를 이어 갑니다.

## 실습 조건

- 현재 브랜치와 변경 내용을 확인하고 기존 작업을 보존하세요. 이 안내를 읽었다고
  코드 수정, 브랜치 전환이나 DB 초기화를 자동으로 수행하지 않습니다.
- 각 과제의 업무 요청·수용 기준에서 바꾸는 동작 외에는 기존 제품 규칙을 유지합니다.
  예를 들어 현재 문서의 “Catalog 응답 cache 없음”은 baseline 설명이며 캐시 과제를 금지하지 않습니다.
- 서버 실행은 각 과제의 전용 `MARKETLANE_DB` 설정을 따릅니다. 다른 서버를 먼저
  중지하고, 과제·실행 사이에 DB와 브라우저 장바구니 상태를 섞지 마세요.
- 여기서는 상세 계약을 처음부터 공유합니다. 짧은 업무 요청으로 시작하는 발견 중심
  비교 실험은 [Pairing 실험 가이드](docs/pairing.md)의 `pairing:prepare`를 사용합니다.
  내보낸 폴더에서는 그 폴더의 `TASK.md`와 `RUN.md`를 따릅니다.

## 태스크 목록

| 태스크 | 정의·시작 질문 |
| --- | --- |
| 반복 Catalog 조회의 DB 작업 줄이기 | [catalog-cache](tasks/catalog-cache/TASK.md) |
| 상품 목록 이어 보기 | [catalog-pagination](tasks/catalog-pagination/TASK.md) |
| 불확실한 Checkout 재시도 | [checkout-idempotency](tasks/checkout-idempotency/TASK.md) |
| 현지 날짜 기준 일별 주문 매출 | [daily-sales](tasks/daily-sales/TASK.md) |
| CSV 재고 조정 미리보기·적용 | [inventory-import](tasks/inventory-import/TASK.md) |
| 발송 전 주문 취소 | [order-cancellation](tasks/order-cancellation/TASK.md) |
| 분류별·정액 할인 프로모션 | [promotion-rules](tasks/promotion-rules/TASK.md) |
| 장바구니 재고 예약 | [stock-reservations](tasks/stock-reservations/TASK.md) |

각 과제는 같은 baseline에서 독립적으로 수행하며 다른 과제의 구현을 전제하지 않습니다.
정의와 입력 예시의 정본은 `tasks/`입니다. 기존 `task/*` 브랜치는 당시 과제의
snapshot으로 남겨 두며, 현재 과제 내용을 확인하는 데 필요하지 않습니다.