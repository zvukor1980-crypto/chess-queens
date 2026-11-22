#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/android/app/src/main/assets"
RES="$ROOT/android/app/src/main/res/drawable"
mkdir -p "$ASSETS/icons" "$RES"
cp "$ROOT"/{index.html,style.css,v2.css,v3.css,pieces.js,chess.js,engine.js,engine-worker.js,audio.js,app.js,service-worker.js,manifest.webmanifest} "$ASSETS/"
cp "$ROOT"/icons/*.png "$ASSETS/icons/"
cp "$ROOT/icons/icon-192.png" "$RES/chess_queens_icon.png"
gradle -p "$ROOT/android" :app:assembleDebug
mkdir -p "$ROOT/build"
cp "$ROOT/android/app/build/outputs/apk/debug/app-debug.apk" "$ROOT/build/ChessQueens-Android-debug.apk"
echo "APK ready at: $ROOT/build/ChessQueens-Android-debug.apk"
