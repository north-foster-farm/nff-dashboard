#!/usr/bin/env python3
"""Export the dashboard theme colors as a Pixelmator Pro palette.

Parses the app's real color sources —

  - index.html      semantic ``--c-*`` tokens (dark + light themes,
                    including the rgba row-state overlays)
  - src/styles.css  decorative Tailwind scales (``--color-<name>-<step>``)

— and emits ``.ignored/North Foster Farm v<version>.colorpalette``
(version taken from package.json, ``-alpha`` dropped), a bundle in
Pixelmator's exported-palette format (reverse-engineered from a stock
palette export: an XML-plist library index, one collection plist naming
the palette, and one preset plist per swatch whose ``ColorDataKey`` is a
JSON payload holding sRGB floats plus an embedded ICC profile).

Deterministic UUIDs (uuid5 of the swatch key) keep re-exports diffable:
an unchanged color produces byte-identical plists.

Usage:  python3 scripts/export-pixelmator-palette.py
Then:   double-click the bundle (or File > Import in Pixelmator Pro's
        color-palette browser) to import/refresh it.
"""

import json
import plistlib
import re
import shutil
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# The palette is versioned by the app version that exported it, so
# imports are distinguishable in Pixelmator's palette list (it keeps
# name-colliding imports side by side rather than replacing them).
_version = json.loads(
    (REPO / "package.json").read_text()
)["version"].removesuffix("-alpha")
PALETTE_NAME = "North Foster Farm v" + _version
OUT = REPO / ".ignored" / (PALETTE_NAME + ".colorpalette")

# Fixed namespace so swatch/collection/library ids are stable across
# runs (uuid5 of the swatch key). Generated once; never change it.
NS = uuid.UUID("6f1e6f5e-9a1c-4a55-8b1e-3f2d7c4e9b10")

# Mirrors the "created-at-base-version" / "options" fields of a stock
# Pixelmator export; meaning unknown, values copied verbatim.
BASE_VERSION = 158
OPTIONS = 2

