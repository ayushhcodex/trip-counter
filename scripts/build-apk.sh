#!/bin/bash
set -e

echo "=== Building Trip Zoo Android APK ==="

# Find Java Home
if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
  JAVA_HOME="/opt/homebrew/opt/openjdk@17"
elif [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
elif [ -n "$JAVA_HOME" ]; then
  JAVA_HOME="$JAVA_HOME"
fi

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

# Find Android SDK
ANDROID_SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"

# Use stable build tools (prefer 35.0.0 or 34.0.0 over preview versions)
if [ -d "$ANDROID_SDK/build-tools/35.0.0" ]; then
  BUILD_TOOLS="$ANDROID_SDK/build-tools/35.0.0"
elif [ -d "$ANDROID_SDK/build-tools/34.0.0" ]; then
  BUILD_TOOLS="$ANDROID_SDK/build-tools/34.0.0"
else
  BUILD_TOOLS_VER=$(ls -1 "$ANDROID_SDK/build-tools" | grep -v "3[6-9]" | sort -V | tail -n 1)
  BUILD_TOOLS="$ANDROID_SDK/build-tools/$BUILD_TOOLS_VER"
fi

# Use stable platform (android-34 = Android 14)
if [ -f "$ANDROID_SDK/platforms/android-34/android.jar" ]; then
  PLATFORM="$ANDROID_SDK/platforms/android-34/android.jar"
elif [ -f "$ANDROID_SDK/platforms/android-33/android.jar" ]; then
  PLATFORM="$ANDROID_SDK/platforms/android-33/android.jar"
else
  PLATFORM_VER=$(ls -1 "$ANDROID_SDK/platforms" | grep -v "android-3[6-9]" | sort -V | tail -n 1)
  PLATFORM="$ANDROID_SDK/platforms/$PLATFORM_VER/android.jar"
fi

echo "Using Java: $JAVA_HOME"
echo "Using Build Tools: $BUILD_TOOLS"
echo "Using Platform: $PLATFORM"

JAVAC="$JAVA_HOME/bin/javac"
KEYTOOL="$JAVA_HOME/bin/keytool"
AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
BUILD_DIR="$ANDROID_DIR/build_temp"
KEYSTORE_DIR="$ANDROID_DIR/keystores"
KEYSTORE="$KEYSTORE_DIR/tripzoo-release.keystore"
OUTPUT_APK="$PROJECT_ROOT/public/downloads/tripzoo.apk"

# Clean temporary build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/compiled_res" "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$KEYSTORE_DIR" "$PROJECT_ROOT/public/downloads"

# 1. Compile Resources with aapt2
echo "[1/6] Compiling Android resources with aapt2..."
"$AAPT2" compile --dir "$ANDROID_DIR/app/src/main/res" -o "$BUILD_DIR/compiled_res.zip"

# 2. Link resources and generate R.java + unaligned APK
echo "[2/6] Linking APK and generating R.java..."
"$AAPT2" link "$BUILD_DIR/compiled_res.zip" \
  -I "$PLATFORM" \
  --manifest "$ANDROID_DIR/app/src/main/AndroidManifest.xml" \
  --java "$BUILD_DIR/gen" \
  --min-sdk-version 21 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name "1.0.0" \
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
/usr/bin/zip -q -u "$BUILD_DIR/unaligned.apk" classes.dex
cd "$PROJECT_ROOT"

# 6. Align APK with zipalign
echo "[6/6] Aligning & Signing APK with apksigner..."
"$ZIPALIGN" -f -p 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

# Generate permanent release keystore if not exists
if [ ! -f "$KEYSTORE" ]; then
  echo "Generating persistent signing keystore at $KEYSTORE..."
  "$KEYTOOL" -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass tripzoo123 \
    -alias tripzooroot \
    -keypass tripzoo123 \
    -keyalg RSA \
    -keysize 2048 \
    -validity 20000 \
    -dname "CN=TripZoo, OU=Rentzoo, O=Rentzoo Private Limited, L=Mumbai, ST=Maharashtra, C=IN"
fi

# Sign APK with apksigner (v1 + v2 + v3 signatures)
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:tripzoo123 \
  --ks-key-alias tripzooroot \
  --key-pass pass:tripzoo123 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --v4-signing-enabled false \
  --out "$OUTPUT_APK" \
  "$BUILD_DIR/aligned.apk"

# Remove any stray idsig files
rm -f "$OUTPUT_APK.idsig"

# Verify signature
echo "Verifying APK..."
"$APKSIGNER" verify --verbose --print-certs "$OUTPUT_APK"

# Cleanup temp
rm -rf "$BUILD_DIR"

echo "✅ Trip Zoo APK successfully built, aligned, and signed at: $OUTPUT_APK"
ls -lh "$OUTPUT_APK"
