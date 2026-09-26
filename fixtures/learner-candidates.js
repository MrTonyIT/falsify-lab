// AI-authored draft exercises, NOT Codeforces acquisitions or independently reviewed oracles.
// No automatic promotion into loadCorpus or the live execution allowlist.
const prefix = "n=int(input())\na=list(map(int,input().split()))\n";
const spec = [
  [
    "draft-signed-total",
    "Signed total",
    "Print the sum of all integers.",
    (a) => a.reduce((x, y) => x + y, 0),
    [
      "print(sum(a))",
      "s=0\nfor x in a: s+=x\nprint(s)",
      "from functools import reduce\nprint(reduce(lambda x,y:x+y,a,0))",
    ],
    "print(sum(abs(x) for x in a))",
    [[-2, 3], 1],
  ],
  [
    "draft-distinct",
    "Distinct values",
    "Print the number of distinct integer values.",
    (a) => new Set(a).size,
    [
      "print(len(set(a)))",
      "seen=[]\nfor x in a:\n if x not in seen: seen.append(x)\nprint(len(seen))",
      "a.sort()\nprint(1+sum(a[i]!=a[i-1] for i in range(1,n)))",
    ],
    "print(n)",
    [[2, 2, 3], 2],
  ],
  [
    "draft-spread",
    "Array spread",
    "Print the largest value minus the smallest value.",
    (a) => Math.max(...a) - Math.min(...a),
    [
      "print(max(a)-min(a))",
      "a.sort()\nprint(a[-1]-a[0])",
      "lo=hi=a[0]\nfor x in a:\n lo=min(lo,x); hi=max(hi,x)\nprint(hi-lo)",
    ],
    "print(a[-1]-a[0])",
    [[3, -2, 1], 5],
  ],
  [
    "draft-positive",
    "Strictly positive values",
    "Print the count of values strictly greater than zero.",
    (a) => a.filter((x) => x > 0).length,
    [
      "print(sum(x>0 for x in a))",
      "s=0\nfor x in a:\n if x>0: s+=1\nprint(s)",
      "print(len(list(filter(lambda x:x>0,a))))",
    ],
    "print(sum(x>=0 for x in a))",
    [[0, 1, -1], 1],
  ],
  [
    "draft-runs",
    "Equal-value runs",
    "Print the number of maximal contiguous runs of equal values.",
    (a) => 1 + a.slice(1).filter((x, i) => x !== a[i]).length,
    [
      "print(1+sum(a[i]!=a[i-1] for i in range(1,n)))",
      "from itertools import groupby\nprint(sum(1 for _ in groupby(a)))",
      "s=1\nprev=a[0]\nfor x in a[1:]:\n if x!=prev: s+=1\n prev=x\nprint(s)",
    ],
    "print(len(set(a)))",
    [[1, 2, 1], 3],
  ],
];
export function validateCandidate(data) {
  const source = data.toString("utf8");
  if (!/^[\s\d+-]+$/.test(source)) return { ok: false };
  const lines = source.trim().split(/\r?\n/);
  if (lines.length !== 2 || !/^\d+$/.test(lines[0])) return { ok: false };
  const n = Number(lines[0]),
    words = lines[1].trim().split(/\s+/);
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 20 ||
    words.length !== n ||
    words.some((s) => !/^[+-]?\d+$/.test(s))
  )
    return { ok: false };
  const a = words.map(Number);
  return a.every((x) => Number.isInteger(x) && x >= -10 && x <= 10)
    ? { ok: true, semanticSize: n, values: a }
    : { ok: false };
}
const input = (a) => a.length + "\n" + a.join(" ") + "\n";
export const learnerCandidates = spec.map(
  ([id, title, statement, solve, refs, wrong, edge]) => ({
    id,
    title,
    statement:
      statement + " Input: first line n; second line exactly n integers.",
    constraints: "1 <= n <= 20; -10 <= a[i] <= 10. Exactly two input lines.",
    checkerName: "tokens",
    language: "python",
    review_status: "pending",
    live_eligible: false,
    source: "AI-authored synthetic draft; not acquired from Codeforces",
    rights:
      "No external source copied; owner has not selected a distribution license",
    version: 1,
    validator: validateCandidate,
    solve,
    referenceDrafts: refs.map((code, i) => ({
      id: "draft-" + (i + 1),
      author: "AI-generated draft (same assistant)",
      provenance: "Synthetic generated source; no ACCEPTED submission evidence",
      independence: "NOT ESTABLISHED",
      review_status: "pending",
      code: prefix + code + "\n",
    })),
    wrongSource: prefix + wrong + "\n",
    bugOrigin: "synthetic",
    samples: [
      { input: input([1, 2, 3]), output: String(solve([1, 2, 3])) + "\n" },
    ],
    counterexample: { input: input(edge[0]), output: String(edge[1]) + "\n" },
    validatorCases: [
      { input: input([0]), valid: true },
      { input: input(Array(20).fill(-10)), valid: true },
      { input: "0\n\n", valid: false },
      { input: "2\n1\n", valid: false },
      { input: "1\n11\n", valid: false },
      { input: "1\n1.5\n", valid: false },
      { input: "1\n1\nextra\n", valid: false },
    ],
  }),
);
export const candidateList = () =>
  learnerCandidates.map(
    ({
      id,
      title,
      statement,
      constraints,
      review_status,
      live_eligible,
      source,
      language,
    }) => ({
      id,
      title,
      statement,
      constraints,
      review_status,
      live_eligible,
      source,
      language,
    }),
  );
