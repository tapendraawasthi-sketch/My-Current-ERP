import SwiftUI

struct QualityMetrics {
    var dcqi: Double = 0.0
    var sharpness: Double = 0.0
    var glare: Double = 0.0
}

struct CameraView: View {
    @StateObject private var cameraController = iOSCameraController()
    @State private var detectionResult: DetectionResultSwift?
    @State private var qualityMetrics = QualityMetrics()
    @State private var capturedData: Data?
    @State private var navigateToReview = false
    
    var body: some View {
        ZStack {
            CameraPreviewRepresentable(session: cameraController.captureSession)
                .ignoresSafeArea()
            
            if let result = detectionResult {
                DocumentOverlayView(detection: result, dcqi: qualityMetrics.dcqi)
            }
            
            VStack {
                Spacer()
                
                Text(guidanceText())
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(8)
                    .padding(.bottom, 20)
                
                HStack {
                    Spacer()
                    ZStack {
                        QualityRingView(dcqi: qualityMetrics.dcqi)
                            .frame(width: 80, height: 80)
                        
                        Button(action: {
                            capturePhoto()
                        }) {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 60, height: 60)
                        }
                    }
                    Spacer()
                }
                .padding(.bottom, 30)
            }
        }
        .onAppear {
            cameraController.configure()
            cameraController.startSession()
        }
        .onDisappear {
            cameraController.stopSession()
        }
        .task {
            for await _ in cameraController.previewFrames {
                // Placeholder: Pass frame to detector and update state
            }
        }
        .task {
            for await result in cameraController.captureResults {
                self.capturedData = result.jpegData
                self.navigateToReview = true
            }
        }
        .navigationDestination(isPresented: $navigateToReview) {
            if let data = capturedData {
                ReviewView(jpegBytes: data)
            }
        }
    }
    
    private func capturePhoto() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
        cameraController.capturePhoto()
    }
    
    private func guidanceText() -> String {
        if qualityMetrics.dcqi >= 0.8 {
            return "Hold still..."
        } else if qualityMetrics.dcqi >= 0.5 {
            return "Improve lighting or align document"
        } else {
            return "Position document in frame"
        }
    }
}
