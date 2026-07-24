import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

/**
 * FCM (ແຈ້ງເຕືອນເຂົ້າມືຖືຊ່າງ) — apply plugin **ສະເພາະເມື່ອມີ google-services.json**.
 *
 * ເປັນຫຍັງຕ້ອງມີເງື່ອນໄຂ: plugin ນີ້ຈະ **ເຮັດໃຫ້ build ລົ້ມ** ຖ້າຫາໄຟລ໌ບໍ່ພົບ
 * ⇒ ຖ້າ apply ຊື່ໆ ຄົນທີ່ຍັງບໍ່ທັນມີໄຟລ໌ (ຫຼື CI) ຈະ build ແອັບບໍ່ໄດ້ເລີຍ.
 * ວາງ google-services.json ໃສ່ android/app/ ເມື່ອໃດ FCM ຕິດເອງເມື່ອນັ້ນ.
 */
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "net.odien.service.odss_tech"
    compileSdk = flutter.compileSdkVersion
    // Firebase/secure-storage/location plugins require NDK 27; newer NDKs remain backward compatible.
    ndkVersion = "27.0.12077973"

    compileOptions {
        // flutter_local_notifications ໃຊ້ java.time ⇒ ຕ້ອງ desugar ໃຫ້ Android ຮຸ່ນເກົ່າໃຊ້ໄດ້
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "net.odien.service.odss_tech"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) signingConfigs.getByName("release") else null
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // ຄູ່ກັບ isCoreLibraryDesugaringEnabled ຂ້າງເທິງ (flutter_local_notifications ຕ້ອງການ)
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
