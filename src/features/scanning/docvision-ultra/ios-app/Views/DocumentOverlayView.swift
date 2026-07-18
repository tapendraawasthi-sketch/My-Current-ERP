import SwiftUI

struct DocumentOverlayView: View {
    var detection: DetectionResultSwift
    var dcqi: Double
    
    var body: some View {
        GeometryReader { geo in
            Canvas { context, size in
                guard let corners = detection.corners else { return }
                
                var path = Path()
                
                // Assuming points are normalized [0, 1] for UI coordinates
                let p1 = CGPoint(x: CGFloat(corners.topLeft.x) * size.width, y: CGFloat(corners.topLeft.y) * size.height)
                let p2 = CGPoint(x: CGFloat(corners.topRight.x) * size.width, y: CGFloat(corners.topRight.y) * size.height)
                let p3 = CGPoint(x: CGFloat(corners.bottomRight.x) * size.width, y: CGFloat(corners.bottomRight.y) * size.height)
                let p4 = CGPoint(x: CGFloat(corners.bottomLeft.x) * size.width, y: CGFloat(corners.bottomLeft.y) * size.height)
                
                path.move(to: p1)
                path.addLine(to: p2)
                path.addLine(to: p3)
                path.addLine(to: p4)
                path.closeSubpath()
                
                let color = strokeColor()
                context.stroke(path, with: .color(color), lineWidth: 3)
                context.fill(path, with: .color(color.opacity(0.1)))
                
                let points = [p1, p2, p3, p4]
                for p in points {
                    let rect = CGRect(x: p.x - 4, y: p.y - 4, width: 8, height: 8)
                    context.fill(Path(ellipseIn: rect), with: .color(color))
                }
            }
            .animation(.easeInOut(duration: 0.1), value: dcqi)
        }
    }
    
    private func strokeColor() -> Color {
        if dcqi >= 0.8 { return .green }
        if dcqi >= 0.5 { return .yellow }
        return .red
    }
}
