import SwiftUI

struct QualityRingView: View {
    var dcqi: Double
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 4)
            
            Circle()
                .trim(from: 0, to: CGFloat(dcqi))
                .stroke(ringColor(), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.15), value: dcqi)
        }
    }
    
    private func ringColor() -> Color {
        if dcqi >= 0.8 { return .green }
        if dcqi >= 0.5 { return .yellow }
        return .red
    }
}
