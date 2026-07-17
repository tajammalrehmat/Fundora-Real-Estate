#!/bin/bash
set -e

if [ -d "/usr/lib/jvm/java-21-openjdk-amd64" ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
else
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
fi
export PATH=$JAVA_HOME/bin:$PATH

SDK_DIR="/app/applet/android-sdk"

echo "=== Setting up Android SDK ==="
mkdir -p "$SDK_DIR/cmdline-tools"

echo "Downloading command line tools..."
wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O "$SDK_DIR/cmdline-tools/cmdline-tools.zip"

echo "Extracting command line tools..."
cd "$SDK_DIR/cmdline-tools"
unzip -q cmdline-tools.zip
mv cmdline-tools latest
rm cmdline-tools.zip

echo "Accepting licenses..."
yes | "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK_DIR" --licenses

echo "Installing platforms and build tools..."
"$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK_DIR" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0"

echo "=== Android SDK Setup Complete ==="
