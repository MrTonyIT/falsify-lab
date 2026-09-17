import { t, formatNumber } from "./i18n";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { BarChart3, GitBranch, Timer, Coins, Hash } from "lucide-react";
const colors = ["#a38aee", "#71c7d4", "#718bc9", "#d78eab"];
function ChartCard({
  title,
  subtitle,
  rows,
  unit = "%",
  icon: Icon = BarChart3,
}: any) {
  return (
    <section className="panel chart-card">
      <div className="chart-heading">
        <div>
          <h3>{t(title)}</h3>
          <p>{t(subtitle)}</p>
        </div>
        <Icon size={17} />
      </div>
      {rows?.length ? (
        <ResponsiveContainer width="100%" height={218}>
          <BarChart
            data={rows}
            margin={{ top: 15, right: 12, bottom: 0, left: -20 }}
          >
            <CartesianGrid
              stroke="#272931"
              vertical={false}
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9294a6", fontSize: 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#676b7e", fontSize: 10 }}
              domain={unit === "%" ? [0, 100] : undefined}
            />
            <Tooltip
              cursor={{ fill: "#ffffff04" }}
              contentStyle={{
                background: "#202129",
                border: "1px solid #41414d",
                borderRadius: 8,
                color: "#e2e2ee",
                fontSize: 12,
              }}
              formatter={(value: any) => [
                formatNumber(Number(value), 2) + t(unit),
                t("Measured"),
              ]}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              maxBarSize={42}
              animationDuration={600}
              isAnimationActive={
                !matchMedia("(prefers-reduced-motion: reduce)").matches
              }
            >
              {rows.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="chart-empty">
          <div className="ghost-chart" aria-hidden="true">
            {[32, 55, 43, 78, 58, 95, 72].map((h, i) => (
              <i key={i} style={{ height: h }} />
            ))}
          </div>
          <span>{t("NOT RUN")}</span>
          <p>{t("Waiting for measured results")}</p>
        </div>
      )}
    </section>
  );
}
export default function Charts({ metric, groups, runs }: any) {
  const by = (key) =>
    Object.entries(metric?.breakdowns?.[key] ?? {})
      .filter(([, v]: any) => v.kill_at_3 != null)
      .map(([name, v]: any) => ({ name, value: v.kill_at_3 }));
  const attempts = runs.flatMap((r) => r.attempts ?? []),
    finals = runs.flatMap((r) => r.finals ?? []);
  const comparison = groups
    .filter((g) => g.kill_at_3 != null)
    .map((g) => ({
      name: g.key.includes("random50")
        ? t("Random @50")
        : g.key.includes("random3")
          ? t("Random @3")
          : g.key.includes("|demo|")
            ? t("Demo fixture")
            : t("AI @3"),
      value: g.key.includes("random50") ? g.kill_at_50 : g.kill_at_3,
    }));
  return (
    <div className="charts-grid">
      <ChartCard
        title={t("Kill rate by difficulty")}
        subtitle={t("Div2 A / B / C · selected dataset")}
        rows={by("division")}
      />
      <ChartCard
        title={t("Bugs that survived more tests")}
        subtitle={t("Kill@3 by passedTestCount bucket")}
        rows={by("passed_test_count")}
        icon={GitBranch}
      />
      <ChartCard
        title={t("The adversary vs. random testing")}
        subtitle={t("Matched @3 budget and extended @50")}
        rows={comparison}
      />
      <ChartCard
        title={t("Attempt efficiency")}
        subtitle={t("Completed pairs by attempts used")}
        rows={
          finals.length
            ? [1, 2, 3].map((n) => ({
                name: t("Attempt ") + n,
                value: finals.filter((f) => f.attempts_used === n).length,
              }))
            : []
        }
        unit=" pairs"
        icon={Timer}
      />
      <ChartCard
        title={t("Model cost by attempt")}
        subtitle={t("Recorded API usage in US dollars")}
        rows={
          attempts.length
            ? [1, 2, 3].map((n) => ({
                name: t("Attempt ") + n,
                value: attempts
                  .filter((a) => a.attempt === n)
                  .reduce((sum, a) => sum + a.cost_usd, 0),
              }))
            : []
        }
        unit=" USD"
        icon={Coins}
      />
      <ChartCard
        title={t("Successful input sizes")}
        subtitle={t("Serialized bytes · semantic sizes remain separate")}
        rows={finals
          .filter((f) => f.killed && f.min_input_size != null)
          .slice(0, 12)
          .map((f, i) => ({ name: "#" + (i + 1), value: f.min_input_size }))}
        unit=" bytes"
        icon={Hash}
      />
    </div>
  );
}
