#!/bin/bash
set -e

echo "=== Setting up Android SDK ==="
mkdir -p /opt/android-sdk/cmdline-tools

echo "Downloading command line tools..."
wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /opt/android-sdk/cmdline-tools/cmdline-tools.zip

echo "Extracting command line tools..."
cd /opt/android-sdk/cmdline-tools
unzip -q cmdline-tools.zip
mv cmdline-tools latest
rm cmdline-tools.zip

echo "Accepting licenses..."
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk --licenses

echo "Installing platforms and build tools..."
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0" \
  "platforms;android-35" \
  "build-tools;35.0.0"

echo "=== Android SDK Setup Complete ==="
