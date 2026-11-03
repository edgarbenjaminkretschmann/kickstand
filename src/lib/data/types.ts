// Plain record types returned by the data layer. Callers never see Drizzle objects.
export type { BikeRow as Bike, LoanRow as Loan, ProfileRow as Profile, ListingRow as Listing } from "../../db/schema";

export interface HandedOverItems {
  keys: boolean;
  keyCount: number;
  registration: boolean;
  other: string;
}
