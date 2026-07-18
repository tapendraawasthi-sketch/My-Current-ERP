import SwiftUI
import AVFoundation

@main
struct DocVisionApp: App {
    @State private var hasCameraPermission = false
    
    var body: some Scene {
        WindowGroup {
            if hasCameraPermission {
                NavigationStack {
                    CameraView()
                }
            } else {
                VStack {
                    Text("Camera permission is required")
                        .font(.headline)
                    Button("Grant Permission") {
                        requestPermission()
                    }
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .onAppear {
                    checkPermission()
                }
            }
        }
    }
    
    private func checkPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            hasCameraPermission = true
        case .notDetermined:
            requestPermission()
        default:
            hasCameraPermission = false
        }
    }
    
    private func requestPermission() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            DispatchQueue.main.async {
                self.hasCameraPermission = granted
            }
        }
    }
}