# sRGB IEC61966-2.1 ICC profile, base64, copied from a stock Pixelmator
# palette export. Embedded in every swatch's ColorDataKey payload.
SRGB_ICC = (
    "AAAMSExpbm8CEAAAbW50clJHQiBYWVogB84AAgAJAAYAMQAAYWNzcE1TRlQAAAAASUVDIHNS"
    "R0IAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1IUCAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARY3BydAAAAVAAAAAzZGVzYwAAAYQAAABsd3RwdAAA"
    "AfAAAAAUYmtwdAAAAgQAAAAUclhZWgAAAhgAAAAUZ1hZWgAAAiwAAAAUYlhZWgAAAkAAAAAU"
    "ZG1uZAAAAlQAAABwZG1kZAAAAsQAAACIdnVlZAAAA0wAAACGdmlldwAAA9QAAAAkbHVtaQAA"
    "A/gAAAAUbWVhcwAABAwAAAAkdGVjaAAABDAAAAAMclRSQwAABDwAAAgMZ1RSQwAABDwAAAgM"
    "YlRSQwAABDwAAAgMdGV4dAAAAABDb3B5cmlnaHQgKGMpIDE5OTggSGV3bGV0dC1QYWNrYXJk"
    "IENvbXBhbnkAAGRlc2MAAAAAAAAAEnNSR0IgSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAASc1JH"
    "QiBJRUM2MTk2Ni0yLjEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAFhZWiAAAAAAAADzUQABAAAAARbMWFlaIAAAAAAAAAAAAAAAAAAAAABYWVog"
    "AAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAA"
    "ts9kZXNjAAAAAAAAABZJRUMgaHR0cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAAABZJRUMgaHR0"
    "cDovL3d3dy5pZWMuY2gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAZGVzYwAAAAAAAAAuSUVDIDYxOTY2LTIuMSBEZWZhdWx0IFJHQiBjb2xvdXIgc3Bh"
    "Y2UgLSBzUkdCAAAAAAAAAAAAAAAuSUVDIDYxOTY2LTIuMSBEZWZhdWx0IFJHQiBjb2xvdXIg"
    "c3BhY2UgLSBzUkdCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGRlc2MAAAAAAAAALFJlZmVyZW5j"
    "ZSBWaWV3aW5nIENvbmRpdGlvbiBpbiBJRUM2MTk2Ni0yLjEAAAAAAAAAAAAAACxSZWZlcmVu"
    "Y2UgVmlld2luZyBDb25kaXRpb24gaW4gSUVDNjE5NjYtMi4xAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAB2aWV3AAAAAAATpP4AFF8uABDPFAAD7cwABBMLAANcngAAAAFYWVogAAAAAABM"
    "CVYAUAAAAFcf521lYXMAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAKPAAAAAnNpZyAAAAAA"
    "Q1JUIGN1cnYAAAAAAAAEAAAAAAUACgAPABQAGQAeACMAKAAtADIANwA7AEAARQBKAE8AVABZ"
    "AF4AYwBoAG0AcgB3AHwAgQCGAIsAkACVAJoAnwCkAKkArgCyALcAvADBAMYAywDQANUA2wDg"
    "AOUA6wDwAPYA+wEBAQcBDQETARkBHwElASsBMgE4AT4BRQFMAVIBWQFgAWcBbgF1AXwBgwGL"
    "AZIBmgGhAakBsQG5AcEByQHRAdkB4QHpAfIB+gIDAgwCFAIdAiYCLwI4AkECSwJUAl0CZwJx"
    "AnoChAKOApgCogKsArYCwQLLAtUC4ALrAvUDAAMLAxYDIQMtAzgDQwNPA1oDZgNyA34DigOW"
    "A6IDrgO6A8cD0wPgA+wD+QQGBBMEIAQtBDsESARVBGMEcQR+BIwEmgSoBLYExATTBOEE8AT+"
    "BQ0FHAUrBToFSQVYBWcFdwWGBZYFpgW1BcUF1QXlBfYGBgYWBicGNwZIBlkGagZ7BowGnQav"
    "BsAG0QbjBvUHBwcZBysHPQdPB2EHdAeGB5kHrAe/B9IH5Qf4CAsIHwgyCEYIWghuCIIIlgiq"
    "CL4I0gjnCPsJEAklCToJTwlkCXkJjwmkCboJzwnlCfsKEQonCj0KVApqCoEKmAquCsUK3Arz"
    "CwsLIgs5C1ELaQuAC5gLsAvIC+EL+QwSDCoMQwxcDHUMjgynDMAM2QzzDQ0NJg1ADVoNdA2O"
    "DakNww3eDfgOEw4uDkkOZA5/DpsOtg7SDu4PCQ8lD0EPXg96D5YPsw/PD+wQCRAmEEMQYRB+"
    "EJsQuRDXEPURExExEU8RbRGMEaoRyRHoEgcSJhJFEmQShBKjEsMS4xMDEyMTQxNjE4MTpBPF"
    "E+UUBhQnFEkUahSLFK0UzhTwFRIVNBVWFXgVmxW9FeAWAxYmFkkWbBaPFrIW1hb6Fx0XQRdl"
    "F4kXrhfSF/cYGxhAGGUYihivGNUY+hkgGUUZaxmRGbcZ3RoEGioaURp3Gp4axRrsGxQbOxtj"
    "G4obshvaHAIcKhxSHHscoxzMHPUdHh1HHXAdmR3DHeweFh5AHmoelB6+HukfEx8+H2kflB+/"
    "H+ogFSBBIGwgmCDEIPAhHCFIIXUhoSHOIfsiJyJVIoIiryLdIwojOCNmI5QjwiPwJB8kTSR8"
    "JKsk2iUJJTglaCWXJccl9yYnJlcmhya3JugnGCdJJ3onqyfcKA0oPyhxKKIo1CkGKTgpaymd"
    "KdAqAio1KmgqmyrPKwIrNitpK50r0SwFLDksbiyiLNctDC1BLXYtqy3hLhYuTC6CLrcu7i8k"
    "L1ovkS/HL/4wNTBsMKQw2zESMUoxgjG6MfIyKjJjMpsy1DMNM0YzfzO4M/E0KzRlNJ402DUT"
    "NU01hzXCNf02NzZyNq426TckN2A3nDfXOBQ4UDiMOMg5BTlCOX85vDn5OjY6dDqyOu87LTtr"
    "O6o76DwnPGU8pDzjPSI9YT2hPeA+ID5gPqA+4D8hP2E/oj/iQCNAZECmQOdBKUFqQaxB7kIw"
    "QnJCtUL3QzpDfUPARANER0SKRM5FEkVVRZpF3kYiRmdGq0bwRzVHe0fASAVIS0iRSNdJHUlj"
    "SalJ8Eo3Sn1KxEsMS1NLmkviTCpMcky6TQJNSk2TTdxOJU5uTrdPAE9JT5NP3VAnUHFQu1EG"
    "UVBRm1HmUjFSfFLHUxNTX1OqU/ZUQlSPVNtVKFV1VcJWD1ZcVqlW91dEV5JX4FgvWH1Yy1ka"
    "WWlZuFoHWlZaplr1W0VblVvlXDVchlzWXSddeF3JXhpebF69Xw9fYV+zYAVgV2CqYPxhT2Gi"
    "YfViSWKcYvBjQ2OXY+tkQGSUZOllPWWSZedmPWaSZuhnPWeTZ+loP2iWaOxpQ2maafFqSGqf"
    "avdrT2una/9sV2yvbQhtYG25bhJua27Ebx5veG/RcCtwhnDgcTpxlXHwcktypnMBc11zuHQU"
    "dHB0zHUodYV14XY+dpt2+HdWd7N4EXhueMx5KnmJeed6RnqlewR7Y3vCfCF8gXzhfUF9oX4B"
    "fmJ+wn8jf4R/5YBHgKiBCoFrgc2CMIKSgvSDV4O6hB2EgITjhUeFq4YOhnKG14c7h5+IBIhp"
    "iM6JM4mZif6KZIrKizCLlov8jGOMyo0xjZiN/45mjs6PNo+ekAaQbpDWkT+RqJIRknqS45NN"
    "k7aUIJSKlPSVX5XJljSWn5cKl3WX4JhMmLiZJJmQmfyaaJrVm0Kbr5wcnImc951kndKeQJ6u"
    "nx2fi5/6oGmg2KFHobaiJqKWowajdqPmpFakx6U4pammGqaLpv2nbqfgqFKoxKk3qamqHKqP"
    "qwKrdavprFys0K1ErbiuLa6hrxavi7AAsHWw6rFgsdayS7LCszizrrQltJy1E7WKtgG2ebbw"
    "t2i34LhZuNG5SrnCuju6tbsuu6e8IbybvRW9j74KvoS+/796v/XAcMDswWfB48JfwtvDWMPU"
    "xFHEzsVLxcjGRsbDx0HHv8g9yLzJOsm5yjjKt8s2y7bMNcy1zTXNtc42zrbPN8+40DnQutE8"
    "0b7SP9LB00TTxtRJ1MvVTtXR1lXW2Ndc1+DYZNjo2WzZ8dp22vvbgNwF3IrdEN2W3hzeot8p"
    "36/gNuC94UThzOJT4tvjY+Pr5HPk/OWE5g3mlucf56noMui86Ubp0Opb6uXrcOv77IbtEe2c"
    "7ijutO9A78zwWPDl8XLx//KM8xnzp/Q09ML1UPXe9m32+/eK+Bn4qPk4+cf6V/rn+3f8B/yY"
    "/Sn9uv5L/tz/bf//"
)


