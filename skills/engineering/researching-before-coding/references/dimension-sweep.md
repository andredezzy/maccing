# The dimension sweep — completeness over salience

Salience bias makes the engaging dimensions get fully specified while low-salience but mandatory ones are silently deferred to a "later" that has no forcing function. The failure this prevents: shipping an interesting skeleton while the rest quietly goes missing.

## The method

Before presenting any design with more than one dimension:

1. List every applicable axis — data and logic, operational (install, migration, versioning), presentation (docs, UI copy), infrastructure (config, CI, tooling), testing.
2. Mark each one explicitly: **fully specified** / **not applicable — with the reason** / **deferred — by the user's explicit choice**.
3. A dimension left blank is a silent skip. "Use the default" counts as an answer only when the default is actually stated.
4. After building, verify the result against the design dimension by dimension — a designed-but-undelivered dimension is the same miss one step later.

## The tell

If the design document spends three paragraphs on the clever part and one line on migration, the sweep has not been run — salience chose the coverage, not the requirements.
