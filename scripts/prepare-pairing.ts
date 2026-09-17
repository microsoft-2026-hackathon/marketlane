import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../server/db/database.js";
import { seedDatabase } from "../server/db/seed.js";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const modes = ["beginner", "easy", "intermediate", "advanced"];
const scenarios: Record<string, { assets: string[]; evaluatorOnly?: boolean; followups: string[] }> = {
  "catalog-cache": {
    assets: [],
    followups: [
      "첫 제안 후: 어떤 반복 작업을 측정했나요? 변경 효과는 무엇으로 확인할까요?",
      "첫 Driver 결과 후: 재고 화면에서 상품을 수정한 뒤 한국어·영어 검색과 정렬을 다시 확인하세요. 수정 내용이 반영되나요?",
      "다음: 상품 재고를 0으로 줄이고 재고 있는 상품만 표시하세요. 재고 표시뿐 아니라 목록 포함 여부와 전체 개수도 관찰하세요.",
    ],
  },
  "catalog-pagination": {
    assets: [],
    followups: [
      "첫 제안 후: 다음 묶음을 읽기 전에 새 상품이 들어오면 어떻게 동작해야 할까요?",
      "첫 Driver 결과 후: 정렬 값이 같은 상품을 순회하고, 중간에 locale이나 필터를 바꿔 보세요.",
      "다음: 요청 사이에 상품의 정렬 값을 수정하세요. 변경 중인 catalog에서 무엇을 보장하는지 논의하세요.",
    ],
  },
  "checkout-idempotency": {
    assets: [],
    followups: [
      "첫 제안 후: 같은 구매의 재시도와 새로운 구매는 어떤 행동으로 구분하나요?",
      "첫 Driver 결과 후: 단발 응답 유실 옵션을 켜고 한 번 주문하세요. 복구를 시도하기 전에 주문 목록을 확인하세요.",
      "다음: 복구 전에 브라우저를 새로고침하거나 서버를 재시작하세요. 장바구니·고객도 바꾸며 의도한 결과를 논의하세요.",
    ],
  },
  "daily-sales": {
    assets: ["timestamp-cases.json"],
    evaluatorOnly: true,
    followups: [
      "첫 제안 후: 접수 매출은 어떤 timestamp, timezone, 금액을 기준으로 하나요?",
      "첫 Driver 결과 후: 주문 시각을 통제해 주문 없는 날짜와 DST 전환일을 확인하세요.",
      "다음: 여러 분류가 섞인 날의 합계를 원본 주문과 대조하세요. 현재 상품을 수정한 뒤 보고서를 다시 확인하세요.",
    ],
  },
  "inventory-import": {
    assets: ["sample-adjustments.csv"],
    followups: [
      "첫 제안 후: 미리보기는 무엇을 보장하며 적용 전까지 어떤 값이 바뀔 수 있나요?",
      "첫 Driver 결과 후: 유효한 파일을 미리 본 뒤 일반 주문으로 재고를 줄이고, 같은 파일을 적용하세요.",
      "다음: 적용 응답이 불확실할 때 복구 방법과 새로운 입고를 재시도와 구분하는 기준을 논의하세요.",
    ],
  },
  "order-cancellation": {
    assets: [],
    followups: [
      "첫 제안 후: 어떤 상태에서 취소할 수 있고 어떤 과거 기록을 남겨야 하나요?",
      "첫 Driver 결과 후: 같은 주문을 두 번 취소하고 재고와 변동 이력을 확인하세요.",
      "다음: 발송 후 취소를 시도하세요. 정상 취소 후에는 운영 요약도 확인하세요.",
    ],
  },
  "promotion-rules": {
    assets: [],
    followups: [
      "첫 제안 후: 할인액을 정수 cents로 각 대상 항목에 어떻게 배분할까요?",
      "첫 Driver 결과 후: 여러 분류의 상품을 담고 프로모션·무료 배송 경계 금액을 확인하세요.",
      "다음: 주문 후 catalog 가격을 바꾸고 과거 주문의 할인액과 새 견적을 비교하세요.",
    ],
  },
  "stock-reservations": {
    assets: [],
    followups: [
      "첫 제안 후: 예약 수량과 물리 재고는 어떻게 다르며, 예약 수량은 누가 사용할 수 있나요?",
      "첫 Driver 결과 후: 마지막 재고를 예약하고 고객을 바꿔 일반 주문을 시도하세요.",
      "다음: 주입한 Clock으로 정확한 만료 경계를 확인하세요. 재시작과 예약 수정 실패도 포함하세요.",
    ],
  },
};