def hex_to_rgba(hex_str):
    h = hex_str.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1.0]


def parse_theme_block(html, theme):
    """Return ordered {token: [r,g,b,a]} for one data-theme block."""
    block = re.search(
        r'html\[data-theme="%s"\]\s*\{(.*?)\n\s*\}' % theme,
        html, re.S,
    ).group(1)
    colors = {}
    pat = re.compile(
        r"--c-([\w-]+):\s*(#[0-9a-fA-F]{6}|rgba\([^)]+\))"
    )
    for name, value in pat.findall(block):
        if value.startswith("#"):
            colors[name] = hex_to_rgba(value)
        else:
            nums = re.findall(r"[\d.]+", value)
            r, g, b, a = nums
            colors[name] = [
                int(r) / 255, int(g) / 255, int(b) / 255, float(a),
            ]
    return colors


def parse_scales(css):
    """Return ordered {scale: {step: [r,g,b,a]}} from src/styles.css."""
    scales = {}
    pat = re.compile(r"--color-([a-z-]+?)-(\d{2,3}):\s*(#[0-9a-fA-F]{6})")
    for scale, step, value in pat.findall(css):
        scales.setdefault(scale, {})[int(step)] = hex_to_rgba(value)
    return scales


def color_data(rgba):
    """Build the ColorDataKey JSON payload (matches stock exports)."""
    payload = [1, {
        "csr": 0,
        "ctx": [1, {"cs": [1, {"map": {
            "0": [1, {"m": 2, "k": 0, "icc": SRGB_ICC}],
        }}]}],
        "c": rgba,
        "m": 2,
    }]
    text = json.dumps(payload, separators=(",", ":"))
    # Stock exports escape forward slashes inside the base64 ICC blob.
    return text.replace("/", "\\/").encode("utf-8")


