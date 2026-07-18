import SwiftUI

public struct PanoramicGuideView: View {
    public var previousFrameImage: UIImage?
    public var instructionText: String = "Capture the document in tiles. Start from top-left."
    public var showDirectionArrows: Bool = true
    
    public init(previousFrameImage: UIImage? = nil, instructionText: String = "Capture the document in tiles. Start from top-left.", showDirectionArrows: Bool = true) {
        self.previousFrameImage = previousFrameImage
        self.instructionText = instructionText
        self.showDirectionArrows = showDirectionArrows
    }
    
    public var body: some View {
        ZStack {
            // 30% Overlap Ghost Guide
            if let ghostImage = previousFrameImage {
                GeometryReader { geometry in
                    Image(uiImage: ghostImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width * 0.3, height: geometry.size.height)
                        .clipped()
                        .opacity(0.4)
                        .position(x: geometry.size.width * 0.15, y: geometry.size.height / 2)
                }
                .allowsHitTesting(false)
            }
            
            // Overlays
            VStack {
                Text(instructionText)
                    .font(.headline)
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding()
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(8)
                    .padding(.top, 50)
                    .padding(.horizontal, 20)
                
                Spacer()
                
                if showDirectionArrows {
                    HStack {
                        Spacer()
                        Image(systemName: "arrow.right.circle.fill")
                            .resizable()
                            .frame(width: 50, height: 50)
                            .foregroundColor(.white.opacity(0.8))
                            .shadow(radius: 5)
                            .padding(.trailing, 40)
                    }
                    .padding(.bottom, 100)
                }
            }
            
            // Corner Bracket Guides
            CornerBrackets()
                .stroke(Color.yellow.opacity(0.7), lineWidth: 4)
                .padding(20)
                .allowsHitTesting(false)
        }
        .edgesIgnoringSafeArea(.all)
    }
}

struct CornerBrackets: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let size: CGFloat = 40
        
        // Top-left
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + size))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX + size, y: rect.minY))
        
        // Top-right
        path.move(to: CGPoint(x: rect.maxX - size, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + size))
        
        // Bottom-left
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY - size))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + size, y: rect.maxY))
        
        // Bottom-right
        path.move(to: CGPoint(x: rect.maxX - size, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - size))
        
        return path
    }
}
