import { authActions } from "./auth";
import { bikeActions } from "./bikes";
import { listingActions } from "./listings";
import { loanActions } from "./loans";
import { messageActions } from "./messages";
import { profileActions } from "./profile";

export const server = {
  auth: authActions,
  profile: profileActions,
  bikes: bikeActions,
  loans: loanActions,
  listings: listingActions,
  messages: messageActions,
};
