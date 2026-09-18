#!/bin/bash
set -e

echo "=== Building Trip Zoo Android APK ==="

JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ANDROID_SDK="$HOME/Library/Android/sdk"
BUILD_TOOLS="$ANDROID_SDK/build-tools/35.0.0"
PLATFORM="$ANDROID_SDK/platforms/android-34/android.jar"

JAVAC="$JAVA_HOME/bin/javac"
KEYTOOL="$JAVA_HOME/bin/keytool"
AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
BUILD_DIR="$ANDROID_DIR/build_temp"
OUTPUT_APK="$PROJECT_ROOT/public/downloads/tripzoo.apk"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/compiled_res" "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$PROJECT_ROOT/public/downloads"

# 1. Compile Resources with aapt2
echo "[1/6] Compiling Android resources with aapt2..."
"$AAPT2" compile --dir "$ANDROID_DIR/app/src/main/res" -o "$BUILD_DIR/compiled_res.zip"

# 2. Link resources and generate R.java + unaligned APK
echo "[2/6] Linking APK and generating R.java..."
"$AAPT2" link "$BUILD_DIR/compiled_res.zip" \
  -I "$PLATFORM" \
  --manifest "$ANDROID_DIR/app/src/main/AndroidManifest.xml" \
  --java "$BUILD_DIR/gen" \
  -o "$BUILD_DIR/unaligned_no_dex.apk" \
  --auto-add-overlay

# 3. Compile Java source files
echo "[3/6] Compiling Java source files..."
"$JAVAC" -source 1.8 -target 1.8 \
  -cp "$PLATFORM" \
  -d "$BUILD_DIR/classes" \
  "$BUILD_DIR/gen/org/tripcounter/tripzoo/R.java" \
  "$ANDROID_DIR/app/src/main/java/org/tripcounter/tripzoo/MainActivity.java"

# 4. Convert classes to DEX bytecode with d8
echo "[4/6] Converting bytecode to classes.dex with d8..."
"$D8" --output "$BUILD_DIR" \
  --lib "$PLATFORM" \
  --min-api 21 \
  $(find "$BUILD_DIR/classes" -name "*.class")

# 5. Add classes.dex to APK
echo "[5/6] Packaging classes.dex into APK..."
cp "$BUILD_DIR/unaligned_no_dex.apk" "$BUILD_DIR/unaligned.apk"
cd "$BUILD_DIR"
/usr/bin/zip -u "$BUILD_DIR/unaligned.apk" classes.dex
cd "$PROJECT_ROOT"

# 6. Align APK with zipalign
echo "[6/6] Aligning & Signing APK with apksigner..."
"$ZIPALIGN" -f -v 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

# Generate debug keystore if not exists
KEYSTORE="$BUILD_DIR/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  "$KEYTOOL" -genkey -v -keystore "$KEYSTORE" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=TripZoo, OU=Rentzoo, O=Rentzoo Private Limited, L=Mumbai, ST=Maharashtra, C=IN"
fi

# Sign APK with apksigner (v1 + v2 + v3 signatures)
"$APKSIGNER" sign --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --ks-key-alias androiddebugkey \
  --key-pass pass:android \
  --out "$OUTPUT_APK" \
  "$BUILD_DIR/aligned.apk"

# Verify signature
"$APKSIGNER" verify --verbose "$OUTPUT_APK"

echo "✅ Trip Zoo APK successfully built, aligned, and signed at: $OUTPUT_APK"
ls -lh "$OUTPUT_APK"
