"""Check release ZIPs independently of the package writer using Python's zipfile."""

import hashlib
import json
from pathlib import Path
import sys
import zipfile


def verify(archive_path: Path, build_dir: Path = Path("dist")) -> None:
    expected = {
        "background.js", "popup.js", "popup.html", "library.html", "style.css",
        "mark.svg", "manifest.json", "build-info.json",
        "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png",
    }
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)) or set(names) != expected:
            raise ValueError("Package must contain only the 12 expected extension assets")
        for entry in entries:
            if entry.flag_bits & 1 or entry.file_size > 10_000_000:
                raise ValueError("Encrypted or oversized package entry")
            if archive.read(entry) != (build_dir / entry.filename).read_bytes():
                raise ValueError(f"Package does not match the current build: {entry.filename}")
        # read() above checks each entry's CRC with the standard ZIP implementation.
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("manifest_version") != 3:
            raise ValueError("Expected a Manifest V3 extension")
        if manifest.get("permissions") != [
            "storage", "clipboardWrite", "contextMenus", "activeTab", "scripting", "alarms"
        ]:
            raise ValueError("Unexpected extension permissions")
        if any(manifest.get(key) for key in ("content_scripts", "externally_connectable")):
            raise ValueError("Unexpected persistent script or external messaging access")
        hosts = manifest.get("host_permissions", [])
        if len(hosts) > 1 or any(
            not host.startswith("https://") or not host.endswith("/*")
            or "*" in host[:-2] or len(host[8:-2].split("/")) != 1
            for host in hosts
        ):
            raise ValueError("Host access must be restricted to the configured HTTPS origin")
        info = json.loads(archive.read("build-info.json"))
        if info.get("version") != manifest.get("version"):
            raise ValueError("Build version does not match manifest")
    checksum = archive_path.with_name(archive_path.name + ".sha256").read_text().split()
    digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    if checksum != [digest, archive_path.name]:
        raise ValueError("Package checksum does not match archive")
    print(f"Verified {archive_path}: 12 exact build assets, ZIP CRCs, permissions, SHA-256 {digest}")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 2:
            raise ValueError("Usage: python3 scripts/verify-package.py [archive.zip]")
        if len(sys.argv) == 2:
            archive_path = Path(sys.argv[1])
        else:
            version = json.loads(Path("dist/manifest.json").read_text())["version"]
            archive_path = Path(f"release/drop-v{version}-preview.zip")
        verify(archive_path)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, RuntimeError) as error:
        sys.exit(f"Package verification failed: {error}")
