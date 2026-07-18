import SwiftUI
import AVFoundation

struct OnboardingView: View {
    @State private var currentPage = 0
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
    
    var body: some View {
        VStack {
            TabView(selection: $currentPage) {
                OnboardingPage(
                    title: "Auto-Capture Magic",
                    description: "Instantly detect document edges and capture automatically without tapping a button.",
                    systemImage: "camera.viewfinder"
                )
                .tag(0)
                
                OnboardingPage(
                    title: "AI Enhancement",
                    description: "Automatically remove shadows, fix perspective, and enhance text clarity.",
                    systemImage: "wand.and.stars"
                )
                .tag(1)
                
                OnboardingPage(
                    title: "Privacy & Encryption",
                    description: "Your documents are securely encrypted on-device and never shared without your permission.",
                    systemImage: "lock.shield"
                )
                .tag(2)
                
                VStack(spacing: 30) {
                    Image(systemName: "checkmark.circle.fill")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 100, height: 100)
                        .foregroundColor(.blue)
                    
                    VStack(spacing: 16) {
                        Text("You're All Set")
                            .font(.title)
                            .bold()
                        
                        Text("Let's get started by granting camera access for scanning documents.")
                            .font(.body)
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                    }
                    
                    Button(action: requestPermissionsAndFinish) {
                        Text("Get Started")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal, 40)
                    .padding(.top, 20)
                }
                .tag(3)
            }
            .tabViewStyle(PageTabViewStyle(indexDisplayMode: .always))
            .indexViewStyle(PageIndexViewStyle(backgroundDisplayMode: .always))
        }
    }
    
    private func requestPermissionsAndFinish() {
        AVCaptureDevice.requestAccess(for: .video) { granted in
            DispatchQueue.main.async {
                hasSeenOnboarding = true
            }
        }
    }
}

struct OnboardingPage: View {
    let title: String
    let description: String
    let systemImage: String
    
    var body: some View {
        VStack(spacing: 30) {
            Image(systemName: systemImage)
                .resizable()
                .scaledToFit()
                .frame(width: 120, height: 120)
                .foregroundColor(.blue)
            
            VStack(spacing: 16) {
                Text(title)
                    .font(.title)
                    .bold()
                
                Text(description)
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 32)
            }
        }
        .padding()
    }
}

struct OnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        OnboardingView()
    }
}
