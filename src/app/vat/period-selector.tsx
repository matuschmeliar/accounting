import { SK_MONTH_FULL } from "@/lib/vat";

type Props = {
  year: number;
  month: number;
};

export function PeriodSelector({ year, month }: Props) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <form action="/vat" method="GET" className="flex items-center gap-2">
      <select
        name="month"
        defaultValue={month}
        className="h-8 rounded-md border border-border bg-card px-2.5 text-[12px] outline-none focus:border-foreground/30"
      >
        {SK_MONTH_FULL.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        name="year"
        defaultValue={year}
        className="h-8 rounded-md border border-border bg-card px-2.5 text-[12px] outline-none focus:border-foreground/30"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-8 rounded-md bg-foreground px-3 text-[12px] font-medium text-background hover:bg-foreground/90 transition-colors"
      >
        Načítať
      </button>
    </form>
  );
}
