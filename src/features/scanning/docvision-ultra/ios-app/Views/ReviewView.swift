import SwiftUI

struct ReviewView: View {
    let jpegBytes: Data
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: {
                    dismiss()
                }) {
                    Text("Retake")
                        .foregroundColor(.blue)
                        .padding()
                }
                Spacer()
            }
            .background(Color.black)
            
            if let uiImage = UIImage(data: jpegBytes) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black)
            } else {
                Color.black.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            
            HStack {
                badge(title: "DCQI: 0.9", color: .green)
                badge(title: "Sharpness: 0.85", color: .green)
                badge(title: "Glare: Low", color: .green)
                
                Spacer()
                
                Button(action: {
                    saveImage()
                }) {
                    Text("Save")
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .cornerRadius(8)
                }
            }
            .padding()
            .background(Color.black)
        }
        .navigationBarHidden(true)
    }
    
    private func badge(title: String, color: Color) -> some View {
        Text(title)
            .font(.caption)
            .bold()
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color)
            .cornerRadius(4)
    }
    
    private func saveImage() {
        let docsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let fileUrl = docsPath.appendingPathComponent("\(UUID().uuidString).jpg")
        try? jpegBytes.write(to: fileUrl)
        dismiss()
    }
}
