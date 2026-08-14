/** A bound export, or a file a cell lists, is not where it was said to be. */
export class MissingExportError extends Error {
  readonly path: string;

  constructor(path: string, wanted_by: string) {
    super(
      `${wanted_by} needs ${path}, and it is not there. Produce the export before measuring: a missing ` +
        "file measured as absent is a campaign credited with nothing.",
    );
    this.name = "MissingExportError";
    this.path = path;
  }
}
