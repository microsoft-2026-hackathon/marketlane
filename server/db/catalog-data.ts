import type { Category, ProductShape, ProductTone } from "../../shared/contracts.js";

export interface CatalogRecord {
  slug: string;
  sku: string;
  category: Category;
  name: string;
  description: string;
  korean?: { name: string; description: string };
  priceCents: number;
  stock: number;
  featured: boolean;
  tone: ProductTone;
  shape: ProductShape;
}

export const initialCatalog: readonly CatalogRecord[] = [
  {
    slug: "arc-lamp", sku: "DSK-001", category: "desk", name: "Arc task lamp",
    description: "A focused pool of warm light, with an adjustable shade and a compact metal base.",
    korean: { name: "아크 데스크 램프", description: "각도 조절이 가능한 갓과 작은 금속 받침으로 책상 위에 따뜻한 빛을 더합니다." },
    priceCents: 6800, stock: 18, featured: true, tone: "sage", shape: "lamp",
  },
  {
    slug: "felt-desk-mat", sku: "DSK-002", category: "desk", name: "Felt desk mat",
    description: "A soft landing for your keyboard and daily notes, made from dense recycled felt.",
    korean: { name: "펠트 데스크 매트", description: "재활용 펠트로 만들어 키보드와 매일의 메모를 부드럽게 받쳐줍니다." },
    priceCents: 3200, stock: 32, featured: true, tone: "clay", shape: "mat",
  },
  {
    slug: "aluminum-stand", sku: "DSK-003", category: "desk", name: "Lift laptop stand",
    description: "An aluminum riser that brings your screen closer to eye level and frees up desk space.",
    korean: { name: "리프트 노트북 스탠드", description: "화면을 눈높이에 맞추고 책상 공간을 넓혀주는 알루미늄 받침대입니다." },
    priceCents: 5400, stock: 16, featured: true, tone: "ink", shape: "stand",
  },
  {
    slug: "oak-desk-tray", sku: "DSK-004", category: "desk", name: "Oak catchall tray",
    description: "A shallow oak tray for the small objects that otherwise wander around your desk.",
    korean: { name: "오크 데스크 트레이", description: "책상 위 작은 물건들을 한곳에 모아주는 낮은 오크 트레이입니다." },
    priceCents: 2600, stock: 8, featured: false, tone: "sand", shape: "tray",
  },
  {
    slug: "orbit-pen-cup", sku: "DSK-005", category: "desk", name: "Orbit pen cup",
    description: "A ceramic home for pens, scissors, and the tools you reach for every day.",
    korean: { name: "오빗 펜 컵", description: "펜과 가위, 매일 쓰는 도구를 보관하기 좋은 세라믹 컵입니다." },
    priceCents: 1800, stock: 4, featured: false, tone: "sky", shape: "tray",
  },
  {
    slug: "task-lamp", sku: "DSK-006", category: "desk", name: "Column reading lamp",
    description: "A slim upright reading light with a weighted base and a quiet, architectural silhouette.",
    korean: { name: "컬럼 리딩 램프", description: "안정적인 받침과 간결한 실루엣을 갖춘 슬림한 독서용 조명입니다." },
    priceCents: 6800, stock: 9, featured: false, tone: "ink", shape: "lamp",
  },
  {
    slug: "canvas-tote", sku: "CRY-001", category: "carry", name: "Everyday canvas tote",
    description: "Sturdy canvas, generous handles, and an inside pocket for a less scattered commute.",
    korean: { name: "에브리데이 캔버스 토트", description: "튼튼한 캔버스와 넉넉한 손잡이, 내부 주머니로 출근길을 간편하게 만듭니다." },
    priceCents: 2400, stock: 25, featured: true, tone: "clay", shape: "bag",
  },
  {
    slug: "steel-bottle", sku: "CRY-002", category: "carry", name: "Daylight steel bottle",
    description: "A 600 ml insulated bottle with a comfortable carry loop and a leak-resistant lid.",
    korean: { name: "데이라이트 스틸 보틀", description: "휴대용 고리와 밀폐형 뚜껑을 갖춘 600ml 보온·보냉 물병입니다." },
    priceCents: 2800, stock: 20, featured: true, tone: "sage", shape: "bottle",
  },
  {
    slug: "tech-pouch", sku: "CRY-003", category: "carry", name: "Cable companion pouch",
    description: "Keep chargers, adapters, and loose cables together in a structured zip pouch.",
    korean: { name: "케이블 컴패니언 파우치", description: "충전기와 어댑터, 케이블을 정리할 수 있는 지퍼 파우치입니다." },
    priceCents: 2200, stock: 12, featured: false, tone: "sky", shape: "bag",
  },
  {
    slug: "weekender-bag", sku: "CRY-004", category: "carry", name: "Weekender holdall",
    description: "A roomy carryall for an overnight trip or a day that needs a little more room.",
    korean: { name: "위켄더 홀드올", description: "짧은 여행이나 짐이 많은 하루에 어울리는 넉넉한 가방입니다." },
    priceCents: 8900, stock: 7, featured: false, tone: "ink", shape: "bag",
  },
  {
    slug: "travel-bottle", sku: "CRY-005", category: "carry", name: "Trail travel bottle",
    description: "A lightweight bottle sized for a side pocket, with a simple twist-off cap.",
    korean: { name: "트레일 트래블 보틀", description: "가방 옆 주머니에 들어가는 크기와 간편한 뚜껑의 가벼운 물병입니다." },
    priceCents: 2800, stock: 0, featured: false, tone: "sand", shape: "bottle",
  },
  {
    slug: "commuter-sleeve", sku: "CRY-006", category: "carry", name: "Commuter laptop sleeve",
    description: "A padded sleeve for a 14-inch laptop, with a slim pocket for the essentials.",
    korean: { name: "커뮤터 노트북 슬리브", description: "14인치 노트북을 보호하며 작은 소지품 주머니를 갖춘 슬리브입니다." },
    priceCents: 3600, stock: 11, featured: false, tone: "ink", shape: "mat",
  },
  {
    slug: "dot-grid-notebook", sku: "PPR-001", category: "paper", name: "Daily dot-grid notebook",
    description: "Lay-flat binding and lightly dotted pages for notes, sketches, and the next good idea.",
    korean: { name: "데일리 도트 노트북", description: "메모와 스케치를 위한 도트 내지와 평평하게 펼쳐지는 제본의 노트입니다." },
    priceCents: 1200, stock: 48, featured: true, tone: "sage", shape: "notebook",
  },
  {
    slug: "weekly-planner", sku: "PPR-002", category: "paper", name: "Undated weekly planner",
    description: "See the week at a glance, without wasting pages when plans change.",
    korean: { name: "만년 위클리 플래너", description: "계획이 바뀌어도 페이지 낭비 없이 한 주를 한눈에 정리할 수 있습니다." },
    priceCents: 1800, stock: 22, featured: true, tone: "sand", shape: "notebook",
  },
  {
    slug: "pocket-notebook", sku: "PPR-003", category: "paper", name: "Pocket field notes",
    description: "Three pocket-size notebooks for thoughts worth keeping away from a screen.",
    korean: { name: "포켓 필드 노트", description: "화면 밖에서 떠오른 생각을 기록하는 주머니 크기의 노트 3권 세트입니다." },
    priceCents: 800, stock: 36, featured: false, tone: "sky", shape: "notebook",
  },
  {
    slug: "refill-pages", sku: "PPR-004", category: "paper", name: "Loose-leaf refill pages",
    description: "A pack of 80 lightly ruled sheets, ready for your existing A5 organizer.",
    priceCents: 800, stock: 30, featured: false, tone: "clay", shape: "notebook",
  },
  {
    slug: "brass-pen", sku: "PPR-005", category: "paper", name: "Brass everyday pen",
    description: "A satisfying weight, a smooth black refill, and a finish that changes with use.",
    korean: { name: "브라스 에브리데이 펜", description: "적당한 무게와 부드러운 검정 잉크, 사용할수록 깊어지는 황동 마감의 펜입니다." },
    priceCents: 2400, stock: 14, featured: true, tone: "ink", shape: "pen",
  },
  {
    slug: "desk-pad", sku: "PPR-006", category: "paper", name: "Tear-off desk pad",
    description: "A generous blank canvas for today's list, quick diagrams, and working things out.",
    korean: { name: "티어오프 데스크 패드", description: "할 일과 간단한 그림, 생각 정리를 위해 한 장씩 뜯어 쓰는 메모 패드입니다." },
    priceCents: 1600, stock: 3, featured: false, tone: "sand", shape: "mat",
  },
];
