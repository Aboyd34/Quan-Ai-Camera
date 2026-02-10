
# Rome Cam Pro: APK Finalization Guide

This project is now configured for **Capacitor 6**. 

## Environment Prerequisites
1. **Node.js**: v18+ 
2. **Java (JDK)**: v17 or v21 (Essential for Gradle).
3. **Android Studio**: Latest version with SDK Platform 34+.

## Build Workflow (PowerShell)
1. Open PowerShell in the project root.
2. Run `./setup-android.ps1` to initialize the bridge.
3. Run `npx cap open android`.
4. Inside Android Studio:
   - Select **Build > Generate Signed Bundle / APK**.
   - Choose **APK**.
   - Create or select your `.jks` keystore file.
   - Select `release` build variant.
   - Click **Finish**.

## Hardare Optimization
The `capacitor.config.json` is set to `allowMixedContent: true` to facilitate communication between the local webview and the Gemini API over HTTPS. 

For the highest performance on Android devices, ensure the WebView is updated to the latest version on the target handset.
