// Request/loan date overlap rules. Pure, so they can be tested without a DB.
import { addDays } from "./dates";

/** An accepted request has no end date yet, so we assume it blocks the bike for this many days. */
export const ASSUMED_LOAN_DAYS = 30;

/** Inclusive ISO date range check: does `day` fall within [from, to]? `to` null means open-ended. */
export function dayInRange(day: string, from: string, to: string | null): boolean {
  return day >= from && (to === null || day <= to);
}

/** The window an accepted request is assumed to occupy until a real contract exists. */
export function requestWindow(desiredStart: string): [string, string] {
  return [desiredStart, addDays(desiredStart, ASSUMED_LOAN_DAYS)];
}

/** The window a loan occupies: start until its fixed end, or until the latest end date of an open loan. */
export function loanWindow(loan: {
  startDate?: string | null;
  endMode: string;
  endDate?: string | null;
  latestEndDate?: string | null;
}): [string, string | null] | null {
  if (!loan.startDate) return null;
  const end = loan.endMode === "fixed" ? loan.endDate : loan.latestEndDate;
  return [loan.startDate, end ?? null];
}