function scenarioFor(task: string) {
  if (!Object.hasOwn(scenarios, task)) throw new Error(`Choose a task: ${Object.keys(scenarios).join(", ")}`);
  return scenarios[task]!;
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: sourceRoot, encoding: "utf8" });
}

export function loadPairingTask(task: string): { taskText: string; assets: Record<string, Buffer> } {
  const scenario = scenarioFor(task);
  const directory = path.join(sourceRoot, "tasks", task);
  if (existsSync(path.join(directory, "TASK.md"))) {
    return {
      taskText: readFileSync(path.join(directory, "TASK.md"), "utf8"),
      assets: Object.fromEntries(scenario.assets.map(filename => [filename,
        readFileSync(path.join(directory, filename)),
      ])),
    };
  }
  const candidates = [`refs/heads/task/${task}`, `refs/remotes/origin/task/${task}`];
  const available = new Set(git(["for-each-ref", "--format=%(refname)", ...candidates]).trim().split("\n"));
  const taskRef = candidates.find(candidate => available.has(candidate));
  if (!taskRef) throw new Error(`tasks/${task}/TASK.md와 task/${task} 브랜치가 없습니다. git fetch origin을 실행해 주세요.`);
  return {
    taskText: git(["show", `${taskRef}:TASK.md`]),
    assets: Object.fromEntries(scenario.assets.map(filename => [filename,
      execFileSync("git", ["show", `${taskRef}:${filename}`], { cwd: sourceRoot }),
    ])),
  };
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function preparePairingRuns(task: string, outputPath: string, taskText: string, assets: Record<string, Buffer> = {}): string {
  const scenario = scenarioFor(task);
  const brief = /^# [^\n]+\n\s*## (?:Business request|업무 요청)\s*\n([\s\S]*?)(?=\n## )/.exec(taskText);
  if (!brief) throw new Error("The task must contain a title and a Business request before other sections.");
  const openingQuestion = /\n## Pair 시작 질문[ \t]*\r?\n([\s\S]*?)(?=\n## |$)/.exec(taskText)?.[1]?.trim()
    ?? "> TASK.md의 업무 요청을 같이 살펴보자. 현재 코드를 기준으로 어디부터 확인하면 좋을까?";
  for (const filename of scenario.assets) {
    if (!assets[filename]) throw new Error(`Missing task input: ${filename}`);
  }
  const requested = path.resolve(outputPath);
  if (isWithin(realpathSync(sourceRoot), requested)) throw new Error("Output must be outside the source repository.");
  mkdirSync(path.dirname(requested), { recursive: true });
  const output = path.join(realpathSync(path.dirname(requested)), path.basename(requested));
  if (isWithin(realpathSync(sourceRoot), output)) throw new Error("Output must be outside the source repository.");

  const sourceCommit = git(["rev-parse", "HEAD"]).trim();
  const sourceChanges = git(["status", "--porcelain"]);
  const roots = new Set(["client", "server", "shared", "test", "scripts", "docs"]);
  const rootFiles = new Set([".gitignore", "AGENTS.md", "README.md", "package.json", "package-lock.json", "vite.config.ts",
    "tsconfig.json", "tsconfig.client.json", "tsconfig.server.json", "tsconfig.test.json"]);
  const excluded = new Set(["scripts/prepare-pairing.ts", "test/pairing.test.ts"]);
  const files = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .split("\0").filter(filename => filename && !excluded.has(filename) &&
      (rootFiles.has(filename) || roots.has(filename.split("/")[0]!)));
  const snapshot = files.map(filename => ({ filename, content: readFileSync(path.join(sourceRoot, filename)) }));

  mkdirSync(output);
  const evaluator = path.join(output, "evaluator");
  mkdirSync(evaluator);
  const seedTime = "2026-09-13T12:00:00.000Z";
  const baseline = path.join(evaluator, "baseline.sqlite");
  const database = openDatabase(baseline);
  try {
    seedDatabase(database, { now: () => new Date(seedTime) });
  } finally {
    database.close();
  }
  writeFileSync(path.join(evaluator, "TASK.full.md"), taskText);
  if (scenario.assets.length) {
    mkdirSync(path.join(evaluator, "inputs"));
    for (const filename of scenario.assets) writeFileSync(path.join(evaluator, "inputs", filename), assets[filename]!);
  }
  writeFileSync(path.join(evaluator, "manifest.json"), JSON.stringify({
    task, modes, sourceCommit, sourceChanges, seedTime, preparedAt: new Date().toISOString(), files,
  }, null, 2) + "\n");
  writeFileSync(path.join(evaluator, "GUIDE.md"), `# ${task}: 평가자 가이드

이 폴더는 두 agent가 연 workspace 밖에 두세요. mode 폴더 하나만 열고,
실험 상위 폴더나 원본 repository는 열지 않습니다. 폴더 분리는 우발적 발견을 줄일 뿐
도구 접근을 차단하지 않습니다. 강한 격리가 필요하면 평가자 자료를 다른 장치·계정에
두고 filesystem 접근을 제한하세요. Agent 프롬프트에 이 경로를 넣지 마세요.

## 진행 절차

모든 mode에서 모델·버전, 도구, 업무 요청, 언어, 시간, 초기 DB를 동일하게 맞춥니다.
Pair·Driver 세션을 새로 시작하고 브라우저 저장소를 비웁니다. 서버는 한 쌍만 실행합니다.
같은 사람이 뒤에 수행한 실험은 앞선 학습의 영향을 받으므로 참여자별 mode 순서를 바꿉니다.
실제 참여자가 없다면 고정된 사용자 시나리오로 scripted smoke test를 수행하되,
이를 개발자의 학습 효과를 입증하는 근거로 해석하지 않습니다.

사용자가 Pair와 업무 요청을 논의하고 Driver에게 맡길 내용을 직접 결정·작성하게 합니다.
Driver 작업 후 구체적인 관찰 결과와 함께 Pair로 돌아옵니다.
Pair에게 완성된 구현 프롬프트를 대신 쓰게 하지 마세요.

TASK.full.md에는 원본 구현 실습 계약이 보존됩니다. 그 문서의 DB 실행 명령은
원본 repository에서 해당 과제를 실행할 때의 설정입니다. 내보낸 환경에서는 각 RUN.md를 따르세요.
발견 중심 실험에서 전달하지 않은 요구사항을 숨은 채점 기준으로 쓰면 안 됩니다.
계약 구현 실험은 작업 전에 상세 기준을 공개하고 별도 조건으로 기록합니다.
질문받은 비즈니스 제약은 알려주되 구현 방식과 trade-off는 열어 두세요.
후속 질문은 선택적인 상황 제시이며, 필수 문구나 고정된 대화 순서가 아닙니다.
${scenario.evaluatorOnly ? "\ninputs/ 예시는 처음에는 공개하지 않습니다. 사용자가 예시를 요청하거나 관련 후속\n상황을 제시할 때 공개하고, 공개 시점을 기록하세요.\n" : ""}

## 단계별 후속 상황

${scenario.followups.map((followup, index) => `${index + 1}. ${followup}`).join("\n\n")}

## 관찰 기록

Mode·모델·버전, 사용자 경험, 실행 순서, source manifest, 공개 기준, 절차 변경을 기록합니다.
다음 표에는 짧은 대화 발췌와 관찰 결과를 남기세요.

| 시점 | 사용자의 전제·판단 | Pair의 기여 | 사용자 결정과 Driver 지시 | Driver 이후 근거 | 남은 위험 |
| --- | --- | --- | --- | --- | --- |
| 첫 논의 | | | | | |
| Driver에서 복귀 | | | | | |
| 조건 변경 | | | | | |

미러링, 맥락에 맞는 지식 제공, 능동적 공동 탐색, 반례와 안티 케이스,
느슨한 체크포인트, 위험 기반 개입이 실제로 유용했는지 관찰합니다.
관련성, 시점, 도움의 밀도, 불필요한 개입, 사용자 주도권 보존을 비교하세요.
특정 문구·질문 수·프롬프트 품질·코드 완성을 Navigator 품질의 대리 지표로 채점하지 않습니다.
테스트는 앱을 검증할 뿐 Pair 행동을 평가하지 않습니다.
하나의 시나리오로 학습 효과나 보편적인 최적 mode를 입증할 수 없습니다.

## 복원

서버를 중지하고 결과를 별도로 보관합니다. 데이터만 다시 시작하려면 해당 실행 폴더의
SQLite 파일과 -wal/-shm sidecar를 제거하고, baseline.sqlite를 그 폴더의
.data/marketlane.sqlite로 복사합니다. 브라우저 저장소를 비우고 새 세션을 시작하세요.
코드 변경은 복원되지 않습니다. 전체 재실험에는 손대지 않은 mode 복사본을 사용하거나
동일한 원본 source snapshot에서 새로운 실험을 준비하세요.
`);

  for (const mode of modes) {
    const run = path.join(output, mode);
    mkdirSync(run);
    for (const { filename, content } of snapshot) {
      const destination = path.join(run, filename);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    }
    const packagePath = path.join(run, "package.json");
    const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
    delete manifest.scripts["pairing:prepare"];
    writeFileSync(packagePath, JSON.stringify(manifest, null, 2) + "\n");
    mkdirSync(path.join(run, ".data"));
    copyFileSync(baseline, path.join(run, ".data/marketlane.sqlite"));
    if (!scenario.evaluatorOnly) {
      for (const filename of scenario.assets) writeFileSync(path.join(run, filename), assets[filename]!);
    }
    writeFileSync(path.join(run, "TASK.md"), `${taskText.split("\n")[0]}\n\n## 업무 요청\n\n${brief[1]!.trim()}\n\n기존 제품 규칙 중 이 업무 요청에서 바꾸는 동작 외에는 보존하세요. 미정인 동작과 범위는 사용자와 논의하세요.\n\n## Pair 시작 질문\n\n${openingQuestion}\n`);
    writeFileSync(path.join(run, "RUN.md"), `# ${task}: ${mode}

VS Code에서 이 폴더만 열고 Wellactually ${mode}의 새 Pair 세션을 시작하세요.
TASK.md로 논의를 시작합니다. 사용자가 판단하고 Driver 지시를 작성하며,
Driver 작업을 관찰한 뒤 Pair로 돌아옵니다.

## Pair 시작 질문

${openingQuestion}

## 실행

npm ci, npm run dev 순서로 실행하고 http://127.0.0.1:5178 을 엽니다.
다른 실험에서 상속된 MARKETLANE_DB, MARKETLANE_FAULT, PORT는 해제하세요.
기본 .data/marketlane.sqlite는 이 실험만의 seed 복사본입니다. 초기화하거나 다른 실험과
공유하지 마세요. 브라우저 저장소를 비우고 다른 Marketlane 서버를 먼저 중지하세요.
기본 UI/API 포트는 5178/4310입니다.

이 폴더는 Git clone이 아닌 source snapshot입니다. 실험 준비 코드와 평가 테스트는
제외되어 있습니다. docs/pairing.md의 준비 명령은 원본 repository에만 적용됩니다.
여기서도 npm test와 npm run build를 실행할 수 있습니다. 태스크 구현은 적용되지 않았습니다.
`);
  }
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [task, output, ...extra] = process.argv.slice(2);
    if (!task || !output || extra.length) throw new Error("Usage: npm run pairing:prepare -- <task> <new-output-directory>");
    const { taskText, assets } = loadPairingTask(task);
    console.log(`네 mode workspace와 평가자 자료를 생성했습니다: ${preparePairingRuns(task, output, taskText, assets)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}