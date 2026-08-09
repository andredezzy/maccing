import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { read_identifiers, read_rows } from "../src/internal/table.ts";

/**
 * The file reader, exercised directly rather than through `measure`.
 *
 * The end-to-end fixtures write their lists with this repository's own helpers, so every file the
 * reader sees there has Unix line endings, a lowercase extension, an unremarkable filename and no
 * quoting it did not need. Real lists arrive from a CRM export, a spreadsheet save-as, or a vendor
 * who was asked for "the numbers we sent to" — and each of the shapes below is one of those, read
 * correctly today and read *differently*, never refused, under an edit somebody could defend.
 *
 * Every identifier here is the invented nine-digit form of the `997` plan the rest of the suite
 * uses: three area digits and six subscriber digits, a pairing no market answers on.
 */

let root = "";

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "growth-table-"));
});

afterAll(async () => {
  if (root !== "") {
    await rm(root, { recursive: true, force: true });
  }
});

/** Writes a fixture file under this run's temporary root and returns its absolute path. */
async function write_list(name: string, body: string): Promise<string> {
  const path = join(root, name);
  await Bun.write(path, body);
  return path;
}

describe("read_rows counts a row nobody wrote anything in", () => {
  test("a line holding one empty quoted field is a row, not a blank line to skip over", async () => {
    // `""` is how a spreadsheet writes a row whose only column was cleared, and the scanner has to
    // tell it from the blank line a trailing newline leaves behind. Lose the distinction and the
    // row is gone from `records` — which is not merely one identifier short. `read_rows` is also
    // what every export is read through, and "does this file have rows at all" is the question
    // separating an export of a quiet month (a fact, measured as zero) from an export whose
    // columns were emptied at the source (a fault, refused). A person export written this way
    // would answer the second question with the first answer.
    const path = await write_list("empty-quoted-row.csv", 'handset,cohort\n480000001,alpha\n""\n480000002,beta\n');

    const { records } = await read_rows(path);

    expect(records).toHaveLength(3);
    expect(records[1]).toEqual({ handset: "", cohort: "" });
  });
});

describe("read_identifiers decides what a file is by its name", () => {
  test("the extension is the last dotted suffix, not the first", async () => {
    // Two filenames this engine has no say over. A vendor who sends `10k.reativacao.v2.csv` is
    // versioning in the only field they control, and a declaration is free to name its list by a
    // path relative to the script that measures it. Read from the first dot instead of the last,
    // both come out as an extension nobody recognises and the cell is refused as an unsupported
    // format — pointing whoever reads the error at the file's contents, which are fine.
    const dotted = await write_list("odd.name.v2.csv", "handset\n480000001\n480000002\n");
    expect(await read_identifiers(dotted)).toEqual(["480000001", "480000002"]);

    const absolute = await write_list(join("lists", "a.csv"), "handset\n480000003\n");
    const dot_relative = `./${relative(process.cwd(), absolute)}`;
    expect(dot_relative.startsWith(".")).toBe(true);
    expect(await read_identifiers(dot_relative)).toEqual(["480000003"]);
  });

  test("an extension shouted in capitals names the same format", async () => {
    // `UPPER.CSV` is what a Windows exporter writes, and several write nothing else. Compared
    // without folding case it matches neither known extension, so a list that parses perfectly is
    // refused for its filename and the cell it backs cannot be measured at all.
    const path = await write_list("UPPER.CSV", "handset\n480000004\n480000005\n");

    expect(await read_identifiers(path)).toEqual(["480000004", "480000005"]);
  });
});

describe("read_identifiers reading a text list", () => {
  test("a file saved with CRLF endings yields identifiers, not identifiers plus a carriage return", async () => {
    // A `.txt` list typed in Notepad or exported by a Windows tool ends every line with `\r\n`.
    // Left on, the carriage return travels into the key builder as a digit-less character: every
    // number in the file fails to parse, the cell is refused for a dialling plan that does not
    // describe this market, and the plan is correct.
    const path = await write_list("crlf.txt", "480000006\r\n480000007\r\n480000008\r\n");

    expect(await read_identifiers(path)).toEqual(["480000006", "480000007", "480000008"]);
  });

  test("a line holding only spaces is as absent as an empty one", async () => {
    // A list pasted out of a spreadsheet column carries padded blanks, not empty ones. Filtered on
    // emptiness alone they survive as identifiers: `listed` counts them as people who were
    // reached, none of them keys, and the unreadable-identifier rate charges the dialling plan for
    // every one of them — so a clean list is refused, or a real cell reports an audience larger
    // than the send.
    const path = await write_list("padded-blanks.txt", "480000009\n   \n\t\n480000010\n");

    expect(await read_identifiers(path)).toEqual(["480000009", "480000010"]);
  });
});
