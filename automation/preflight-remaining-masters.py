"""Read-only remaining Equipment mapping preflight; never prints source records."""
import argparse
import importlib.util
import json
from pathlib import Path
import urllib.parse

import openpyxl


spec = importlib.util.spec_from_file_location(
    "customer_apply", Path(__file__).with_name("apply-customer-masters.py"))
apply = importlib.util.module_from_spec(spec)
spec.loader.exec_module(apply)


def inspect_mapping(source_path, schema_path, api):
    source = openpyxl.load_workbook(source_path, read_only=True, data_only=False)
    schema = openpyxl.load_workbook(schema_path, read_only=True, data_only=True)
    try:
        sheet = source["Equipment Master"]
        headers = list(next(sheet.iter_rows(min_row=1, max_row=1, values_only=True)))
        rows = list(schema["Source Mapping"].iter_rows(min_row=2, values_only=True))
        columns = []
        tables = {}
        for position, header in enumerate(headers, 1):
            letter = openpyxl.utils.get_column_letter(position)
            matches = list(dict.fromkeys(
                row for row in rows if len(row) >= 8 and
                row[0] == source_path.name and row[1] == sheet.title and
                row[2] == letter and row[3] == header))
            if len(matches) != 1:
                raise RuntimeError("Missing or ambiguous exact Equipment header contract: " + letter)
            row = matches[0]
            table, field = row[4:6]
            column = {"position": position, "header": header, "table": table, "field": field}
            if not table or not field:
                column["status"] = "raw_preservation_required"
            else:
                if table not in tables:
                    result = api.request(
                        "GET", "EntityDefinitions?" + urllib.parse.urlencode({
                            "$select": "LogicalName,EntitySetName,PrimaryIdAttribute",
                            "$filter": "LogicalName eq '" + table + "'"}))["value"]
                    if len(result) > 1:
                        raise RuntimeError("Ambiguous destination table metadata")
                    if result:
                        metadata = api.request(
                            "GET", "EntityDefinitions(LogicalName='" + table + "')/Attributes?"
                            "$select=LogicalName,AttributeType,IsValidForCreate,IsValidForUpdate")
                        tables[table] = {value["LogicalName"]: value for value in metadata["value"]}
                    else:
                        tables[table] = None
                attributes = tables[table]
                attribute = attributes.get(field) if attributes is not None else None
                if attributes is None:
                    column["status"] = "destination_table_missing"
                elif attribute is None:
                    column["status"] = "destination_column_missing"
                else:
                    column.update(status="typed_row_validation_required",
                                  type=attribute["AttributeType"],
                                  create=attribute["IsValidForCreate"],
                                  update=attribute["IsValidForUpdate"])
            columns.append(column)
        counts = {}
        for column in columns:
            counts[column["status"]] = counts.get(column["status"], 0) + 1
        return {"status": "read_only_metadata_preflight_not_imported",
                "source": source_path.name, "sheet": sheet.title,
                "worksheet_rows_excluding_header": sheet.max_row - 1,
                "columns_accounted": len(columns), "mapping_status_counts": counts,
                "columns": columns,
                "unresolved": [
                    "Validate all rows against live lengths, precision, dates and choices.",
                    "Preserve all source columns, including raw object markers.",
                    "Resolve existing Equipment identity conflicts without replacing native GUIDs.",
                    "Bind only verified source Account identities; missing relations stay blank.",
                    "Do not infer branch, organisation, location cardinality or pricing age.",
                ]}
    finally:
        source.close()
        schema.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if args.report.resolve() in (args.source.resolve(), args.schema.resolve()):
        parser.error("Report must not overwrite a source workbook")
    report = inspect_mapping(args.source, args.schema, apply.CreateUpdateApi())
    args.report.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.report.with_suffix(args.report.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.report)
    print(json.dumps({key: report[key] for key in
                      ("status", "columns_accounted", "mapping_status_counts")}))


if __name__ == "__main__":
    main()
