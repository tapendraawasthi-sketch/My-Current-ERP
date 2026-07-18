import AVFoundation
import CoreMotion
import UIKit

enum CameraHardwareLevel {
    case legacy
    case limited
    case full
    case level3
}

struct CameraFrame {
    let pixelBuffer: CVPixelBuffer
    let timestamp: CMTime
}

struct CaptureResult {
    let jpegData: Data
    let rawData: Data?
    let depthData: AVDepthData?
}

struct DeviceMotionState {
    let roll: Double
    let pitch: Double
    let yaw: Double
}

final class iOSCameraController: NSObject, ObservableObject, AVCapturePhotoCaptureDelegate, AVCaptureVideoDataOutputSampleBufferDelegate {
    
    let captureSession = AVCaptureSession()
    private var photoOutput: AVCapturePhotoOutput?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var depthOutput: AVCaptureDepthDataOutput?
    private let sessionQueue = DispatchQueue(label: "com.docvision.camera", qos: .userInteractive)
    private let motionManager = CMMotionManager()
    
    @Published var isRunning = false
    @Published var hardwareLevel: CameraHardwareLevel = .limited
    
    private var frameContinuation: AsyncStream<CameraFrame>.Continuation?
    private var captureContinuation: AsyncStream<CaptureResult>.Continuation?
    private var motionContinuation: AsyncStream<DeviceMotionState>.Continuation?
    
    lazy var previewFrames: AsyncStream<CameraFrame> = {
        AsyncStream { continuation in
            self.frameContinuation = continuation
        }
    }()
    
    lazy var captureResults: AsyncStream<CaptureResult> = {
        AsyncStream { continuation in
            self.captureContinuation = continuation
        }
    }()
    
    lazy var motionStates: AsyncStream<DeviceMotionState> = {
        AsyncStream { continuation in
            self.motionContinuation = continuation
        }
    }()
    
    private var activeDevice: AVCaptureDevice?
    
    override init() {
        super.init()
    }
    
    func configure() {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            self.captureSession.beginConfiguration()
            self.captureSession.sessionPreset = .photo
            
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
                self.captureSession.commitConfiguration()
                return
            }
            self.activeDevice = device
            
            do {
                let input = try AVCaptureDeviceInput(device: device)
                if self.captureSession.canAddInput(input) {
                    self.captureSession.addInput(input)
                }
            } catch {
                print("Failed to add input: \(error)")
                self.captureSession.commitConfiguration()
                return
            }
            
            let videoOut = AVCaptureVideoDataOutput()
            videoOut.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_420YpCbCr8BiPlanarFullRange)]
            videoOut.alwaysDiscardsLateVideoFrames = true
            videoOut.setSampleBufferDelegate(self, queue: self.sessionQueue)
            if self.captureSession.canAddOutput(videoOut) {
                self.captureSession.addOutput(videoOut)
                self.videoOutput = videoOut
            }
            
            let photoOut = AVCapturePhotoOutput()
            if self.captureSession.canAddOutput(photoOut) {
                self.captureSession.addOutput(photoOut)
                self.photoOutput = photoOut
            }
            
            if let depthDevice = AVCaptureDevice.default(.builtInLiDARDepthCamera, for: .video, position: .back) {
                let depthOut = AVCaptureDepthDataOutput()
                if self.captureSession.canAddOutput(depthOut) {
                    self.captureSession.addOutput(depthOut)
                    self.depthOutput = depthOut
                }
            }
            
            self.captureSession.commitConfiguration()
        }
    }
    
    func startSession() {
        sessionQueue.async { [weak self] in
            self?.captureSession.startRunning()
            DispatchQueue.main.async {
                self?.isRunning = true
            }
        }
        
        motionManager.deviceMotionUpdateInterval = 1.0 / 200.0
        motionManager.startDeviceMotionUpdates(to: OperationQueue.main) { [weak self] motion, error in
            guard let motion = motion, error == nil else { return }
            let state = DeviceMotionState(roll: motion.attitude.roll, pitch: motion.attitude.pitch, yaw: motion.attitude.yaw)
            self?.motionContinuation?.yield(state)
        }
    }
    
    func stopSession() {
        sessionQueue.async { [weak self] in
            self?.captureSession.stopRunning()
            DispatchQueue.main.async {
                self?.isRunning = false
            }
        }
        motionManager.stopDeviceMotionUpdates()
    }
    
    func capturePhoto() {
        sessionQueue.async { [weak self] in
            guard let self = self, let photoOutput = self.photoOutput else { return }
            
            let settings = AVCapturePhotoSettings()
            if photoOutput.availablePhotoCodecTypes.contains(.hevc) {
                // prefer HEVC if we wanted
            }
            
            photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            print("Capture error: \(error)")
            return
        }
        
        guard let jpegData = photo.fileDataRepresentation() else { return }
        
        let result = CaptureResult(
            jpegData: jpegData,
            rawData: nil,
            depthData: photo.depthData
        )
        captureContinuation?.yield(result)
    }
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        
        let frame = CameraFrame(pixelBuffer: pixelBuffer, timestamp: timestamp)
        frameContinuation?.yield(frame)
    }
    
    func setExposure(duration: CMTime, iso: Float) {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            device.setExposureModeCustom(duration: duration, iso: iso, completionHandler: nil)
            device.unlockForConfiguration()
        } catch { }
    }
    
    func setFocusDistance(lensPosition: Float) {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            device.setFocusModeLocked(lensPosition: lensPosition, completionHandler: nil)
            device.unlockForConfiguration()
        } catch { }
    }
    
    func setWhiteBalance(temperature: Float, tint: Float) {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            let tempTint = AVCaptureDevice.WhiteBalanceTemperatureAndTintValues(temperature: temperature, tint: tint)
            let gains = device.deviceWhiteBalanceGains(for: tempTint)
            device.setWhiteBalanceModeLocked(with: gains, completionHandler: nil)
            device.unlockForConfiguration()
        } catch { }
    }
    
    func setExposureBias(ev: Float) {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            device.setExposureTargetBias(ev, completionHandler: nil)
            device.unlockForConfiguration()
        } catch { }
    }
    
    func lockAE() {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            if device.isExposureModeSupported(.locked) {
                device.exposureMode = .locked
            }
            device.unlockForConfiguration()
        } catch { }
    }
    
    func lockAF() {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            if device.isFocusModeSupported(.locked) {
                device.focusMode = .locked
            }
            device.unlockForConfiguration()
        } catch { }
    }
    
    func lockAWB() {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            if device.isWhiteBalanceModeSupported(.locked) {
                device.whiteBalanceMode = .locked
            }
            device.unlockForConfiguration()
        } catch { }
    }
    
    func tapToFocus(at point: CGPoint) {
        guard let device = activeDevice else { return }
        do {
            try device.lockForConfiguration()
            if device.isFocusPointOfInterestSupported && device.isFocusModeSupported(.autoFocus) {
                device.focusPointOfInterest = point
                device.focusMode = .autoFocus
            }
            if device.isExposurePointOfInterestSupported && device.isExposureModeSupported(.autoExpose) {
                device.exposurePointOfInterest = point
                device.exposureMode = .autoExpose
            }
            device.unlockForConfiguration()
        } catch { }
    }
}