def swatch_id(key):
    return str(uuid.uuid5(NS, "swatch:" + key)).upper()


def main():
    html = (REPO / "index.html").read_text()
    css = (REPO / "src" / "styles.css").read_text()

    # Display order: dark tokens, light tokens, then each decorative
    # scale as an unbroken 50->950 gradient run. Every color value
    # appears exactly once: duplicate scales are collapsed, and a token
    # whose value already exists elsewhere (in a scale, or in the other
    # theme) is merged into that swatch's name instead of repeated.
    def key(rgba):
        return tuple(round(v * 255) for v in rgba[:3]) + (rgba[3],)

    scale_runs = []      # [(scale, [(step, rgba), ...])]
    seen_scales = {}
    for scale, steps in parse_scales(css).items():
        ordered = sorted(steps.items())
        signature = tuple(tuple(v) for _, v in ordered)
        if signature in seen_scales:
            print("  skipping %s (duplicate of %s)"
                  % (scale, seen_scales[signature]))
            continue
        seen_scales[signature] = scale
        scale_runs.append((scale, ordered))

    # Index of every swatch by color value; scale steps registered
    # first so a matching token annotates the gradient run rather than
    # punching a hole in it.
    by_value = {}        # key -> mutable [names, rgba]
    for scale, ordered in scale_runs:
        for step, rgba in ordered:
            by_value[key(rgba)] = [["%s %d" % (scale, step)], rgba]

    token_swatches = []  # unique token colors, in display order
    for theme in ("dark", "light"):
        for token, rgba in parse_theme_block(html, theme).items():
            name = "%s (%s)" % (token, theme)
            k = key(rgba)
            if k in by_value:
                by_value[k][0].append(name)
                print("  merging %s into %s" % (name, by_value[k][0][0]))
            else:
                entry = [[name], rgba]
                by_value[k] = entry
                token_swatches.append(entry)

    swatches = [
        (" · ".join(names), rgba)
        for names, rgba in token_swatches
    ] + [
        (" · ".join(by_value[key(rgba)][0]), rgba)
        for _, ordered in scale_runs
        for _, rgba in ordered
    ]

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "presets").mkdir(parents=True)
    (OUT / "collections").mkdir()
    (OUT / "resources").mkdir()

    preset_ids = []
    for name, rgba in swatches:
        pid = swatch_id(name)
        preset_ids.append(pid)
        preset = {
            "created-at-base-version": BASE_VERSION,
            "id": pid,
            "name": name,
            "options": OPTIONS,
            "properties": [
                {"key": "ColorDataKey", "value": color_data(rgba)},
            ],
        }
        with open(OUT / "presets" / (pid + ".plist"), "wb") as f:
            plistlib.dump(preset, f)

    coll_id = str(uuid.uuid5(NS, "collection:" + PALETTE_NAME)).upper()
    collection = {
        "created-at-base-version": BASE_VERSION,
        "id": coll_id,
        "name": PALETTE_NAME,
        "options": OPTIONS,
        "presets-list": preset_ids,
    }
    with open(OUT / "collections" / (coll_id + ".plist"), "wb") as f:
        plistlib.dump(collection, f)

    library = {
        "collections-list": [coll_id],
        "contentBaseVersion": BASE_VERSION,
        "contentEditCount": 0,
        "contentStructureVersion": 1,
        "identifier": str(uuid.uuid5(NS, "library:" + PALETTE_NAME)).upper(),
        "libraryStructureVersion": 2,
        "resources": {},
    }
    with open(OUT / "ColorPalette-LibraryInfo.plist", "wb") as f:
        plistlib.dump(library, f)

    print("wrote %s (%d swatches)" % (OUT, len(swatches)))


if __name__ == "__main__":
    sys.exit(main())
