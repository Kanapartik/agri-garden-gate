plugins { id("com.android.application") }
android {
 namespace = "com.agrivah.fieldwork"
 compileSdk = 36
 defaultConfig { applicationId = "com.agrivah.fieldwork"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "1.0.0-rc1"; testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
 buildTypes { release { isMinifyEnabled = false } }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
dependencies { testImplementation("junit:junit:4.13.2"); androidTestImplementation("androidx.test:runner:1.7.0"); androidTestImplementation("androidx.test.ext:junit:1.3.0") }
