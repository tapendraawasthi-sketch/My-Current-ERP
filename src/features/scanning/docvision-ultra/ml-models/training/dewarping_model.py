import torch
import torch.nn as nn
import torchvision.models as models

class UpBlock(nn.Module):
    def __init__(self, in_c, out_c, use_skip=True):
        super().__init__()
        self.up = nn.ConvTranspose2d(in_c, out_c, kernel_size=2, stride=2)
        self.conv = nn.Sequential(
            nn.Conv2d(out_c * 2 if use_skip else out_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True)
        )
        self.use_skip = use_skip

    def forward(self, x, skip=None):
        x = self.up(x)
        if self.use_skip and skip is not None:
            if x.shape != skip.shape:
                x = nn.functional.interpolate(x, size=skip.shape[2:], mode='bilinear', align_corners=False)
            x = torch.cat([x, skip], dim=1)
        return self.conv(x)

class DewarpNet(nn.Module):
    """
    DewarpNet-inspired ResNet-18 model for curved document dewarping.
    - Encoder: ResNet-18 (pretrained)
    - Decoder: 5 upsampling blocks
    - Output: 256x256x2 backward mapping displacement field (dx, dy)
    """
    def __init__(self):
        super().__init__()
        
        resnet = models.resnet18(pretrained=True)
        self.enc1 = nn.Sequential(resnet.conv1, resnet.bn1, resnet.relu) # 64
        self.enc2 = nn.Sequential(resnet.maxpool, resnet.layer1) # 64
        self.enc3 = resnet.layer2 # 128
        self.enc4 = resnet.layer3 # 256
        self.enc5 = resnet.layer4 # 512
        
        # 5 upsampling blocks
        self.up5 = UpBlock(512, 256)
        self.up4 = UpBlock(256, 128)
        self.up3 = UpBlock(128, 64)
        self.up2 = UpBlock(64, 64)
        self.up1 = UpBlock(64, 32, use_skip=False)
        
        # Predict displacement field
        self.out_conv = nn.Conv2d(32, 2, kernel_size=1)

    def forward(self, x):
        """
        Forward pass for dewarping.
        Args:
            x (torch.Tensor): Input image tensor [B, 3, H, W]
        Returns:
            torch.Tensor: Displacement field [B, 2, 256, 256]
        """
        e1 = self.enc1(x)
        e2 = self.enc2(e1)
        e3 = self.enc3(e2)
        e4 = self.enc4(e3)
        e5 = self.enc5(e4)
        
        d5 = self.up5(e5, e4)
        d4 = self.up4(d5, e3)
        d3 = self.up3(d4, e2)
        d2 = self.up2(d3, e1)
        d1 = self.up1(d2) 
        
        out = self.out_conv(d1)
        
        # Ensure output is exactly 256x256
        if out.shape[2:] != (256, 256):
            out = nn.functional.interpolate(out, size=(256, 256), mode='bilinear', align_corners=False)
            
        return out
