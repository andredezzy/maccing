import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { load_map, MapFieldError, MapMissingError, MapSectionError, verify_fingerprint } from "../src/internal/map.ts";
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

  test("ignores prose, extra headings and a fenced sql block before the table", async () => {
    // The prose is half the value of the map and the sql block is how the export was
    // taken. Both live under the heading, and neither is the parser's business.
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
});

/**
 * Fingerprint verification is deliberately not part of loading. A map that parses is a map you
 * can read and reason about, whether or not the schema behind it has moved since; only a run
 * about to publish numbers has to care, so the run calls this itself.
 */
describe("verify_fingerprint", () => {
  const SCHEMA = `// An invented schema. Two of these blocks are the ones the map lists.

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
`;

  /**
   * The hash rule, restated here on purpose. Recomputing the expected digest by the same rule
   * is what makes the passing case mean anything — a hardcoded literal would only prove that
   * a hash can be copied between two files.
   */
  function digest_of(schema: string, models: string[]): string {
    const lines = schema.split("\n");
    const blocks = models.map((name) => {
      const opener = new RegExp(`^\\s*model\\s+${name}\\s*\\{`);
      const start = lines.findIndex((line) => opener.test(line));
      if (start === -1) {
        throw new Error(`the fixture has no model ${name}`);
      }
      let end = -1;
      for (let i = start + 1; i < lines.length; i += 1) {
        if (lines[i] === "}") {
          end = i;
          break;
        }
      }
      if (end === -1) {
        throw new Error(`the fixture never closes model ${name}`);
      }
      return lines.slice(start, end + 1).join("\n");
    });
    return new Bun.CryptoHasher("sha256").update(blocks.join("\n")).digest("hex");
  }

  /** Writes a map and its schema, with the schema sitting where the map says it sits. */
  async function write_pair(name: string, sha256: string, schema: string | null): Promise<string> {
    const fingerprint = `## Fingerprint

| field | value |
|---|---|
| schema | db/schema.prisma |
| models | Account, Ledger |
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
});
