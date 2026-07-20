# GND Corpus and Variant Inventory

Status: Research evidence; non-canonical. Corpus inspected read-only on 2026-07-19 at baseline `1ea2b3cace79ec798545a0477581fbc4c800c838`.

## Scope and reproducibility

The pass covered the four current `.xlsx` GND samples in `test/samples/`, two current companion `.xlsx` deliveries in the Eifelstrecke sample directory, eleven `.xlsx` examples under `_legacy/ufMisc/data/gndEdit/` and `_legacy/ufAIM1/test/`, and the companion `.MDB` files by identity and importer-support status. The current samples are repository data; `_legacy/` remained read-only. No corpus content was copied into Research.

Re-identify a delivery by repository-relative path, byte size, and SHA-256. Representative identities:

| Scope | Repository-relative file | SHA-256 |
|---|---|---|
| current | `test/samples/STR_1720_GND.xlsx` | `2e3a64c106d34e4009cae301e24b7a1c717a3289e7c4c79e62430d0349150ba9` |
| current | `test/samples/STR_1720_KM_250-259_GND.xlsx` | `eba9a19457ef3a814ca2e227b31c9ee13f062fcd23a619628b8da488baad9e6c` |
| current | `test/samples/STR_1011_0-26,3_1210_64-237,6_GND+FP.xlsx` | `45ebf0da190dde2081af2f24d5a6a2cfa3a405ef8e9f9466bd276e7852f21843` |
| current | `test/samples/2631KN-KX_3010GC-GD.xlsx` | `f640887c071cf80a4b64bd65c0372a9d809baf149f28599482fbf134332cb15f` |
| legacy | `_legacy/ufMisc/data/gndEdit/STR_1720_GND.xlsx` | `135075040c2745201418e70a4ef4fc5599f628ad82d54f4ebe6d2283be66d7b3` |
| legacy | `_legacy/ufMisc/data/gndEdit/STR_1720_KM_211-273_GND.xlsx` | `40a58f145fc628ee5391f5ed78ee15ac80bee6a9e4346e736cd3fd7ff981af2f` |
| legacy revision | `_legacy/ufMisc/data/gndEdit/STR_1720_KM_211-273_GND 2.xlsx` | `12dc7a511c44a4144a96773917cf00ad2d0bf0e2259ded1112a4a5321bbb52fc` |
| legacy revised export | `_legacy/ufMisc/data/gndEdit/1011_000-026_1210_064-238_rev.xlsx` | `8aba61451b7329c0abe1bf5e29dd4de20df78798b5e40d804cc99996129cab95` |
| legacy station facility | `_legacy/ufMisc/data/gndEdit/HBF_KAISERSLAUTERN_GLEISE_DR0-N00.xlsx` | `23bb6ae55856fe5f44860c7d2ff09be20dc6343de0c493f60ea73b421ffa5f5a` |

The remaining hashes are obtainable with `shasum -a 256` over the declared directories; listing every companion copy here adds no interpretive value.

## Workbook families

1. **GND XLSX table export** — sheets named `X_ASC11_PP`, `X_ASC12_PL`, `X_ASC13_PH`, `X_ASC21_EL`, `X_ASC22_EH`, `X_ASC23_EU`, and `X_ASC24_EK`. Headers can begin after blank leading columns (for example at column E); consumers must resolve by header, not absolute column.
2. **Mixed GND + FP delivery** — same GND tables with additional delivery content. Extra sheets are representation or companion data until explicitly decoded.
3. **Route/kilometre subset** — filename indicates a delivery window, but filename is evidence, not a stable alignment identifier.
4. **Station/facility delivery** — several track identities and local/reference coordinate variants may coexist in one workbook.
5. **MDB companion/original** — present in current and legacy data, but current sniffer/parser does not support MDB. XLSX may be an exported representation of it; equality must not be assumed without record comparison.
6. **Re-export/revision copies** — filenames such as `rev` or ` 2` and differing hashes prove multiple deliveries, not the semantic boundary between a new version and a different alignment.

## Repeated structural observations

- The seven named sheets recur across real XLSX exports; absent or empty optional families occur. **O**
- Relevant headers are field names, while their physical columns may be shifted by leading blanks. **O**
- Point data may contain multiple PP/PL/PH records for the same `PAD`, distinguished by route/direction, `LSYS`, or `HSYS`. **E/O**
- Element records refer to endpoints through `PAD1` and `PAD2`; database-export order is stated to be geometric within record families. **E**
- The corpus includes multiple `LSYS` and `HSYS` values in one workbook and metadata from several producing programs/eras. **O**
- Dates, producer program, operator/editor, work order, status, accuracy, and comment fields are populated in real deliveries, not merely reserved columns. **O**
- Exact workbook-level versions are not declared consistently. Program/version fields are row-level and can vary inside one workbook. **O**

## Variant risks

- Exact sheet-name matching makes case, whitespace, localized name, or renamed-sheet variants fatal even if headers are recognizable. **I/U**
- Header aliases are only partly handled (`STRECKE`/`PSTRECKE`, `STRRIKZ`/`PSTRRIKZ`); the reference uses `LSYST`/`HSYST` while workbooks and importer use `LSYS`/`HSYS`. **E/I**
- Formula cells, cached display values, locale decimal text, and Excel dates need explicit normalization policy. Current reading uses formatted strings (`raw: false`). **I**
- Graphical/reference and local Cartesian LSYS variants cannot all be treated as transformable engineering coordinates. **E**
- The workbook may contain more network knowledge than the seven imported sheets (notably node/edge/description record families in the reference). Their XLSX presence and semantics remain unverified. **E/U**
