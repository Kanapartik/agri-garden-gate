plugins {
    id("com.android.application")
}

val mobileApiBaseUrl = providers.gradleProperty("MOBILE_API_BASE_URL")
    .orElse("https://api.example.invalid/mobile/v1")

android {
    namespace = "com.agrighar.farmer"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.agrighar.farmer"
        minSdk = 31
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-pilot"

        buildConfigField("String", "MOBILE_API_BASE_URL", "\"${mobileApiBaseUrl.get()}\"")
        buildConfigField("String", "PILOT_ID", "\"pilot-siddipet-raipole-001\"")
        buildConfigField("String", "CONSENT_CONTRACT_VERSION", "\"mobile-consent-2026-08-v1\"")
        buildConfigField("String", "BASELINE_POLICY_VERSION", "\"2026-08-baseline-v1\"")
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".pilot"
            versionNameSuffix = "-debug"
            buildConfigField("boolean", "PILOT_DEMO_MODE", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("boolean", "PILOT_DEMO_MODE", "false")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    bundle {
        language {
            enableSplit = false
        }
    }

    testOptions {
        unitTests.isIncludeAndroidResources = false
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.add("-Xlint:deprecation")
}
