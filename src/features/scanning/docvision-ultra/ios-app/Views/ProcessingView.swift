import SwiftUI

/// Processing progress indicator shown while the enhancement pipeline runs.
struct ProcessingView: View {
    let capturedImage: UIImage
    let corners: [CGFloat]
    let processor: iOSDocumentProcessor
    
    @State private var currentStep: ProcessingStep = .perspective
    @State private var completedSteps: Set<ProcessingStep> = []
    @State private var isComplete = false
    @State private var result: iOSEnhancementResult?
    @State private var errorMessage: String?
    
    var onComplete: (iOSEnhancementResult) -> Void
    var onCancel: () -> Void
    
    enum ProcessingStep: CaseIterable, Hashable {
        case perspective, illumination, denoising, sharpening, binarization
        
        var label: String {
            switch self {
            case .perspective: return "Correcting perspective"
            case .illumination: return "Balancing lighting"
            case .denoising: return "Reducing noise"
            case .sharpening: return "Sharpening text"
            case .binarization: return "Optimising for OCR"
            }
        }
        
        var icon: String {
            switch self {
            case .perspective: return "perspective"
            case .illumination: return "sun.max"
            case .denoising: return "waveform"
            case .sharpening: return "textformat"
            case .binarization: return "doc.text"
            }
        }
    }
    
    var body: some View {
        ZStack {
            blurredPreview
            
            VStack(spacing: 24) {
                Spacer()
                
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.3), lineWidth: 8)
                        .frame(width: 80, height: 80)
                    Circle()
                        .trim(from: 0, to: 0.7)
                        .stroke(Color(hex: "1557b0"), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .frame(width: 80, height: 80)
                        .rotationEffect(Angle(degrees: isComplete ? 360 : 0))
                        .animation(Animation.linear(duration: 1).repeatForever(autoreverses: false), value: isComplete)
                }
                
                Text("Processing document...")
                    .font(.headline)
                    .foregroundColor(.white)
                
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(ProcessingStep.allCases, id: \.self) { step in
                        HStack {
                            Image(systemName: step.icon)
                                .frame(width: 24)
                                .foregroundColor(completedSteps.contains(step) ? .green : (currentStep == step ? Color(hex: "1557b0") : .gray))
                            
                            Text(step.label)
                                .font(.subheadline)
                                .foregroundColor(completedSteps.contains(step) ? .white : (currentStep == step ? .white : .gray))
                            
                            Spacer()
                            
                            if completedSteps.contains(step) {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.green)
                            } else if currentStep == step {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                        }
                    }
                }
                .padding(.horizontal, 32)
                .frame(maxWidth: 300)
                
                Spacer()
                
                Button(action: onCancel) {
                    Text("Cancel")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red)
                        .cornerRadius(8)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
            }
        }
        .onAppear {
            startProcessing()
        }
    }
    
    private var blurredPreview: some View {
        Image(uiImage: capturedImage)
            .resizable()
            .scaledToFill()
            .edgesIgnoringSafeArea(.all)
            .blur(radius: 20)
            .overlay(Color.black.opacity(0.6))
    }
    
    private func startProcessing() {
        Task {
            // Simulated steps animation running concurrently with processing
            let stepTask = Task {
                for step in ProcessingStep.allCases {
                    if Task.isCancelled { break }
                    await MainActor.run { currentStep = step }
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    await MainActor.run { completedSteps.insert(step) }
                }
            }
            
            do {
                let res = try await processor.processAsync(image: capturedImage, corners: corners, quality: 1)
                
                await MainActor.run {
                    isComplete = true
                    result = res
                    for step in ProcessingStep.allCases {
                        completedSteps.insert(step)
                    }
                }
                
                try? await Task.sleep(nanoseconds: 500_000_000)
                await MainActor.run { onComplete(res) }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
            stepTask.cancel()
        }
    }
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
