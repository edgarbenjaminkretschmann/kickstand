import { beforeAll, describe, expect, it } from "vitest";
import {
  getConversationForUser,
  listConversations,
  listMessages,
  markRead,
  sendMessage,
  startConversation,
  unreadTotal,
} from "../src/lib/data/conversations";
import { DataError } from "../src/lib/data/errors";
import { createListing, setListingStatus } from "../src/lib/data/listings";
import { createLoan, getLoanForUser, resolveLoanLinks } from "../src/lib/data/loans";
import { ERIKA, ERIKA_BIKE, listingInput, MAX, OTTO, setupDb } from "./helpers/db";

let listingId: string;
let bikeListingId: string;
let conversationId: string;

beforeAll(async () => {
  await setupDb();
  listingId = await createListing(ERIKA, listingInput({ categorySlug: "garage", title: "Stellplatz frei" }));
  bikeListingId = await createListing(ERIKA, listingInput({ categorySlug: "motorrad-leihen", title: "VFR zum Leihen", bikeId: ERIKA_BIKE }));
  conversationId = await startConversation(listingId, MAX, "Ist der Platz noch frei?");
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof DataError ? e.code : "other";
  }
};

describe("conversation access", () => {
  it("lets buyer and seller read it, each with their role", async () => {
    expect((await getConversationForUser(conversationId, MAX))?.role).toBe("buyer");
    expect((await getConversationForUser(conversationId, ERIKA))?.role).toBe("seller");
    expect(await listMessages(conversationId, MAX)).toHaveLength(1);
    expect(await listMessages(conversationId, ERIKA)).toHaveLength(1);
  });

  it("hides it from everyone else", async () => {
    expect(await getConversationForUser(conversationId, OTTO)).toBeNull();
    expect(await listMessages(conversationId, OTTO)).toBeNull();
    expect(await listConversations(OTTO)).toEqual([]);
  });

  it("lets only buyer and seller write", async () => {
    expect(await code(sendMessage(conversationId, ERIKA, "Ja, ab November."))).toBe("ok");
    expect(await code(sendMessage(conversationId, OTTO, "Ich auch!"))).toBe("NOT_FOUND");
    expect(await listMessages(conversationId, MAX)).toHaveLength(2);
  });

  it("does not let a third person mark messages as read", async () => {
    expect(await unreadTotal(MAX)).toBe(1);
    await markRead(conversationId, OTTO);
    expect(await unreadTotal(MAX)).toBe(1);
    await markRead(conversationId, MAX);
    expect(await unreadTotal(MAX)).toBe(0);
  });

  it("reuses the conversation for the same member and listing", async () => {
    expect(await startConversation(listingId, MAX, "Noch eine Frage")).toBe(conversationId);
  });

  it("refuses messages to your own listing and to listings that are not active", async () => {
    expect(await code(startConversation(listingId, ERIKA, "Hallo ich"))).toBe("BAD_REQUEST");
    const done = await createListing(ERIKA, listingInput({ title: "Schon weg" }));
    await setListingStatus(ERIKA, done, "erledigt");
    expect(await code(startConversation(done, OTTO, "Noch da?"))).toBe("BAD_REQUEST");
  });

  it("gives the borrower of a linked loan access, but not other members", async () => {
    const conv = await startConversation(bikeListingId, OTTO, "Kann ich die VFR leihen?");
    const links = await resolveLoanLinks(ERIKA, ERIKA_BIKE, bikeListingId, conv);
    expect(links).toEqual({ listingId: bikeListingId, conversationId: conv });
    await createLoan("loan_otto", ERIKA_BIKE, ERIKA, links);
    expect((await getLoanForUser("loan_otto", OTTO))?.role).toBe("borrower");
    expect(await getLoanForUser("loan_otto", MAX)).toBeNull();
    // A conversation about another listing never links.
    expect(await resolveLoanLinks(ERIKA, ERIKA_BIKE, bikeListingId, conversationId)).toEqual({ listingId: bikeListingId, conversationId: null });
  });
});
