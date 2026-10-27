import { beforeAll, describe, expect, it } from "vitest";
import { createListing, getListingDetail, searchListings, setListingStatus, updateListing } from "../src/lib/data/listings";
import { DataError } from "../src/lib/data/errors";
import { ERIKA, ERIKA_BIKE, listingInput, MAX, MAX_BIKE, setupDb } from "./helpers/db";

const ids: Record<string, string> = {};

beforeAll(async () => {
  await setupDb();
  ids.garage = await createListing(ERIKA, listingInput({ categorySlug: "garage", title: "Stellplatz im Winter frei", city: "Leipzig", zip: "04109" }));
  ids.hebebuehne = await createListing(ERIKA, listingInput({ categorySlug: "hilfe", title: "Hilfe beim Reifenwechsel", description: "Hebebühne vorhanden" }));
  ids.ventil = await createListing(MAX, listingInput({ type: "suche", categorySlug: "hilfe", title: "Ventilspiel einstellen", city: "Leipzig", zip: "04229" }));
  ids.porto = await createListing(MAX, listingInput({ type: "suche", categorySlug: "tour", title: "Mitfahrer Serra da Estrela", city: "Porto", zip: "4000", country: "PT" }));
  ids.done = await createListing(MAX, listingInput({ categorySlug: "hilfe", title: "Hebebühne abzugeben" }));
  await setListingStatus(MAX, ids.done, "erledigt");
});

const found = async (f: Parameters<typeof searchListings>[0]) => (await searchListings(f)).items.map((l) => l.id).sort();

describe("listing search", () => {
  it("finds only active listings", async () => {
    const all = await found({});
    expect(all).toHaveLength(all.filter((x) => x !== ids.done).length);
    expect(all).not.toContain(ids.done);
  });

  it("filters by type", async () => {
    expect(await found({ type: "suche" })).toEqual([ids.ventil, ids.porto].sort());
    expect(await found({ type: "biete" })).toEqual([ids.garage, ids.hebebuehne].sort());
  });

  it("filters by category", async () => {
    expect(await found({ category: "hilfe" })).toEqual([ids.hebebuehne, ids.ventil].sort());
  });

  it("matches keywords in title and description, case-insensitive", async () => {
    expect(await found({ q: "hebebühne" })).toEqual([ids.hebebuehne]);
    expect(await found({ q: "STELLPLATZ" })).toEqual([ids.garage]);
    expect(await found({ q: "ventil einstellen" })).toEqual([ids.ventil]);
    expect(await found({ q: "50%" })).toEqual([]);
  });

  it("folds umlauts and capitals the same way for keyword and Ort", async () => {
    const id = await createListing(ERIKA, listingInput({ title: "ÖLWECHSEL in der Halle", city: "Überlingen", zip: "88662" }));
    expect(await found({ q: "ölwechsel" })).toEqual([id]);
    expect(await found({ ort: "über" })).toEqual([id]);
    expect(await found({ ort: "ÜBERLINGEN" })).toEqual([id]);
  });

  it("matches Ort or PLZ as a prefix", async () => {
    expect(await found({ ort: "leip" })).toEqual([ids.garage, ids.ventil].sort());
    expect(await found({ ort: "04" })).toEqual([ids.garage, ids.ventil].sort());
    expect(await found({ ort: "042" })).toEqual([ids.ventil]);
    expect(await found({ ort: "zig" })).toEqual([]);
  });

  it("combines type, category, keyword and Ort", async () => {
    expect(await found({ type: "suche", category: "hilfe", q: "ventil", ort: "Leipzig" })).toEqual([ids.ventil]);
    expect(await found({ type: "biete", category: "hilfe", q: "ventil", ort: "Leipzig" })).toEqual([]);
  });

  it("pages 20 at a time, newest first", async () => {
    const r = await searchListings({ page: 9 });
    expect(r.page).toBe(1);
    expect(r.pageCount).toBe(1);
    expect(r.items[0].createdAt.getTime()).toBeGreaterThanOrEqual(r.items.at(-1)!.createdAt.getTime());
  });
});

describe("only the owner can edit a listing", () => {
  it("lets the owner update", async () => {
    await updateListing(ERIKA, ids.garage, listingInput({ categorySlug: "garage", title: "Stellplatz ab November" }));
    expect((await getListingDetail(ids.garage))!.title).toBe("Stellplatz ab November");
  });

  it("rejects everyone else with NOT_FOUND and changes nothing", async () => {
    await expect(updateListing(MAX, ids.garage, listingInput({ title: "Gehört jetzt mir" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setListingStatus(MAX, ids.garage, "erledigt")).rejects.toBeInstanceOf(DataError);
    const l = await getListingDetail(ids.garage);
    expect(l!.title).toBe("Stellplatz ab November");
    expect(l!.status).toBe("aktiv");
  });
});

describe("bike listings", () => {
  const bikeOffer = (bikeId: string | null) => listingInput({ categorySlug: "motorrad-leihen", title: "VFR zum Leihen", bikeId, priceKind: "preis", priceCents: 5000 });

  it("cannot be created without a bike", async () => {
    await expect(createListing(ERIKA, bikeOffer(null))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cannot be created with someone else's bike", async () => {
    await expect(createListing(ERIKA, bikeOffer(MAX_BIKE))).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("works with your own bike and is always free", async () => {
    const id = await createListing(ERIKA, bikeOffer(ERIKA_BIKE));
    const l = await getListingDetail(id);
    expect(l!.bikeId).toBe(ERIKA_BIKE);
    expect(l!.priceKind).toBe("kostenlos");
    expect(l!.priceCents).toBeNull();
  });

  it("a bike search (suche) needs no bike, and other categories never keep one", async () => {
    const wanted = await createListing(MAX, listingInput({ type: "suche", categorySlug: "motorrad-leihen", title: "Suche Enduro" }));
    expect((await getListingDetail(wanted))!.bikeId).toBeNull();
    const tool = await createListing(ERIKA, listingInput({ bikeId: ERIKA_BIKE }));
    expect((await getListingDetail(tool))!.bikeId).toBeNull();
  });
});
