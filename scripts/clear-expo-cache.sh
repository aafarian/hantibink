#!/bin/bash

echo "🧹 Clearing Expo and React Native caches..."

# Clear watchman watches
if command -v watchman &> /dev/null; then
    echo "Clearing watchman..."
    watchman watch-del-all
fi

# Clear Metro bundler cache
echo "Clearing Metro cache..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
rm -rf $TMPDIR/react-*

# Clear Expo cache
echo "Clearing Expo cache..."
rm -rf ~/.expo
rm -rf mobile/.expo

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force

# Clear iOS build artifacts (if on Mac)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Clearing iOS build artifacts..."
    cd mobile/ios 2>/dev/null && rm -rf build Pods && cd ../..
fi

# Clear Android build artifacts
echo "Clearing Android build artifacts..."
rm -rf mobile/android/build
rm -rf mobile/android/app/build
rm -rf mobile/android/.gradle

echo "✅ Cache cleared successfully!"
echo ""
echo "Now run: npm start"
