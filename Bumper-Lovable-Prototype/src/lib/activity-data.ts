export type ScreenTimeEntry = {
  date: string;
  minutes: number;
};

export type ActivityChild = {
  id: string;
  screenTimeHistory?: readonly ScreenTimeEntry[];
};

export type ActivityWindow = {
  startDate: string;
  endDate: string;
  days: number;
};

type BuildActivityOptions = {
  endDate: string;
  daysBack: number;
};

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const labelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const toUtcDate = (date: string): Date => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid activity date: ${date}`);
  }
  return parsed;
};

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const toIsoDate = (date: Date): string => isoDateFormatter.format(date);

const toHours = (minutes: number): number => Number((minutes / 60).toFixed(1));

export const buildActivityWindow = ({
  endDate,
  daysBack,
}: BuildActivityOptions): ActivityWindow => {
  const end = toUtcDate(endDate);
  const startDate = toIsoDate(addUtcDays(end, -daysBack));

  return {
    startDate,
    endDate: toIsoDate(end),
    days: daysBack + 1,
  };
};

export const buildActivityChartData = (
  children: readonly ActivityChild[],
  options: BuildActivityOptions,
): Array<Record<string, string | number>> => {
  const end = toUtcDate(options.endDate);
  const start = addUtcDays(end, -options.daysBack);

  return Array.from({ length: options.daysBack + 1 }, (_, index) => {
    const date = addUtcDays(start, index);
    const isoDate = toIsoDate(date);
    const row: Record<string, string | number> = {
      day: labelFormatter.format(date),
      date: isoDate,
    };

    for (const child of children) {
      const entry = child.screenTimeHistory?.find((item) => item.date === isoDate);
      row[child.id] = entry ? toHours(entry.minutes) : 0;
    }

    return row;
  });
};

export const getLatestScreenTimeMinutes = (child: ActivityChild, date: string): number =>
  child.screenTimeHistory?.find((entry) => entry.date === date)?.minutes ?? 0;
