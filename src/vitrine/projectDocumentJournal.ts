const journalDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isProjectDocumentJournalDate(
  value: string | null | undefined,
): value is string {
  if (!value || !journalDatePattern.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    localDateKey(date) === value
  );
}

export function localDateKey(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftJournalDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function journalWeekDates(value: string): string[] {
  const date = new Date(`${value}T12:00:00`);
  const weekStart = shiftJournalDate(value, -date.getDay());
  return Array.from({ length: 7 }, (_, index) =>
    shiftJournalDate(weekStart, index),
  );
}

export interface ProjectDocumentMentionDate {
  dateKey: string;
  label: string;
  suffix: string;
}

export function projectDocumentMentionDates(
  query: string,
  value = new Date(),
): ProjectDocumentMentionDate[] {
  const today = localDateKey(value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const explicitDate = isProjectDocumentJournalDate(query.trim())
    ? query.trim()
    : undefined;
  const tomorrow = shiftJournalDate(today, 1);
  const yesterday = shiftJournalDate(today, -1);
  const dateKeys = [
    today,
    tomorrow,
    yesterday,
    ...Array.from({ length: 6 }, (_, index) =>
      shiftJournalDate(today, index + 2),
    ),
    ...(explicitDate ? [explicitDate] : []),
  ].filter((dateKey, index, values) => values.indexOf(dateKey) === index);

  return dateKeys
    .map((dateKey) => {
      const date = new Date(`${dateKey}T12:00:00`);
      const suffix = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
      const label =
        dateKey === today
          ? "Today"
          : dateKey === tomorrow
            ? "Tomorrow"
            : dateKey === yesterday
              ? "Yesterday"
              : new Intl.DateTimeFormat("en-US", {
                  weekday: "long",
                }).format(date);
      return { dateKey, label, suffix };
    })
    .filter(({ dateKey, label, suffix }) =>
      `${label} ${suffix} ${dateKey}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
}
