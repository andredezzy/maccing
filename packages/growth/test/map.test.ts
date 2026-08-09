import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type DatabaseMap,
  load_map,
  MapDuplicateBindingError,
  MapFieldError,
  MapMissingError,
  MapSectionError,
  verify_fingerprint,
} from "../src/internal/map.ts";
import { PhoneFormatError } from "../src/internal/phone.ts";

/**
 * The map is the only place a project describes its own tables, and it is markdown because a
 * human has to be able to read the reasoning next to the binding. That makes the parser the
 * boundary where a typo becomes either an error or a silently missing role, and the second one
 * is unacceptable: a binding that goes missing produces a run reporting zero of something,
 * which reads exactly like a result. So the suite spends most of its assertions on what the
 * parser refuses, not on what it accepts.
 *
 * Every table name, column name and figure in these fixtures is invented, the numbering plan
 * included: `997` is not a dialling code any country answers on, and no market pairs a
 * three-digit area code with a six-digit subscriber tail. The parser reads every length out of
 * the document, so a plan copied from somewhere real would test nothing extra and would invite
 * being reused as though it described that place.
 */

/** An invented digest. Nothing verifies it during `load_map`, so it only has to be well-formed. */
const PLACEHOLDER_SHA = "1b3a9d0c7e5f24688a0d3c5e7f91b2d4c6e8a0f2143658790abcdef012345678";

const PHONE_SECTION = `## Phone format

The area code is fixed at three digits in this market and the trailing six digits survived the
last numbering reform, so a key built from those two pieces joins across exports taken years
apart.

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
| area_codes | 480, 481 ,  482 |
`;

const FINGERPRINT_SECTION = `## Fingerprint

| field | value |
|---|---|
| schema | db/schema.prisma |
| models | Account, Ledger |
| sha256 | ${PLACEHOLDER_SHA} |
`;

const PERSON_SECTION = `## Role: person

| field | value |
|---|---|
| export | person.csv |
| id | account_id |
| phone | phone_digits |
| created_at | created_at |
`;

const REVENUE_SECTION = `## Role: revenue

| field | value |
|---|---|
| export | revenue.csv |
| person | account_id |
| at | received_at |
| amount | amount_minor |
`;

const CHURN_SECTION = `## Role: churn

| field | value |
|---|---|
| export | churn.csv |
| person | account_id |
| at | requested_at |
| amount | amount_minor |
`;

const CONVERSION_SECTION = `## Role: conversion

| field | value |
|---|---|
| export | conversion.csv |
| person | account_id |
| at | committed_at |
| at_fallback | created_at |
| amount | amount_minor |
| status | state |
| valid_statuses | ACTIVE, COMPLETED |
| split | origin |
| recycled_when | RECYCLED |
`;

/** Assembles a document from whichever sections a case wants, with a title on top. */
function compose(...sections: string[]): string {
  return ["# Database map\n", ...sections].join("\n");
}

const COMPLETE = compose(
  PHONE_SECTION,
  FINGERPRINT_SECTION,
  PERSON_SECTION,
  REVENUE_SECTION,
  CHURN_SECTION,
  CONVERSION_SECTION,
);

let root = "";

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "growth-map-"));
});

afterAll(async () => {
  if (root !== "") {
    await rm(root, { recursive: true, force: true });
  }
});

/** Writes a fixture document and returns the path to hand to `load_map`. */
async function write_map(name: string, body: string): Promise<string> {
  const path = join(root, name, "MAPPING.md");
  await Bun.write(path, body);
  return path;
}

