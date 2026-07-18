plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.docvision.ultra.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.docvision.ultra"
        minSdk = 28
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        
        externalNativeBuild {
            cmake {
                cppFlags += ""
            }
        }
        
        ndk {
            abiFilters.add("arm64-v8a")
            abiFilters.add("armeabi-v7a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            // Provide dummy signing configs for debug to compile
            // signingConfig = signingConfigs.getByName("debug")
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.11"
    }
    
    externalNativeBuild {
        cmake {
            path = file("../docvision-core/android/CMakeLists.txt")
        }
    }
}

dependencies {
    implementation(project(":shared"))
    
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    
    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.navigation.compose)
    
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.view)
    
    implementation(libs.tflite)
    implementation(libs.tflite.gpu)
    implementation(libs.tflite.support)
    
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    androidTestImplementation(composeBom)
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.tooling)
}
