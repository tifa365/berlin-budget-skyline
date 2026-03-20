#!/usr/bin/env python3
"""
Fetch Berlin budget rows from the official CSV and generate src/data/budget-data.js.

Input:
  - local CSV path, defaulting to /tmp/doppelhaushalt_2026_2027.csv

Output entry shape:
  {
    t: title label
    a: amount
    y: year
    r: responsibility / area owner
    h: main budget function
    e: Einzelplan label
    k: Kapitel label
    c: title code
    x: title type ("A" for Ausgabe, "E" for Einnahme)
  }
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


DEFAULT_INPUT = Path("/tmp/doppelhaushalt_2026_2027.csv")
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "budget-data.js"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--year", default="all")
    parser.add_argument(
        "--title-type",
        choices=("Ausgabetitel", "Einnahmetitel", "all"),
        default="all",
    )
    return parser.parse_args()


def normalize_text(value: str) -> str:
    return " ".join((value or "").split())


def build_entries(input_path: Path, *, year: str, title_type_filter: str) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    year_filter = None if year == "all" else int(year)
    with input_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row in reader:
            if row.get("BetragTyp") != "Soll":
                continue
            if year_filter is not None and int(row.get("Jahr") or 0) != year_filter:
                continue

            title = normalize_text(row.get("Titelbezeichnung", ""))
            if not title:
                continue

            title_type = normalize_text(row.get("Titelart", ""))
            if title_type_filter != "all" and title_type != title_type_filter:
                continue

            type_code = "A" if title_type == "Ausgabetitel" else "E"
            amount = int(row.get("Betrag") or 0)

            entries.append(
                {
                    "t": title,
                    "a": amount,
                    "y": int(row["Jahr"]),
                    "r": normalize_text(row.get("Bereichsbezeichnung", "")),
                    "h": normalize_text(row.get("Hauptfunktionsbezeichnung", "")),
                    "e": normalize_text(row.get("Einzelplanbezeichnung", "")),
                    "k": normalize_text(row.get("Kapitelbezeichnung", "")),
                    "c": normalize_text(row.get("Titel", "")),
                    "x": type_code,
                }
            )

    entries.sort(
        key=lambda entry: (
            -abs(int(entry["a"])),
            -int(entry["a"]),
            int(entry["y"]),
            str(entry["t"]).casefold(),
            str(entry["c"]),
        )
    )
    return entries


def write_output(entries: list[dict[str, object]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    output_path.write_text(
        f"export const BERLIN_BUDGET_DATA = {payload};\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    entries = build_entries(args.input, year=args.year, title_type_filter=args.title_type)
    write_output(entries, args.output)
    print(f"Wrote {len(entries)} entries to {args.output}")


if __name__ == "__main__":
    main()