/** Returns the error a rejection produced, and fails if there was no rejection at all. */
async function caught(work: Promise<unknown>): Promise<Error> {
  try {
    await work;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the map to be rejected, but it was accepted");
}

describe("load_map on a complete document", () => {
  test("reads the phone format with numbers as numbers and lists as trimmed arrays", async () => {
    const map = await load_map(await write_map("complete", COMPLETE));

    // The country code stays a string. Read as a number it would lose a leading zero in
    // the markets that have one, and it is never arithmetic.
    expect(map.phone.country_code).toBe("997");
    expect(map.phone.area_digits).toBe(3);
    expect(map.phone.subscriber_digits).toBe(6);
    expect(map.phone.max_unparseable_rate).toBe(0.25);
    expect(map.phone.shared_account_ceiling).toBe(3);
    expect(typeof map.phone.area_digits).toBe("number");
    expect(typeof map.phone.max_unparseable_rate).toBe("number");
    // Written with ragged spacing in the fixture on purpose.
    expect(map.phone.area_codes).toEqual(["480", "481", "482"]);
  });

  test("reads the fingerprint section", async () => {
    const map = await load_map(await write_map("complete-fingerprint", COMPLETE));

    expect(map.fingerprint.schema).toBe("db/schema.prisma");
    expect(map.fingerprint.models).toEqual(["Account", "Ledger"]);
    expect(map.fingerprint.sha256).toBe(PLACEHOLDER_SHA);
  });

  test("binds every role to its export and its columns", async () => {
    const map = await load_map(await write_map("complete-roles", COMPLETE));

    expect(map.person.export).toBe("person.csv");
    expect(map.person.columns).toEqual({
      id: "account_id",
      phone: "phone_digits",
      created_at: "created_at",
    });

    expect(map.revenue?.export).toBe("revenue.csv");
    expect(map.revenue?.columns).toEqual({
      person: "account_id",
      at: "received_at",
      amount: "amount_minor",
    });

    expect(map.churn?.export).toBe("churn.csv");
    expect(map.churn?.columns.at).toBe("requested_at");
  });

  test("keeps the conversion role's statuses and split marker out of its columns", async () => {
    const map = await load_map(await write_map("complete-conversion", COMPLETE));

    expect(map.conversion.export).toBe("conversion.csv");
    expect(map.conversion.columns).toEqual({
      person: "account_id",
      at: "committed_at",
      at_fallback: "created_at",
      amount: "amount_minor",
      status: "state",
      split: "origin",
    });
    // A status list is a set of values, not a column name. Filed under `columns` it would
    // have the reader looking for a column called "ACTIVE, COMPLETED".
    expect(map.conversion.valid_statuses).toEqual(["ACTIVE", "COMPLETED"]);
    expect(map.conversion.recycled_when).toBe("RECYCLED");
  });

  test("leaves the optional roles undefined when their sections are absent", async () => {
    // Undefined is not zero. A project with nothing to collect has no binding, and the
    // record omits the role rather than publishing a measured zero for it.
    const map = await load_map(
      await write_map(
        "no-optional-roles",
        compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
      ),
    );

    expect(map.revenue).toBeUndefined();
    expect(map.churn).toBeUndefined();
    expect(map.person.export).toBe("person.csv");
    expect(map.conversion.export).toBe("conversion.csv");
  });

  test("ignores prose and a sub-heading before the table", async () => {
    // The prose is half the value of the map and the sql block is how the export was
    // taken. Both live under the heading, and neither is the parser's business.
    //
    // The fence here is scenery, and deliberately named as such: sql carries no
    // `| field | value |` header, so nothing in this block could be mistaken for a binding
    // table and this case reads the same whether the fence guard exists or not. What it does
    // pin is the rest — prose, a `###` sub-heading, and prose after the table are all skipped
    // to find the one table that binds. The case below is the one that holds the fence.
    const noisy_person = `## Role: person

Every account carries a phone, but a handful of internal accounts carry a placeholder, which is
why the export filters them out rather than letting them become keys.

### How this export was taken

A one-shot manual export. The parser records the query and never runs it.

\`\`\`sql
\\copy (select account_id, phone_digits, created_at from accounts where phone_digits is not null)
  to 'person.csv' csv header
\`\`\`

| field | value |
|---|---|
| export | person.csv |
| id | account_id |
| phone | phone_digits |
| created_at | created_at |

Anything after the table is prose again.
`;
    const map = await load_map(
      await write_map("noisy", compose(PHONE_SECTION, FINGERPRINT_SECTION, noisy_person, CONVERSION_SECTION)),
    );

    expect(map.person.export).toBe("person.csv");
    expect(map.person.columns.id).toBe("account_id");
    expect(map.person.columns.phone).toBe("phone_digits");
  });

  test("binds the real table, not a complete one demonstrated inside a backtick fence", async () => {
    // A map is half reasoning, and a worked copy of the very table being explained is exactly
    // what somebody adds to one. Read as a binding it is the worst shape this engine can
    // produce: every key comes out of a different dialling plan, so the join silently misses
    // almost everyone — and the same table sets `max_unparseable_rate` to 0.9 and
    // `shared_account_ceiling` to 99, which are the two guards whose entire job is to notice
    // that keys have gone wrong. The fault switches off its own detectors and the run reports
    // a small clean audience with nothing anywhere saying which table it read.
    //
    // The illustration has to be complete for this to bite. A half-finished one is missing a
    // required key and throws, which is loud and already covered; it is the plausible, filled-in
    // example that loads.
    //
    // The same illustration left unfenced is refused outright — the two-tables case further down —
    // so the fence is what makes an example legible here rather than the thing that rescues it.
    const illustrated_phone = `## Phone format

The two lengths are what people get wrong when they first fill this in, so the block below keeps
a completed copy of this same table for a market with two-digit area codes to compare against.
It illustrates the shape and describes no database: nothing in it is a binding.

\`\`\`markdown
| field | value |
|---|---|
| country_code | 999 |
| area_digits | 2 |
| subscriber_digits | 8 |
| max_unparseable_rate | 0.9 |
| shared_account_ceiling | 99 |
\`\`\`

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
| area_codes | 480, 481 ,  482 |
`;
    const map = await load_map(
      await write_map(
        "fenced-example-table",
        compose(illustrated_phone, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
      ),
    );

    expect(map.phone.country_code).toBe("997");
    expect(map.phone.area_digits).toBe(3);
    expect(map.phone.subscriber_digits).toBe(6);
    expect(map.phone.area_codes).toEqual(["480", "481", "482"]);
    // The detectors, named separately from the rest: these are what the illustrated plan would
    // have raised, and a run that reads them from the wrong table cannot report that it did.
    expect(map.phone.max_unparseable_rate).toBe(0.25);
    expect(map.phone.shared_account_ceiling).toBe(3);
  });
});

/**
 * What a renderer draws as code and what it draws as a table, one CommonMark rule at a time, and
 * each rule asked twice.
 *
 * The case above proves a backtick-fenced illustration does not bind. Backticks are half the
 * fences CommonMark defines, and the other half was read as ordinary content: an author who tilde-
 * fenced a worked example was refused for a second table by a message telling him to fence it, and
 * where the tilde-fenced example was the only table under its heading it was installed as the
 * binding with nothing said. Both are measured on the cases that open this block.
 *
 * Most cases here are one illustration under `## Phone format` and one question about the fence
 * around it, and `both_shapes` asks that question of two documents rather than one. The last two
 * ask the opposite question of the same rule — whether a table a renderer does draw is still read
 * — because the indent that decides a fence is the indent that decides a table, and a reader that
 * gets it wrong in that direction drops the binding instead of the illustration.
 *
 * Which way a case goes is not a preference: the parser has to read the document the way a
 * renderer draws it, because an author who checks the preview and sees a code block has been told
 * the parser skipped it, and an author who sees a table has been told nothing of the kind.
 */
describe("load_map reads the document the way a renderer draws it", () => {
  /** The live plan for this market, identical to `PHONE_SECTION`. The table every case must bind. */
  const LIVE_TABLE = `| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
| area_codes | 480, 481 ,  482 |`;

  /** A completed copy of the same table for another market. Describes no database, and opens both
   *  detectors wide, which is what makes reading it as a binding the worst case in this file. */
  const ILLUSTRATION = `| field | value |
|---|---|
| country_code | 999 |
| area_digits | 2 |
| subscriber_digits | 8 |
| max_unparseable_rate | 0.9 |
| shared_account_ceiling | 99 |`;

  /** An otherwise complete map whose `## Phone format` carries `block` above the live table. */
  async function document(name: string, block: string): Promise<string> {
    return write_map(
      name,
      compose(
        `## Phone format\n\n${block}\n\n${LIVE_TABLE}\n`,
        FINGERPRINT_SECTION,
        PERSON_SECTION,
        CONVERSION_SECTION,
      ),
    );
  }

  /** The same map with the live table taken away, so `block` is all the heading carries. */
  async function alone(name: string, block: string): Promise<string> {
    return write_map(
      name,
      compose(`## Phone format\n\n${block}\n`, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
    );
  }

  /** Asserts the live plan bound, both detectors named separately: `max_unparseable_rate` and
   *  `shared_account_ceiling` are the two guards whose job is to notice keys have gone wrong, the
   *  illustration opens both, and a run reading them from the wrong table cannot report that it
   *  did. A case checking only the three lengths would pass while the detectors came from the
   *  illustration. */
  function expect_live_plan(map: DatabaseMap): void {
    expect(map.phone.country_code).toBe("997");
    expect(map.phone.area_digits).toBe(3);
    expect(map.phone.subscriber_digits).toBe(6);
    expect(map.phone.max_unparseable_rate).toBe(0.25);
    expect(map.phone.shared_account_ceiling).toBe(3);
  }

  /**
   * One fence question, asked of both documents that can carry it: `block` is skipped as something
   * a renderer draws as code, so the live table binds where there is one and the heading is left
   * carrying no table at all where there is not.
   *
   * The second document is the point. With the live table below, a fence this parser fails to see
   * is loud — the illustration is a second table and the section is refused by name — and for
   * thirteen documents that was the only shape the fence block built. Which is why the closer's
   * indent bound was defended and the opener's could be widened to anything at all with the whole
   * suite staying green.
   *
   * Take the live table away and a fence this parser fails to see is silent instead. The
   * illustration is the only `| field | value |` table under the heading, so it is installed as the
   * binding, and it is a complete `999/2/8` plan for a market this database has nothing to do with.
   * Measured through `measure()` on three people whose numbers are the two spellings the live
   * market uses, that binding reported `acquired {"accounts":1,"within":{"h24":1,"d7":1,"d30":1}}`
   * and `conversions {"count":1,"value":10}` where the live plan gives 3 and
   * `{"count":3,"value":30}`. A third of the truth, and no error anywhere — the illustration's own
   * `max_unparseable_rate` of 0.9 is what let it through, because two of the three numbers are
   * unreadable under a plan expecting ten digits and 66.7% is under its ceiling where it is far
   * over the 0.25 the live table sets. The fault switched off the detector that would have caught
   * it.
   */
  async function both_shapes(name: string, block: string): Promise<void> {
    expect_live_plan(await load_map(await document(name, block)));

    const error = await caught(load_map(await alone(`${name}-alone`, block)));
    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Phone format");
    expect(error.message).toContain("## Phone format");
  }

  /** The illustration and a fence around it, pushed out to a column — the shape a list item leaves
   *  them in, and the shape the parser has to measure against the item rather than the margin. */
  function fenced_at(column: number): string {
    const pad = " ".repeat(column);
    const rows = ILLUSTRATION.split("\n")
      .map((row) => `${pad}${row}`)
      .join("\n");
    return `${pad}~~~markdown\n${rows}\n${pad}~~~`;
  }

  test("binds the live table, not one demonstrated inside a tilde fence", async () => {
    // The first measured consequence of reading tildes. Before they were read, this exact document
    // was refused for a second table — the author took the refusal's own advice, fenced the
    // illustration, and was refused anyway, by a message that says nothing inside a fence is read
    // here. Measured through `measure()` on three people and a list of the same three numbers, it
    // now reports `acquired {"accounts":3,"within":{"h24":3,"d7":3,"d30":3}}` with
    // `conversions {"count":3,"value":30}` — the same reading a map carrying no illustration gives.
    await both_shapes("tilde-fenced-example", `~~~markdown\n${ILLUSTRATION}\n~~~`);
  });

  test("binds the live table, not one demonstrated inside a backtick fence", async () => {
    // The backtick half of the case above, in this block so that the two spellings are asked the
    // same question by the same helper rather than one of them being asked a weaker one.
    await both_shapes("backtick-fenced-example", `\`\`\`markdown\n${ILLUSTRATION}\n\`\`\``);
  });

  test("reads two tildes as prose and three as a fence", async () => {
    // A fence is three or more of its character, and `~~` is how markdown strikes text through —
    // which is what a map correcting itself writes above the table that replaced the correction.
    // The strike sits between the fenced illustration and the live table on purpose: counted as a
    // fence it opens one there and swallows the live table, leaving the heading with no table at
    // all, and not counted at all the illustration above it is a second table and the document is
    // refused. Both ends of the rule fail this one document.
    await both_shapes(
      "tilde-pair-is-prose",
      `~~~markdown\n${ILLUSTRATION}\n~~~\n\n~~The plan before the reform is struck through here, because the reform replaced it.~~`,
    );
  });

  test("does not close a four-tilde fence on a three-tilde run", async () => {
    // A closer is at least as long as its opener, which is what lets a map explain fencing by
    // showing one. Close on the shorter run and the illustration's header escapes into the
    // document, where it is either a second table or, with no live table under the heading, the
    // binding itself.
    await both_shapes(
      "tilde-closer-too-short",
      `~~~~markdown\nWhere the illustration carries a fence of its own, the outer one has to be longer:\n\n~~~\n${ILLUSTRATION}\n~~~\n~~~~`,
    );
  });

  test("does not close a four-backtick fence on a three-backtick run", async () => {
    // The backtick spelling of the case above. This one was already right before tildes were read
    // and is here because it was undefended: the rewrite that taught the parser tildes could have
    // lost it in either spelling, and nothing in the suite would have said so.
    await both_shapes(
      "backtick-closer-too-short",
      "````markdown\nSome maps open the illustration with three backticks:\n\n```\n" + ILLUSTRATION + "\n```\n````",
    );
  });

  test("does not close a tilde fence on a backtick run", async () => {
    // The two characters do not answer for each other. A tilde-fenced illustration holding a sql
    // block is the ordinary shape of this: a map records the query beside the binding, so an
    // illustration of a map carries one too.
    await both_shapes(
      "tilde-not-closed-by-backtick",
      `~~~markdown\nThe map records the export query beside the binding, so an illustration carries one too:\n\n\`\`\`sql\n\\copy (select member_id, handset from accounts) to 'person.csv' csv header\n\`\`\`\n\n${ILLUSTRATION}\n~~~`,
    );
  });

  test("does not close a backtick fence on a tilde run", async () => {
    // The mirror of the case above, and green before tildes were read for a reason worth writing
    // down: a parser that cannot see tildes at all cannot be closed by one. It is here because a
    // parser that reads both characters can confuse them, and this is the half of that mistake the
    // other case cannot catch.
    await both_shapes(
      "backtick-not-closed-by-tilde",
      `\`\`\`markdown\nSome maps write the illustration with tildes instead:\n\n~~~\n${ILLUSTRATION}\n~~~\n\`\`\``,
    );
  });

  test("does not close a fence on a run indented four columns past its container", async () => {
    // Four columns past the container is an indented code block, for the closer as much as the
    // opener, so the run inside the block below is content — which is exactly what it is to a
    // reader, since the illustration is showing a fence nested under a list item.
    await both_shapes(
      "closer-indented-four",
      `~~~markdown\nAn illustration nested under a list item keeps its own fence indented with it:\n\n    ~~~\n    | field | value |\n    ~~~\n\nAnd the table that fence would hold, for the other market:\n\n${ILLUSTRATION}\n~~~`,
    );
  });

  test("reads a fence indented up to three columns, and closes it at an indent of its own", async () => {
    // The opener's indent constrains nothing about the closer's.
    await both_shapes("opener-indented-three", `   ~~~markdown\n${ILLUSTRATION}\n~~~`);
    await both_shapes("closer-indented-two", `~~~markdown\n${ILLUSTRATION}\n  ~~~`);
  });

  test("reads a fence nested under a list item, measured from the item and not from the margin", async () => {
    // The regression this block was rebuilt around, and the ordinary way a map illustrates
    // anything: the example goes under the bullet that introduces it, and a fence under a bullet
    // is indented with it. CommonMark allows a fence three columns past its container's content,
    // and a parser with no containers has to read that allowance from the left margin instead, so
    // every fence below stopped being a fence. Measured before this was fixed, on the illustration
    // alone under its heading: `LOADED country_code=999 ceiling=99` for all three, against a live
    // `997/3/6` plan of ceiling 3. Both renderers draw the run as a code block, so an author who
    // checked the preview saw code and got a binding.
    await both_shapes(
      "nested-bullet-fence-at-four",
      `- The market this map does not describe:\n  - Its plan, for contrast:\n\n${fenced_at(4)}`,
    );
    await both_shapes("ordered-item-fence-at-four", `10. Its plan, for contrast:\n\n${fenced_at(4)}`);
    // Content column two, fence two columns further in: inside the three CommonMark allows, and
    // four from the margin, which is what the absolute bound refused.
    await both_shapes("bullet-fence-at-four", `- Its plan, for contrast:\n\n${fenced_at(4)}`);
    // The control that stayed correct throughout, kept because it is the half of the rule an
    // over-eager fix could lose: at the item's own content column the fence is a fence.
    await both_shapes("bullet-fence-at-two", `- Its plan, for contrast:\n\n${fenced_at(2)}`);
  });

  test("reads a fence opened on the list marker's own line", async () => {
    // A one-line introduction and the fence on the same line as the bullet is how a short
    // illustration gets written. The marker has to be walked off before the run is looked for, or
    // the line is prose and everything under it is the document's own content.
    const rows = ILLUSTRATION.split("\n")
      .map((row) => `  ${row}`)
      .join("\n");
    await both_shapes("fence-on-the-marker-line", `- ~~~markdown\n${rows}\n  ~~~`);
  });

  test("reads an illustration indented four columns as the code block a renderer draws", async () => {
    // Four spaces at the top level is an indented code block. A renderer draws no table there, so
    // neither does this reader, and the heading below binds the live table with nothing said about
    // the illustration — which is what the page shows.
    //
    // This document used to be refused for a second table, and the refusal was recorded as a
    // deliberate disagreement with the renderer. Measured in the shape that has no live table, that
    // disagreement was not loud at all: the indented illustration was the only table the parser
    // could see and it bound `country_code=999 ceiling=99`, silently, out of a run a reader sees as
    // code. Tracking the container closed it in the direction that agrees with the page.
    const indented = ILLUSTRATION.split("\n")
      .map((row) => `    ${row}`)
      .join("\n");
    await both_shapes("opener-indented-four", `    ~~~markdown\n${indented}\n    ~~~`);
  });

  test("reads a list item whose content starts five columns along as code", async () => {
    // Five or more spaces after the marker put the item's first block into indented code rather
    // than moving the item's content column out to meet it, so the run below is not a fence and
    // the table under it is not a table. A renderer draws neither.
    const rows = ILLUSTRATION.split("\n")
      .map((row) => `      ${row}`)
      .join("\n");
    await both_shapes("marker-then-five-spaces", `-     ~~~markdown\n${rows}\n      ~~~`);

    // With the run closed, moving the item's content out to meet it and leaving it where it belongs
    // look identical — both hide the illustration. Unclosed, they separate: left where it belongs
    // the run is code and the live table below survives, moved out it is an opener with nothing to
    // end it and the table spends the rest of the document inside the block. A renderer draws the
    // table.
    expect_live_plan(await load_map(await document("marker-then-five-spaces-lone-run", "-     ~~~")));
  });

  test("reads a tilde fence whose info string holds a backtick", async () => {
    // An info string may say anything after a tilde opener, backticks included. The restriction
    // belongs to backticks alone and copying it across would refuse the most natural thing an
    // author writes here: naming the table the illustration is a copy of.
    await both_shapes(
      "tilde-info-holds-a-backtick",
      `~~~markdown \`| field | value |\` for another market\n${ILLUSTRATION}\n~~~`,
    );
  });

  test("refuses a backtick opener whose info string holds a backtick, because it is prose", async () => {
    // A backtick fence's info string may not contain a backtick: the line is a paragraph carrying
    // inline code, and a renderer draws the table under it as a table. Before this was read the
    // line opened a fence, the illustration vanished, and the document loaded — the parser hiding
    // a table its own reader can see.
    //
    // The one case in this block `both_shapes` cannot build, and the block's tail is why. With the
    // opener demoted to prose the run that was meant to close it is an opener with nothing after
    // it, so it swallows whatever follows the illustration — the live table in one shape, the next
    // section in the other. Both documents below are laid out so that what it swallows is the end
    // of the file, which leaves the question this case is actually about legible.
    const illustration = `\`\`\`markdown \`| field | value |\` for another market\n${ILLUSTRATION}\n\`\`\``;

    // Read as prose it is a second table, which is what a reader sees, so the live table above it
    // is not the only one under the heading and the document is refused by name.
    const error = await caught(
      load_map(
        await write_map(
          "backtick-info-holds-a-backtick",
          compose(
            `## Phone format\n\n${LIVE_TABLE}\n\n${illustration}\n`,
            FINGERPRINT_SECTION,
            PERSON_SECTION,
            CONVERSION_SECTION,
          ),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Phone format");

    // The shape every other case is refused in, and the one case that binds instead — not a lapse.
    // The document declares exactly one table, a renderer draws that table, and the parser reads
    // it. Nothing is hidden from anybody. The assertion is here rather than absent because it is
    // the sentence a parser that went back to opening a fence on this line would have to break.
    const map = await load_map(
      await write_map(
        "backtick-info-holds-a-backtick-alone",
        compose(FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION, `## Phone format\n\n${illustration}\n`),
      ),
    );

    expect(map.phone.country_code).toBe("999");
    expect(map.phone.shared_account_ceiling).toBe(99);
  });

  test("does not close a fence on a longer run carrying an info string", async () => {
    // An info string follows an opener, never a closer, so a longer run naming a language is
    // content. Before this was read any run of three or more closed a fence that was open, so the
    // line below ended the block and the illustration's header landed in the document.
    await both_shapes(
      "closer-carries-an-info-string",
      "```markdown\nSome maps open the illustration with four backticks and name the language:\n\n````markdown\n\n" +
        ILLUSTRATION +
        "\n```",
    );
  });

  test("does not open a fence on a run standing in indented code, and does not swallow the table under it", async () => {
    // The other direction, and the one an unbounded opener indent buys. A map that explains its own
    // convention shows the fence marker by indenting it, which makes it code and not an opener. Read
    // as an opener it has no closer, so everything after it — the live table included — is inside a
    // block that never ends.
    //
    // The bullet above the run is not scenery. An item stays open only while the lines under it
    // stay indented past its content, and the prose at the margin ends it — so the run is measured
    // against the margin, four columns out, and is code. A reader that never closes the item
    // measures it against the item's content column instead, two columns out, where it is a fence
    // with no closer and the live table is gone.
    expect_live_plan(
      await load_map(
        await document(
          "indented-run-is-not-an-opener",
          "- A note about this market's numbering.\n\nFence an illustration by writing:\n\n    ~~~",
        ),
      ),
    );

    // And where the indented runs bracket the live table, reading them as a fence hides the one
    // table that binds and leaves the illustration below as the only one the parser can see —
    // `country_code=999 ceiling=99`, from a document whose reader sees two ordinary tables. Refusing
    // for the second table is the loud answer and the correct one.
    const error = await caught(
      load_map(
        await write_map(
          "indented-runs-do-not-swallow-a-table",
          compose(
            `## Phone format\n\nFence an illustration by writing:\n\n    ~~~\n\n${LIVE_TABLE}\n\n    ~~~\n\n${ILLUSTRATION}\n`,
            FINGERPRINT_SECTION,
            PERSON_SECTION,
            CONVERSION_SECTION,
          ),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Phone format");
  });

  test("measures a tab as four columns, the way CommonMark counts one", async () => {
    // A map indented with tabs is a map somebody's editor wrote, and a tab is not one column: it
    // advances to the next four-column stop, which puts a tab-indented run at the top level inside
    // an indented code block. Counted as one column instead, the run below is an opener with no
    // closer, and the live table under it spends the rest of the document inside a block that never
    // ends. Measured against markdown-it, the run is code and the table beneath it is drawn.
    expect_live_plan(await load_map(await document("tab-run-is-code", "Fence an illustration by writing:\n\n\t~~~")));

    // And the tab that separates a marker from the fence it introduces counts the same way, which
    // is what leaves the item's content at the column the run stands in.
    const rows = ILLUSTRATION.split("\n")
      .map((row) => `\t${row}`)
      .join("\n");
    await both_shapes("fence-after-a-tab-marker", `-\t~~~markdown\n${rows}\n\t~~~`);
  });

  test("leaves a fence inside a block quote alone, because nothing it hides was readable anyway", async () => {
    // A `>`-prefixed opener is not an opener here, so the quoted illustration below is content
    // rather than code — and it costs nothing, because `cells_of` refuses a `>`-prefixed line, so
    // a quoted table was never a table here whether the fence was found or not. That was the
    // argument; this is the measurement behind it. A differential of 288 generated documents
    // against markdown-it — six containers, four fence spellings, six indents, both shapes —
    // agreed on 276, and all twelve disagreements are *unfenced* tables inside a quote. No fenced
    // quoted document disagreed at any indent in either spelling, which is the argument's actual
    // content: the fence-level disagreement never reaches a table.
    //
    // What the twelve cost is the second-table refusal. A quoted illustration standing beside a
    // live table is not a second table here, so the live one binds and nobody is told to fence the
    // quote — a renderer draws two tables where this reader sees one. Closing that means teaching
    // `cells_of` about `>`, which is a bigger change than the fault.
    const quoted = `> Its plan, for contrast:\n>\n> ~~~markdown\n${ILLUSTRATION.split("\n")
      .map((row) => `> ${row}`)
      .join("\n")}\n> ~~~`;
    await both_shapes("quoted-fence", quoted);

    // The unfenced half of the same family, pinned so the measured cost is a fixture rather than a
    // sentence: the quoted illustration is invisible and the live table below binds alone.
    expect_live_plan(
      await load_map(
        await document(
          "quoted-table-unfenced",
          `> Its plan, for contrast:\n>\n${ILLUSTRATION.split("\n")
            .map((row) => `> ${row}`)
            .join("\n")}`,
        ),
      ),
    );
  });

  test("finds both fences in a map written with carriage returns", async () => {
    // A map written on Windows carries a CR at the end of every line, and the rest of this reader
    // absorbs it — the heading pattern as trailing whitespace, a table cell by trimming. The fence
    // patterns have to as well, and the first draft of the tilde fix did not: anchoring the info
    // string with `$` made every fence in a CRLF document invisible, because `.` does not cross a
    // carriage return and `$` does not sit before one, so the fenced illustration below became a
    // second table and the document was refused. The backtick half of this case was green before
    // that fix, which is what makes it worth writing down — the pattern it replaced matched no line
    // ending at all, so reading tildes came within one anchor of costing every CRLF map both
    // spellings.
    const crlf = (body: string): string => body.replace(/\n/g, "\r\n");
    for (const run of ["~~~", "```"]) {
      const block = `${run}markdown\n${ILLUSTRATION}\n${run}`;
      const beside = crlf(
        compose(
          `## Phone format\n\n${block}\n\n${LIVE_TABLE}\n`,
          FINGERPRINT_SECTION,
          PERSON_SECTION,
          CONVERSION_SECTION,
        ),
      );
      expect_live_plan(await load_map(await write_map(`carriage-returns-${run[0]}`, beside)));

      // The shape a CR can fail quietly in. A fence the pattern cannot see leaves the illustration
      // as the only table under the heading, and every key of the binding comes out of it.
      const only = crlf(
        compose(`## Phone format\n\n${block}\n`, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
      );
      const error = await caught(load_map(await write_map(`carriage-returns-${run[0]}-alone`, only)));
      expect(error).toBeInstanceOf(MapSectionError);
      expect((error as MapSectionError).section).toBe("## Phone format");
    }
  });

  test("binds a live table written inside a nested list item", async () => {
    // The sibling every one of the cases above would open if the rule that decides them were
    // measured from the left margin. Four columns from the margin is code; four columns from a
    // container whose content starts there is the container's first column, and both renderers
    // draw the table below. Read absolutely, the binding itself disappears — the heading carries
    // no table and a map nobody wrote anything wrong in is refused.
    const nested = LIVE_TABLE.split("\n")
      .map((row) => `    ${row}`)
      .join("\n");
    const map = await load_map(
      await write_map(
        "live-table-nested-in-a-list",
        compose(
          `## Phone format\n\n- The market this map describes:\n  - Its live plan:\n\n${nested}\n`,
          FINGERPRINT_SECTION,
          PERSON_SECTION,
          CONVERSION_SECTION,
        ),
      ),
    );

    expect_live_plan(map);
  });

  test("does not drop a nested live table and bind the illustration standing at the margin", async () => {
    // The same mistake in the shape where it says nothing. With an illustration at the margin and
    // the live table nested, a reader measuring indents absolutely drops the live table as code and
    // is left with exactly one `| field | value |` table under the heading — the illustration — so
    // the second-table guard never fires and `country_code=999 ceiling=99` binds out of a document
    // whose reader, and both renderers, see two ordinary tables. Refusing for the second table is
    // the answer that says so.
    const nested = LIVE_TABLE.split("\n")
      .map((row) => `    ${row}`)
      .join("\n");
    const error = await caught(
      load_map(
        await write_map(
          "nested-live-table-under-an-illustration",
          compose(
            `## Phone format\n\n${ILLUSTRATION}\n\n- The market this map describes:\n  - Its live plan:\n\n${nested}\n`,
            FINGERPRINT_SECTION,
            PERSON_SECTION,
            CONVERSION_SECTION,
          ),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Phone format");
    expect(error.message).toContain("second");
  });
});

describe("load_map refuses a document it cannot bind", () => {
  test("names the missing file", async () => {
    const path = join(root, "nowhere-at-all", "MAPPING.md");
    const error = await caught(load_map(path));

    expect(error).toBeInstanceOf(MapMissingError);
    expect(error.message).toContain(path);
  });

  test("names an absent phone format section", async () => {
    const error = await caught(
      load_map(await write_map("no-phone", compose(FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION))),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect(error.message).toMatch(/phone format/i);
  });

  test("names an absent person section", async () => {
    const error = await caught(
      load_map(await write_map("no-person", compose(PHONE_SECTION, FINGERPRINT_SECTION, CONVERSION_SECTION))),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect(error.message).toMatch(/person/i);
  });

  test("names an absent conversion section", async () => {
    const error = await caught(
      load_map(await write_map("no-conversion", compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION))),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect(error.message).toMatch(/conversion/i);
  });

  test("names a missing required key, with its section", async () => {
    const without_subscriber = `## Phone format

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
`;
    const error = await caught(
      load_map(
        await write_map(
          "no-subscriber-digits",
          compose(without_subscriber, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect(error.message).toContain("subscriber_digits");
    expect(error.message).toMatch(/phone/i);
  });

  test("names a missing required key in a role section", async () => {
    const person_without_phone = `## Role: person

| field | value |
|---|---|
| export | person.csv |
| id | account_id |
| created_at | created_at |
`;
    const error = await caught(
      load_map(
        await write_map(
          "person-without-phone",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, person_without_phone, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect(error.message).toContain("phone");
    expect(error.message).toMatch(/person/i);
  });

  test("rejects an unknown key rather than ignoring it", async () => {
    // The whole fault here is one missing letter. Every required key is present, so a
    // parser that skipped what it did not recognise would load this document happily and
    // drop the allowlist, and the run would then accept area codes that do not exist.
    const typo_phone = `## Phone format

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
| area_code | 480, 481 |
`;
    const error = await caught(
      load_map(
        await write_map("unknown-key", compose(typo_phone, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION)),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect(error.message).toContain("area_code");
    expect(error.message).toMatch(/phone/i);
  });

  test("rejects an unknown key in a role section too", async () => {
    const typo_person = `## Role: person

| field | value |
|---|---|
| export | person.csv |
| id | account_id |
| phone | phone_digits |
| created_at | created_at |
| creaetd_at | created_at |
`;
    const error = await caught(
      load_map(
        await write_map(
          "unknown-role-key",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, typo_person, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect(error.message).toContain("creaetd_at");
  });

  test("rejects a zero-length area code by name", async () => {
    // A market whose area codes vary in length cannot be described by two fixed lengths.
    // The answer is a second strategy, not a different number in this cell, and the error
    // has to say so or the next person will try 1 and ship it.
    const flat_phone = `## Phone format

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 0 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
`;
    const error = await caught(
      load_map(
        await write_map(
          "zero-area-digits",
          compose(flat_phone, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(PhoneFormatError);
    expect(error.message).toMatch(/vary in length|variable[- ]length/i);
  });

  test("rejects a blank number cell rather than reading it as zero", async () => {
    // A cell somebody cleared and meant to come back to. `Number("")` is `0`, so a reader that
    // only asks whether the value is a number takes this ceiling as zero: no share of
    // unreadable identifiers is tolerable, and the first file with one bad phone number in it
    // aborts the run. The ceiling that refuses everything and the ceiling nobody wrote look
    // identical afterwards, and the one that was meant is nowhere in the document to check.
    const blank_rate = `## Phone format

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate |  |
| shared_account_ceiling | 3 |
`;
    const error = await caught(
      load_map(
        await write_map("blank-rate", compose(blank_rate, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION)),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).key).toBe("max_unparseable_rate");
    expect((error as MapFieldError).section).toBe("## Phone format");
  });

  test("rejects a fractional digit count where a whole number is the only readable answer", async () => {
    // A length is a count of digits, and 3.5 of them is not a length. Accepted as merely
    // numeric it reaches `slice(0, 3.5)`, which truncates without complaint, so every key comes
    // out three digits wide as though the cell said 3 — the map states one area-code width and
    // the run uses another, and the keys look entirely plausible while the document that is
    // supposed to explain them describes something else.
    const fractional_area = `## Phone format

| field | value |
|---|---|
| country_code | 997 |
| area_digits | 3.5 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
`;
    const error = await caught(
      load_map(
        await write_map(
          "fractional-area-digits",
          compose(fractional_area, FINGERPRINT_SECTION, PERSON_SECTION, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).key).toBe("area_digits");
    expect(error.message).toMatch(/whole number/i);
  });

  test("rejects a heading declared twice, naming it", async () => {
    // Two `## Role: person` sections is what a map edited by two people, or copied from another
    // project and half-adjusted, looks like. The later one silently replaced the earlier, so the
    // binding a reader checks at the top of the file was not the binding the run used — every
    // column reading as correct while pointing at another table.
    const second_person = `## Role: person

| field | value |
|---|---|
| export | legacy-person.csv |
| id | legacy_id |
| phone | phone_digits |
| created_at | created_at |
`;
    const error = await caught(
      load_map(
        await write_map(
          "duplicate-role",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION, second_person, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Role: person");
  });

  test("rejects a repeated heading the parser does not otherwise read", async () => {
    // The rule is about headings, not about the four the parser binds. It cannot know which
    // heading matters — a name it ignores today is one it reads after the next section is added —
    // and a document with two sections under one name has no single answer to give either way.
    const notes = "## Notes\n\nWhy the join goes through the wallet.\n";
    const error = await caught(
      load_map(
        await write_map(
          "duplicate-prose",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, notes, PERSON_SECTION, notes, CONVERSION_SECTION),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Notes");
  });

  /**
   * A section carrying one `| field | value |` table per row block given, with prose between them.
   *
   * Shared by the two cases below, which are one shape at two scales — a table too many, a row too
   * many — and which need disjoint documents rather than one: a map repeating a key has a single
   * table, and a map carrying two tables need not repeat a key inside either. So neither case can
   * stand in for the other, and deleting either guard leaves the other case green.
   */
  const section_of = (heading: string, ...tables: readonly string[]): string =>
    `${heading}\n\n${tables
      .map((rows) => `| field | value |\n|---|---|\n${rows}\n`)
      .join("\nAnd prose, because half of a map is the reasoning written between its tables.\n\n")}`;

  /** The live plan for this fixture's market, as `PHONE_SECTION` declares it. */
  const REAL_PHONE_ROWS = `| country_code | 997 |
| area_digits | 3 |
| subscriber_digits | 6 |
| max_unparseable_rate | 0.25 |
| shared_account_ceiling | 3 |
| area_codes | 480, 481 ,  482 |`;

  /** A completed copy of the same table for another market. Describes no database. */
  const ILLUSTRATED_PHONE_ROWS = `| country_code | 999 |
| area_digits | 2 |
| subscriber_digits | 8 |
| max_unparseable_rate | 0.9 |
| shared_account_ceiling | 99 |`;

  test("rejects a second `| field | value |` table under one heading, naming the section", async () => {
    // The unfenced sibling of the fenced-example case above, and the worse spelling of it: nothing
    // about a plain table looks like a trick, so nobody thinks to fence it. Measured end to end
    // before this refused, on a three-person export and a list of the same three numbers read
    // through the illustration's plan: `matched_accounts` 1 and `conversions {count: 1, value: 10}`
    // where the live table below gives 3 and `{count: 3, value: 30}`. A third of the truth, no
    // error anywhere, and the illustration sets `max_unparseable_rate` to 0.9 so the guard that
    // would have noticed the keys going wrong is switched off by the same fault.
    //
    // The illustration has to be complete for this to bite, as in the fenced case: a half-filled
    // one is missing a required key and throws on that instead, which proves nothing about this.
    //
    // Reading the last table rather than the first is not the fix, which is why this expects a
    // refusal rather than the live values: it would move the silence to the other end of the
    // section, where a correction appended under a superseded block is the shape nobody sees.
    const error = await caught(
      load_map(
        await write_map(
          "two-tables-one-heading",
          compose(
            section_of("## Phone format", ILLUSTRATED_PHONE_ROWS, REAL_PHONE_ROWS),
            FINGERPRINT_SECTION,
            PERSON_SECTION,
            CONVERSION_SECTION,
          ),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapSectionError);
    expect((error as MapSectionError).section).toBe("## Phone format");
    expect(error.message).toContain("## Phone format");
  });

  test("rejects a key declared twice in one table, naming the section and the key", async () => {
    // A row copied and half-edited: `at` bound to the commitment stamp and then again to the row's
    // own creation stamp. A `Map` keeps the last write and the reader sees the first, so the
    // binding that runs is the one nobody checked. Measured end to end before this refused, on one
    // member with one committed conversion two days after the cut: `conversions {count: 0, value:
    // 0}` against the `{count: 1, value: 500}` the visible binding gives — the second `at` points
    // at a stamp from before the cut, so the commitment falls outside the window and a row of
    // zeros is this engine's cheapest wrong answer.
    //
    // Both keys name a column that is really in the export, so nothing downstream notices: the
    // header check passes on whichever one won.
    const repeated_at = `| export | conversion.csv |
| person | account_id |
| at | committed_at |
| at | row_created_at |
| amount | amount_minor |
| status | state |
| valid_statuses | ACTIVE, COMPLETED |`;
    const error = await caught(
      load_map(
        await write_map(
          "key-declared-twice",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION, section_of("## Role: conversion", repeated_at)),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).section).toBe("## Role: conversion");
    expect((error as MapFieldError).key).toBe("at");
    expect(error.message).toContain("## Role: conversion");
  });

  test("rejects `split` declared with no value marking the recycled side", async () => {
    // Half a binding: someone named the column and stopped before saying which of its values
    // means recycled. Read as "no split at all", the record loses the breakdown entirely and
    // the run publishes one lump conversion figure for a product this same document says has
    // two sides to it — a total that reconciles against nothing, with no column named anywhere
    // in the output as the one that went unread.
    const split_only = `## Role: conversion

| field | value |
|---|---|
| export | conversion.csv |
| person | account_id |
| at | committed_at |
| at_fallback | created_at |
| amount | amount_minor |
| status | state |
| valid_statuses | ACTIVE, COMPLETED |
| split | origin |
`;
    const error = await caught(
      load_map(
        await write_map(
          "split-without-recycled-when",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION, split_only),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).key).toBe("recycled_when");
    expect((error as MapFieldError).section).toBe("## Role: conversion");
  });

  test("rejects `recycled_when` declared with no column to read it from", async () => {
    // The mirror case, and the worse-looking one: a value naming the recycled side with no
    // column carrying it. Accepted as "no split", the run drops the same breakdown while the
    // map still reads, to anyone opening it, as though the recycled side were being counted.
    const recycled_only = `## Role: conversion

| field | value |
|---|---|
| export | conversion.csv |
| person | account_id |
| at | committed_at |
| at_fallback | created_at |
| amount | amount_minor |
| status | state |
| valid_statuses | ACTIVE, COMPLETED |
| recycled_when | RECYCLED |
`;
    const error = await caught(
      load_map(
        await write_map(
          "recycled-when-without-split",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION, recycled_only),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).key).toBe("split");
    expect((error as MapFieldError).section).toBe("## Role: conversion");
  });

  test("rejects a fingerprint listing no blocks to hash", async () => {
    // An empty `models` list does not weaken the drift check, it removes it: `verify_fingerprint`
    // concatenates the blocks named here, so with none named it hashes the empty string and
    // returns the same digest for every schema this project will ever have. Recorded once, that
    // digest matches forever — a column renamed out from under the map reports `ok: true`, and
    // the one mechanism that was supposed to catch a map describing a shape the database no
    // longer has becomes a line in the document that can never fail.
    const no_models = `## Fingerprint

| field | value |
|---|---|
| schema | db/schema.prisma |
| models |  |
| sha256 | ${PLACEHOLDER_SHA} |
`;
    const error = await caught(
      load_map(await write_map("no-models", compose(PHONE_SECTION, no_models, PERSON_SECTION, CONVERSION_SECTION))),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).key).toBe("models");
    expect((error as MapFieldError).section).toBe("## Fingerprint");
  });

  test("rejects a `valid_statuses` list naming no status at all", async () => {
    // The column is bound and the list behind it is empty — a cell cleared while someone worked
    // out what this project's committed states are actually called. Nothing then matches, so no
    // row is ever a conversion: the run does not fail, it publishes, and every cell of the
    // record reads zero conversions. That is indistinguishable from a real audience nobody
    // converted, and it is the answer this whole design refuses to give quietly.
    const empty_statuses = `## Role: conversion

| field | value |
|---|---|
| export | conversion.csv |
| person | account_id |
| at | committed_at |
| at_fallback | created_at |
| amount | amount_minor |
| status | state |
| valid_statuses |  |
`;
    const error = await caught(
      load_map(
        await write_map(
          "empty-valid-statuses",
          compose(PHONE_SECTION, FINGERPRINT_SECTION, PERSON_SECTION, empty_statuses),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapFieldError);
    expect((error as MapFieldError).key).toBe("valid_statuses");
    expect((error as MapFieldError).section).toBe("## Role: conversion");
  });

  test("rejects revenue and churn bound to one export through the same three columns", async () => {
    // The authoring mistake this exists for: the churn section was made by copying the revenue
    // one and editing the heading. Both sections parse, every key is a key the section defines,
    // and nothing further down can notice — `money_index` is handed one binding at a time, reads
    // the same file twice, builds two identical indices, and the record publishes churn as an
    // exact copy of revenue. Two hundred arriving and the same two hundred leaving, from the same
    // people at the same instants, is not a reading anybody can tell from a real one.
    const copied_churn = `## Role: churn

| field | value |
|---|---|
| export | revenue.csv |
| person | account_id |
| at | received_at |
| amount | amount_minor |
`;
    const error = await caught(
      load_map(
        await write_map(
          "churn-copied-from-revenue",
          compose(
            PHONE_SECTION,
            FINGERPRINT_SECTION,
            PERSON_SECTION,
            REVENUE_SECTION,
            copied_churn,
            CONVERSION_SECTION,
          ),
        ),
      ),
    );

    expect(error).toBeInstanceOf(MapDuplicateBindingError);
    expect((error as MapDuplicateBindingError).roles).toEqual(["## Role: revenue", "## Role: churn"]);
    expect((error as MapDuplicateBindingError).export).toBe("revenue.csv");
  });

  test("and accepts a shared export where any one of the three columns differs", async () => {
    // Sharing an export is not the fault; reading the identical rows twice is. Each shape below
    // is a file that honestly carries both directions, and refusing them would refuse a project
    // whose database is arranged in a way this engine can measure correctly.
    const churn_of = (rows: string) => `## Role: churn\n\n| field | value |\n|---|---|\n${rows}`;

    // A monthly statement per member: one row, one date, two amounts.
    const two_amounts = await load_map(
      await write_map(
        "shared-export-two-amounts",
        compose(
          PHONE_SECTION,
          FINGERPRINT_SECTION,
          PERSON_SECTION,
          REVENUE_SECTION,
          churn_of(
            "| export | revenue.csv |\n| person | account_id |\n| at | received_at |\n| amount | withdrawn_minor |\n",
          ),
          CONVERSION_SECTION,
        ),
      ),
    );
    expect(two_amounts.churn?.columns.amount).toBe("withdrawn_minor");

    // A position table: one sum in at the open, the same sum out at the close.
    const two_dates = await load_map(
      await write_map(
        "shared-export-two-dates",
        compose(
          PHONE_SECTION,
          FINGERPRINT_SECTION,
          PERSON_SECTION,
          REVENUE_SECTION,
          churn_of(
            "| export | revenue.csv |\n| person | account_id |\n| at | closed_at |\n| amount | amount_minor |\n",
          ),
          CONVERSION_SECTION,
        ),
      ),
    );
    expect(two_dates.churn?.columns.at).toBe("closed_at");

    // A transfer table: the money one person sends is the money another receives.
    const two_people = await load_map(
      await write_map(
        "shared-export-two-people",
        compose(
          PHONE_SECTION,
          FINGERPRINT_SECTION,
          PERSON_SECTION,
          REVENUE_SECTION,
          churn_of(
            "| export | revenue.csv |\n| person | payer_id |\n| at | received_at |\n| amount | amount_minor |\n",
          ),
          CONVERSION_SECTION,
        ),
      ),
    );
    expect(two_people.churn?.columns.person).toBe("payer_id");
  });
});

/**
 * Fingerprint verification is deliberately not part of loading. A map that parses is a map you
 * can read and reason about, whether or not the schema behind it has moved since; only a run
 * about to publish numbers has to care, so the run calls this itself.
 */
describe("verify_fingerprint", () => {
  const SCHEMA = `// An invented schema. Two of these blocks are the ones the map lists by default.

model Account {
  id            String   @id
  phone_digits  String
  created_at    DateTime
}

model Ledger {
  id          String   @id
  account_id  String
  amount      Int
}

model Untracked {
  id String @id
}

enum Standing {
  DRAFT
  ACTIVE
  COMPLETED
}
`;

  /**
   * The hash rule, restated here on purpose. Recomputing the expected digest by the same rule
   * is what makes the passing case mean anything — a hardcoded literal would only prove that
   * a hash can be copied between two files.
   *
   * A listed name is a model or an enum, and the rule reads either. That is not a convenience:
   * the statuses a map counts as committed live in an enum and nowhere else, so a map that
   * cannot list one has no way to notice a status being renamed under it.
   */
  function digest_of(schema: string, names: string[]): string {
    const lines = schema.split("\n");
    const blocks = names.map((name) => {
      const opener = new RegExp(`^\\s*(?:model|enum)\\s+${name}\\s*\\{`);
      const start = lines.findIndex((line) => opener.test(line));
      if (start === -1) {
        throw new Error(`the fixture has no block ${name}`);
      }
      let end = -1;
      for (let i = start + 1; i < lines.length; i += 1) {
        if (lines[i] === "}") {
          end = i;
          break;
        }
      }
      if (end === -1) {
        throw new Error(`the fixture never closes block ${name}`);
      }
      return lines.slice(start, end + 1).join("\n");
    });
    return new Bun.CryptoHasher("sha256").update(blocks.join("\n")).digest("hex");
  }

  /** Writes a map and its schema, with the schema sitting where the map says it sits. */
  async function write_pair(
    name: string,
    sha256: string,
    schema: string | null,
    blocks = "Account, Ledger",
  ): Promise<string> {
    const fingerprint = `## Fingerprint

| field | value |
|---|---|
| schema | db/schema.prisma |
| models | ${blocks} |
| sha256 | ${sha256} |
`;
    const path = join(root, name, "MAPPING.md");
    await Bun.write(path, compose(PHONE_SECTION, fingerprint, PERSON_SECTION, CONVERSION_SECTION));
    if (schema !== null) {
      await Bun.write(join(root, name, "db", "schema.prisma"), schema);
    }
    return path;
  }

  test("reports ok when the recorded hash matches the schema on disk", async () => {
    const expected = digest_of(SCHEMA, ["Account", "Ledger"]);
    const path = await write_pair("fingerprint-fresh", expected, SCHEMA);
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(true);
    expect(result.actual).toBe(expected);
    expect(result.expected).toBe(expected);
  });

  test("reports ok when the recorded hash is the same digest in capitals", async () => {
    // A map is hand-edited markdown and the digest is pasted into it from whatever produced one.
    // `sha256sum` writes lowercase; `openssl dgst` and most GUI hashers write uppercase, and a
    // hex digest means the same number either way. Compared without folding case, a correct hash
    // recorded in capitals reads as drift on a schema nothing has touched — and the run refuses
    // before it opens an export, so the fix looks like a schema problem rather than a paste.
    const expected = digest_of(SCHEMA, ["Account", "Ledger"]);
    const path = await write_pair("fingerprint-uppercase", expected.toUpperCase(), SCHEMA);
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(true);
    // Reported as recorded, not as compared: the reader is shown what the file says.
    expect(result.expected).toBe(expected.toUpperCase());
    expect(result.actual).toBe(expected);
  });

  test("reports both hashes when the schema has moved on", async () => {
    // Drift means the reading is computed against columns that no longer mean what the map
    // says they mean, so the report shows what was recorded next to what is there now.
    const stale = "0".repeat(64);
    const path = await write_pair("fingerprint-stale", stale, SCHEMA);
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(false);
    expect(result.expected).toBe(stale);
    expect(result.actual).toBe(digest_of(SCHEMA, ["Account", "Ledger"]));
    expect(result.actual).not.toBe(result.expected);
  });

  test("notices a change confined to one of the listed blocks", async () => {
    const edited = SCHEMA.replace("amount      Int", "amount      BigInt");
    const path = await write_pair("fingerprint-edited", digest_of(SCHEMA, ["Account", "Ledger"]), edited);
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(false);
  });

  test("ignores a change to a block the map does not list", async () => {
    // The map lists what the measurement reads. A model nobody binds can change freely
    // without invalidating a reading, and a hash taken over the whole file would say
    // otherwise every time an unrelated column moved.
    const elsewhere = SCHEMA.replace("model Untracked {", "model Untracked {\n  label String");
    const path = await write_pair("fingerprint-elsewhere", digest_of(SCHEMA, ["Account", "Ledger"]), elsewhere);
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(true);
  });

  test("throws rather than reporting drift when the schema file is gone", async () => {
    // A file that is not there is a misconfiguration, not drift. Reported as drift it would
    // teach people that the check cries wolf, and then they would stop reading it.
    const path = await write_pair("fingerprint-no-schema", "0".repeat(64), null);
    const map = await load_map(path);

    const error = await caught(verify_fingerprint(map, path));
    expect(error).toBeInstanceOf(MapMissingError);
    expect(error.message).toContain("schema.prisma");
  });

  test("throws when a listed model is not in the schema", async () => {
    const renamed = SCHEMA.replace("model Ledger {", "model LedgerEntry {");
    const path = await write_pair("fingerprint-no-model", digest_of(SCHEMA, ["Account", "Ledger"]), renamed);
    const map = await load_map(path);

    const error = await caught(verify_fingerprint(map, path));
    expect(error).toBeInstanceOf(MapSectionError);
    expect(error.message).toContain("Ledger");
  });

  test("hashes an enum block a map lists among its models", async () => {
    // Without this the check has a hole exactly where it matters most. `valid_statuses` and
    // `recycled_when` name enum values, not columns, and a migration renaming one of them leaves
    // every model byte-identical while the run it guards silently counts nothing or moves a whole
    // sum from one side of the split to the other. A map that lists the enum used to be refused
    // outright, which left nowhere to declare the dependency at all.
    const expected = digest_of(SCHEMA, ["Account", "Ledger", "Standing"]);
    const path = await write_pair("fingerprint-enum", expected, SCHEMA, "Account, Ledger, Standing");
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(true);
    expect(result.actual).toBe(expected);
  });

  test("notices a status renamed inside a listed enum", async () => {
    // The rename this exists for: `ACTIVE` becomes `RUNNING` in a migration, the map still counts
    // `ACTIVE`, and every conversion in the export stops matching. Nothing in any model moved.
    const renamed = SCHEMA.replace("  ACTIVE", "  RUNNING");
    const path = await write_pair(
      "fingerprint-enum-drift",
      digest_of(SCHEMA, ["Account", "Ledger", "Standing"]),
      renamed,
      "Account, Ledger, Standing",
    );
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(false);
    expect(result.actual).toBe(digest_of(renamed, ["Account", "Ledger", "Standing"]));
  });

  test("still hashes nothing but the blocks listed, enum or model", async () => {
    // An enum nobody lists changes freely, exactly as an unlisted model does. The scope of the
    // hash is the map's declaration, and widening it to every enum would make the check cry wolf
    // on migrations this map does not depend on.
    const elsewhere = SCHEMA.replace("  COMPLETED", "  COMPLETED\n  REFUNDED");
    const path = await write_pair("fingerprint-enum-unlisted", digest_of(SCHEMA, ["Account", "Ledger"]), elsewhere);
    const map = await load_map(path);

    const result = await verify_fingerprint(map, path);
    expect(result.ok).toBe(true);
  });

  test("throws when a listed name is neither a model nor an enum in the schema", async () => {
    const path = await write_pair(
      "fingerprint-no-enum",
      digest_of(SCHEMA, ["Account", "Ledger", "Standing"]),
      SCHEMA.replace("enum Standing {", "enum ContractStanding {"),
      "Account, Ledger, Standing",
    );
    const map = await load_map(path);

    const error = await caught(verify_fingerprint(map, path));
    expect(error).toBeInstanceOf(MapSectionError);
    expect(error.message).toContain("Standing");
    expect(error.message).toMatch(/model or enum/);
  });
});
