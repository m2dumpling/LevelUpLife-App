import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const androidMain = path.join(root, "android", "app", "src", "main");
const manifestPath = path.join(androidMain, "AndroidManifest.xml");
const resDir = path.join(androidMain, "res");
const javaDir = path.join(androidMain, "java", "com", "leveluplife", "app");
const appBuildGradlePath = path.join(root, "android", "app", "build.gradle");

function ensureFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function configureManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`AndroidManifest.xml not found: ${manifestPath}`);
  }

  let xml = fs.readFileSync(manifestPath, "utf8");
  xml = xml.replace(/android:icon="[^"]+"/, 'android:icon="@mipmap/ic_launcher"');
  xml = xml.replace(/android:roundIcon="[^"]+"/, 'android:roundIcon="@mipmap/ic_launcher_round"');

  const permissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
  ];

  for (const permission of permissions) {
    if (!xml.includes(permission)) {
      xml = xml.replace("</manifest>", `    ${permission}\n</manifest>`);
    }
  }

  fs.writeFileSync(manifestPath, xml, "utf8");
}

function configureStyles() {
  ensureFile(path.join(resDir, "values", "styles.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="AppTheme" />

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`);

  ensureFile(path.join(resDir, "values-v35", "styles.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
        <item name="android:enforceStatusBarContrast">false</item>
        <item name="android:enforceNavigationBarContrast">false</item>
        <item name="android:windowOptOutEdgeToEdgeEnforcement">false</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="AppTheme" />

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`);
}

function configureAppBuildGradle() {
  if (!fs.existsSync(appBuildGradlePath)) {
    throw new Error(`app/build.gradle not found: ${appBuildGradlePath}`);
  }

  let gradle = fs.readFileSync(appBuildGradlePath, "utf8");
  const coreDependency = 'implementation "androidx.core:core:$androidxCoreVersion"';
  gradle = gradle.replace(/\s+implementation "androidx\.core:core:\$androidxCoreVersion"\s*\n/g, "\n");

  if (!gradle.includes(coreDependency.trim())) {
    gradle = gradle.replace(
      /(\s+implementation "androidx\.appcompat:appcompat:\$androidxAppCompatVersion"\s*)/,
      `$1    ${coreDependency}\n`,
    );
  }

  fs.writeFileSync(appBuildGradlePath, gradle, "utf8");
}

function configureSmallIcon() {
  ensureFile(path.join(resDir, "drawable", "ic_stat_leveluplife.xml"), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,2 L19,6 V12 C19,16.7 16.1,20.4 12,22 C7.9,20.4 5,16.7 5,12 V6 Z" />
    <path
        android:fillColor="#FF000000"
        android:fillAlpha="0"
        android:pathData="M0,0 H24 V24 H0 Z" />
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M11,7 H13 V11 H16 L12,17 L8,11 H11 Z" />
</vector>
`);
}

function configureMainActivity() {
  ensureFile(path.join(javaDir, "MainActivity.java"), `package com.leveluplife.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        WindowCompat.enableEdgeToEdge(getWindow());
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        super.onCreate(savedInstanceState);
    }
}
`);
}

configureManifest();
configureStyles();
configureAppBuildGradle();
configureSmallIcon();
configureMainActivity();
console.log("[Android] Manifest, styles, notification icon, and MainActivity configured.");
