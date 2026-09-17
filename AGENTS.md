# 기여 지침

먼저 `README.md`, `docs/product-rules.md`, 현재 `TASK.md`가 있다면 함께 읽으세요.
`TASK.md`가 과제 목록이면 사용자가 선택한 과제 문서만 이어서 읽습니다.
사용자가 과제 원문을 대화로 제공했다면 로컬 파일의 부재만으로 다시 요구하지 않습니다.
작업 요청에서 변경하지 않은 기존 제품 동작은 보존합니다.

- 금액은 정수 USD cents, timestamp는 ISO 8601 UTC로 유지합니다.
- 비즈니스 규칙은 React view나 route handler가 아니라 service 또는 순수 domain 함수에 둡니다.
- HTTP 입력을 검증하고 구조화된 오류 응답 형식을 유지합니다.
- 관련 쓰기는 SQLite transaction으로 묶습니다. 저장 schema가 바뀌면 버전이 있는
  migration을 추가하고, 기존 로컬 데이터를 임의로 버리지 않습니다.
- 과거 주문을 현재 catalog에서 재구성하지 말고 주문 내용과 가격의 snapshot을 저장합니다.
- 브라우저의 장바구니 초안과 접수된 주문을 구분합니다.
- `npm test`와 `npm run build`를 사용합니다. Node 내장 test runner를 사용하므로
  별도의 테스트 프레임워크는 필요하지 않습니다.
- 변경한 동작을 중심으로 검증합니다. DB 테스트에는 격리된 임시 DB 또는 in-memory DB를 사용합니다.
- `.data`, 생성된 build, credential, 개인정보는 커밋하지 않습니다.
- 문서와 사용자 안내는 자연스러운 한국어로 작성합니다. 전문·도메인 용어와 어색한 번역은
  영어를 유지합니다. 코드 식별자, API 필드, 상태값, 명령어는 번역하지 않습니다.
- 상품 정보의 `en`/`ko` 전환과 영어 fallback은 유지합니다.
