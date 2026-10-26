/** A UTC calendar day as `YYYY-MM-DD`. Snapshots and leaderboards are keyed by this. */
export type Day = string;

export const toDay = (date: Date): Day => date.toISOString().slice(0, 10);

export const today = (): Day => toDay(new Date());

export const shiftDay = (day: Day, days: number): Day => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
};

/** Unix seconds at the start of the day, for Discord `<t:...>` timestamps. */
export const dayToUnix = (day: Day) => Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 1000);
