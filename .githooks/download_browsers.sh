#!/usr/bin/env bash
# Downloads and extracts browsers.zip from Firebase Storage if browsers/ is missing or incomplete.

REPO_ROOT="$(git rev-parse --show-toplevel)"
BROWSERS_DIR="$REPO_ROOT/browsers"
BROWSERS_URL="https://firebasestorage.googleapis.com/v0/b/candidai-1bda0.firebasestorage.app/o/browsers.zip?alt=media&token=097b1c6e-23ef-4174-905f-f19796c94887"
ZIP_PATH="$REPO_ROOT/browsers.zip"

if [ -d "$BROWSERS_DIR" ] && [ "$(ls -A "$BROWSERS_DIR")" ]; then
  exit 0
fi

echo "[hooks] browsers/ non trovata. Scarico da Firebase Storage..."

if ! curl -fL --progress-bar -o "$ZIP_PATH" "$BROWSERS_URL"; then
  echo "[hooks] ERRORE: download fallito." >&2
  exit 1
fi

echo "[hooks] Estraggo browsers.zip..."
if command -v unzip &>/dev/null; then
  unzip -q "$ZIP_PATH" -d "$REPO_ROOT"
elif command -v python3 &>/dev/null; then
  python3 -c "import zipfile, sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$ZIP_PATH" "$REPO_ROOT"
else
  echo "[hooks] ERRORE: né unzip né python3 trovati." >&2
  rm -f "$ZIP_PATH"
  exit 1
fi

if [ $? -ne 0 ]; then
  echo "[hooks] ERRORE: estrazione fallita." >&2
  rm -f "$ZIP_PATH"
  exit 1
fi

rm -f "$ZIP_PATH"
echo "[hooks] Browser pronti in browsers/"
