import torch
import torch.nn as nn
import torch.fft

class ConvBlock(nn.Module):
    def __init__(self, in_c, out_c):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_c, out_c, 3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, 3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True)
        )
    def forward(self, x):
        return self.conv(x)

class SpatialUNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc1 = ConvBlock(3, 64)
        self.enc2 = ConvBlock(64, 128)
        self.enc3 = ConvBlock(128, 256)
        self.pool = nn.MaxPool2d(2, 2)
        
        self.up2 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec2 = ConvBlock(256, 128)
        self.up1 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec1 = ConvBlock(128, 64)
        
        self.out = nn.Conv2d(64, 3, 1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        
        d2 = self.up2(e3)
        if d2.shape != e2.shape:
            d2 = nn.functional.interpolate(d2, size=e2.shape[2:], mode='bilinear', align_corners=False)
        d2 = torch.cat([d2, e2], dim=1)
        d2 = self.dec2(d2)
        
        d1 = self.up1(d2)
        if d1.shape != e1.shape:
            d1 = nn.functional.interpolate(d1, size=e1.shape[2:], mode='bilinear', align_corners=False)
        d1 = torch.cat([d1, e1], dim=1)
        d1 = self.dec1(d1)
        
        return self.out(d1)

class FrequencyBranch(nn.Module):
    def __init__(self):
        super().__init__()
        self.mask_net = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 3, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # 2D FFT
        fft_x = torch.fft.fft2(x)
        fft_x_shifted = torch.fft.fftshift(fft_x)
        
        # Magnitude spectrum (log scaled)
        mag = torch.abs(fft_x_shifted)
        mag_log = torch.log(mag + 1e-8)
        
        # Predict frequency mask
        mask = self.mask_net(mag_log)
        
        # Apply mask
        fft_masked = fft_x_shifted * mask
        
        # Inverse FFT
        fft_masked_unshifted = torch.fft.ifftshift(fft_masked)
        out = torch.fft.ifft2(fft_masked_unshifted).real
        
        return out

class DemoireModel(nn.Module):
    """
    Spatial-Frequency U-Net for moiré pattern removal.
    - Spatial branch: standard U-Net on RGB
    - Frequency branch: 2D FFT, Conv layers on magnitude spectrum
    - Fuse: multiply spatial output by inverse FFT of masked frequency spectrum
    """
    def __init__(self):
        super().__init__()
        self.spatial_branch = SpatialUNet()
        self.frequency_branch = FrequencyBranch()

    def forward(self, x):
        """
        Forward pass.
        Args:
            x (torch.Tensor): Input RGB image [B, 3, H, W].
        Returns:
            torch.Tensor: Demoire output [B, 3, H, W].
        """
        spatial_out = self.spatial_branch(x)
        freq_out = self.frequency_branch(x)
        
        # Fuse by multiplying spatial output by inverse FFT of masked frequency spectrum
        out = spatial_out * freq_out
        
        return out
