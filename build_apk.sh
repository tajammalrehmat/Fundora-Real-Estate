#!/bin/bash
set -e

echo "=== System Information ==="
uname -a
cat /etc/os-release

echo "=== Checking & Installing JDK 21 ==="
export DEBIAN_FRONTEND=noninteractive
# Remove any dpkg locks if stuck
rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock || true
dpkg --configure -a --force-confdef --force-confold || true

# Update and install openjdk-21, unzip, wget
echo "Installing OpenJDK 21 and dependencies..."
apt-get update
apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" openjdk-21-jdk-headless unzip wget

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

echo "=== Checking & Installing Android SDK ==="
SDK_DIR="/app/applet/android-sdk"
if [ ! -d "$SDK_DIR/platforms/android-36" ]; then
    echo "Android SDK not fully installed. Running setup..."
    # Clean up cmdline-tools directory if incomplete
    rm -rf "$SDK_DIR"
    bash ./setup_android_sdk.sh
else
    echo "Android SDK found at $SDK_DIR"
fi

# Ensure local.properties points to correct SDK path
echo "sdk.dir=$SDK_DIR" > android/local.properties

echo "=== Checking & Installing Gradle ==="
GRADLE_VERSION="8.14.3"
GRADLE_DIR="/tmp/gradle-$GRADLE_VERSION"
if [ ! -d "$GRADLE_DIR" ]; then
    echo "Downloading Gradle $GRADLE_VERSION..."
    wget -q "https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip" -O /tmp/gradle.zip
    echo "Extracting Gradle..."
    unzip -q /tmp/gradle.zip -d /tmp
    rm /tmp/gradle.zip
else
    echo "Gradle $GRADLE_VERSION already available"
fi

export PATH="$GRADLE_DIR/bin:$PATH"
echo "Gradle version: $(gradle -v)"

echo "=== Building Capacitor Web Assets ==="
npm run android:build

echo "=== Compiling Android Debug APK (Standard Memory Mode) ==="
# Set java memory limit for other processes
export _JAVA_OPTIONS="-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+UseSerialGC"

gradle -p android assembleDebug \
  --stacktrace \
  --no-daemon \
  --no-parallel \
  --max-workers=1 \
  -Dorg.gradle.jvmargs="-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+UseSerialGC" \
  -Dorg.gradle.parallel=false \
  -Dorg.gradle.workers.max=1

echo "=== Checking Build Artifacts ==="
find android -name "*.apk"
