import io.github.spannm.jackcess.ColumnBuilder;
import io.github.spannm.jackcess.DataType;
import io.github.spannm.jackcess.Database;
import io.github.spannm.jackcess.DatabaseBuilder;
import io.github.spannm.jackcess.Table;
import io.github.spannm.jackcess.TableBuilder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Generates public, synthetic Jet 4 fixtures. No source-delivery data is used. */
public final class GenerateGndMdbFixtures {
  private static final String[] CORE = {
    "X_ASC11_PP", "X_ASC12_PL", "X_ASC13_PH", "X_ASC21_EL",
    "X_ASC22_EH", "X_ASC23_EU", "X_ASC24_EK"
  };

  public static void main(String[] args) throws Exception {
    Path output = Path.of(args.length == 0 ? "test/fixtures/gnd-mdb" : args[0]);
    Files.createDirectories(output);
    create(output.resolve("valid-minimal-jet4.mdb"), null, false);
    create(output.resolve("missing-core-jet4.mdb"), "X_ASC13_PH", false);
    create(output.resolve("conflicting-evidence-jet4.mdb"), null, true);
  }

  private static void create(Path path, String omitted, boolean conflict) throws Exception {
    Files.deleteIfExists(path);
    try (Database db = new DatabaseBuilder(path).withFileFormat(Database.FileFormat.V2000).create()) {
      for (String name : CORE) if (!name.equals(omitted)) createTable(db, name);
      seed(db, conflict);
    }
  }

  private static void createTable(Database db, String name) throws Exception {
    TableBuilder table = new TableBuilder(name);
    switch (name) {
      case "X_ASC11_PP" -> table
        .addColumn(text("PAD")).addColumn(text("STRECKE")).addColumn(text("STRRIKZ"))
        .addColumn(number("STATION")).addColumn(text("PTEXT")).addColumn(bool("ACTIVE"));
      case "X_ASC12_PL" -> table
        .addColumn(text("PAD")).addColumn(text("LSYS")).addColumn(number("Y")).addColumn(number("X"));
      case "X_ASC13_PH" -> table
        .addColumn(text("PAD")).addColumn(text("HSYS")).addColumn(number("H"));
      case "X_ASC21_EL" -> table
        .addColumn(text("PAD1")).addColumn(text("PAD2")).addColumn(text("ELSYS")).addColumn(integer("ELTYP"))
        .addColumn(number("ELPAR1")).addColumn(number("ELPAR2")).addColumn(number("ELPAR3")).addColumn(number("ELPAR4"))
        .addColumn(number("ELARIWI"));
      case "X_ASC22_EH" -> table
        .addColumn(text("PAD1")).addColumn(text("PAD2")).addColumn(text("EHSYS")).addColumn(integer("EHTYP"))
        .addColumn(number("EHPAR1")).addColumn(number("EHPAR2")).addColumn(number("EHPAR3")).addColumn(number("EHPAR4"));
      case "X_ASC23_EU" -> table
        .addColumn(text("PAD1")).addColumn(text("PAD2")).addColumn(integer("EUTYP"))
        .addColumn(number("EUPAR1")).addColumn(number("EUPAR2")).addColumn(number("EUPAR3")).addColumn(number("EUPAR4"));
      case "X_ASC24_EK" -> table
        .addColumn(text("PAD1")).addColumn(text("PAD2")).addColumn(text("EKSYS")).addColumn(integer("EKTYP"))
        .addColumn(number("EKPAR1")).addColumn(number("EKPAR2")).addColumn(number("EKPAR3")).addColumn(number("EKARIWI"));
      default -> throw new IllegalArgumentException(name);
    }
    table.toTable(db);
  }

  private static void seed(Database db, boolean conflict) throws Exception {
    rows(db, "X_ASC11_PP",
      row("PAD", "P1", "STRECKE", "SYNTH", "STRRIKZ", "1", "STATION", 0.0, "PTEXT", "", "ACTIVE", false),
      row("PAD", "P2", "STRECKE", "SYNTH", "STRRIKZ", "1", "STATION", 100.0, "PTEXT", null, "ACTIVE", true));
    rows(db, "X_ASC12_PL",
      row("PAD", "P1", "LSYS", "SYNTH_LSYS", "Y", 0.0, "X", 0.0),
      row("PAD", "P2", "LSYS", "SYNTH_LSYS", "Y", 100.0, "X", 0.0));
    if (conflict) rows(db, "X_ASC12_PL",
      row("PAD", "P1", "LSYS", "CONFLICT_LSYS", "Y", 0.0, "X", 0.0),
      row("PAD", "P2", "LSYS", "CONFLICT_LSYS", "Y", 100.0, "X", 0.0));
    if (db.getTableNames().contains("X_ASC13_PH")) rows(db, "X_ASC13_PH",
      row("PAD", "P1", "HSYS", "SYNTH_HSYS", "H", 10.25),
      row("PAD", "P2", "HSYS", "SYNTH_HSYS", "H", 11.25));
    rows(db, "X_ASC21_EL", row("PAD1", "P1", "PAD2", "P2", "ELSYS", "SYNTH_LSYS", "ELTYP", 0,
      "ELPAR1", 100.0, "ELPAR2", 0.0, "ELPAR3", 0.0, "ELPAR4", null, "ELARIWI", 100.0));
    rows(db, "X_ASC22_EH",
      row("PAD1", "P1", "PAD2", "P2", "EHSYS", "SYNTH_HSYS", "EHTYP", 0,
        "EHPAR1", 100.12345678901234, "EHPAR2", 0.0, "EHPAR3", 0.12500000000000003, "EHPAR4", null),
      row("PAD1", "P1", "PAD2", "P2", "EHSYS", "SYNTH_HSYS", "EHTYP", 999,
        "EHPAR1", 100.12345678901234, "EHPAR2", null, "EHPAR3", 0.0, "EHPAR4", 0.0));
    rows(db, "X_ASC23_EU", row("PAD1", "P1", "PAD2", "P2", "EUTYP", 0,
      "EUPAR1", 100.12345678901234, "EUPAR2", 0.0, "EUPAR3", 0.12000000000000002, "EUPAR4", null));
    // EK intentionally has no rows; its physical schema is still required and inventoried.
  }

  private static void rows(Database db, String tableName, Map<String, Object>... values) throws Exception {
    Table table = db.getTable(tableName);
    for (Map<String, Object> value : values) table.addRowFromMap(value);
  }

  private static LinkedHashMap<String, Object> row(Object... pairs) {
    LinkedHashMap<String, Object> row = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) row.put((String) pairs[i], pairs[i + 1]);
    return row;
  }

  private static ColumnBuilder text(String name) { return new ColumnBuilder(name, DataType.TEXT).withLengthInUnits(80); }
  private static ColumnBuilder number(String name) { return new ColumnBuilder(name, DataType.DOUBLE); }
  private static ColumnBuilder integer(String name) { return new ColumnBuilder(name, DataType.INT); }
  private static ColumnBuilder bool(String name) { return new ColumnBuilder(name, DataType.BOOLEAN); }
}
