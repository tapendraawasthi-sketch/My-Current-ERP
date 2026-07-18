import SwiftUI

struct EnhancedDocumentView: View {
    let result: iOSEnhancementResult
    
    @State private var selectedTab: DocumentTab = .color
    @State private var showInfoSheet = false
    
    var onSaveAsImage: () -> Void
    var onSaveAsPdf: () -> Void
    var onAddPage: () -> Void
    var onRetake: () -> Void
    
    enum DocumentTab: String, CaseIterable {
        case color = "Color"
        case grayscale = "Grayscale"
        case binary = "Binary (OCR)"
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("Mode", selection: $selectedTab) {
                    ForEach(DocumentTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()
                
                ZoomableImageView(image: currentImage)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(white: 0.95))
                
                HStack(spacing: 12) {
                    actionButton(title: "Retake", icon: "arrow.uturn.backward", action: onRetake)
                    actionButton(title: "Add Page", icon: "plus.circle", action: onAddPage)
                    actionButton(title: "Save Image", icon: "photo", action: onSaveAsImage)
                    actionButton(title: "Save PDF", icon: "doc.richtext", action: onSaveAsPdf)
                }
                .padding()
                .background(Color.white.shadow(radius: 2))
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showInfoSheet = true }) {
                        Image(systemName: "info.circle")
                    }
                }
            }
            .sheet(isPresented: $showInfoSheet) {
                metadataSheet
            }
        }
    }
    
    private var currentImage: UIImage {
        switch selectedTab {
        case .color: return result.colorEnhanced
        case .grayscale: return result.grayscale
        case .binary: return result.binary ?? result.grayscale
        }
    }
    
    private var metadataSheet: some View {
        NavigationView {
            List {
                Section(header: Text("Processing Metadata")) {
                    HStack {
                        Text("Total Time")
                        Spacer()
                        Text("\(result.totalMs) ms")
                            .foregroundColor(.gray)
                    }
                    HStack {
                        Text("Aspect Ratio")
                        Spacer()
                        Text(String(format: "%.2f", result.aspectRatio))
                            .foregroundColor(.gray)
                    }
                    HStack {
                        Text("Text Coverage")
                        Spacer()
                        Text(String(format: "%.1f%%", result.textCoverage * 100))
                            .foregroundColor(.gray)
                    }
                }
            }
            .navigationTitle("Document Info")
            .navigationBarItems(trailing: Button("Done") { showInfoSheet = false })
        }
    }
    
    private func actionButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack {
                Image(systemName: icon)
                    .font(.system(size: 20))
                Text(title)
                    .font(.system(size: 10))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .foregroundColor(Color(hex: "1557b0"))
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
    }
}

/// Pinch-to-zoom image view.
struct ZoomableImageView: View {
    let image: UIImage
    @GestureState private var magnification: CGFloat = 1.0
    @State private var steadyStateMagnification: CGFloat = 1.0
    
    var body: some View {
        GeometryReader { geometry in
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(width: geometry.size.width, height: geometry.size.height)
                .scaleEffect(magnification * steadyStateMagnification)
                .gesture(
                    MagnificationGesture()
                        .updating($magnification) { currentState, gestureState, _ in
                            gestureState = currentState
                        }
                        .onEnded { value in
                            steadyStateMagnification *= value
                            if steadyStateMagnification < 1.0 {
                                withAnimation { steadyStateMagnification = 1.0 }
                            }
                        }
                )
                .onTapGesture(count: 2) {
                    withAnimation { steadyStateMagnification = 1.0 }
                }
        }
    }
}
