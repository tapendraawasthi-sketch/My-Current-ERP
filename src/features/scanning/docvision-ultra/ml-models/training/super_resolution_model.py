import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image

class ResidualDenseBlock(nn.Module):
    """
    Residual Dense Block.
    Contains 5 convolutional layers with dense connections.
    """
    def __init__(self, nf=64, gc=32, bias=True):
        super(ResidualDenseBlock, self).__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1, bias=bias)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1, bias=bias)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1, bias=bias)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1, bias=bias)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1, bias=bias)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x

class RRDB(nn.Module):
    """
    Residual in Residual Dense Block.
    Used as the core building block for Real-ESRGAN variants.
    """
    def __init__(self, nf=64, gc=32):
        super(RRDB, self).__init__()
        self.rdb1 = ResidualDenseBlock(nf, gc)
        self.rdb2 = ResidualDenseBlock(nf, gc)
        self.rdb3 = ResidualDenseBlock(nf, gc)

    def forward(self, x):
        out = self.rdb1(x)
        out = self.rdb2(out)
        out = self.rdb3(out)
        return out * 0.2 + x

class CompactRealESRGAN(nn.Module):
    """
    Compact Real-ESRGAN variant optimized for Document text-aware Super-Resolution.
    Upscales 128x128 -> 512x512 (4x factor) using 6 RRDB blocks.
    """
    def __init__(self, in_nc=3, out_nc=3, nf=64, nb=6, gc=32):
        """
        Args:
            in_nc (int): Input number of channels.
            out_nc (int): Output number of channels.
            nf (int): Number of filters.
            nb (int): Number of RRDB blocks.
            gc (int): Growth channel in dense blocks.
        """
        super(CompactRealESRGAN, self).__init__()
        self.conv_first = nn.Conv2d(in_nc, nf, 3, 1, 1, bias=True)
        self.body = nn.Sequential(*[RRDB(nf=nf, gc=gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        
        # Upsampling (x4) -> two PixelShuffle x2 steps
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        self.conv_last = nn.Conv2d(nf, out_nc, 3, 1, 1, bias=True)

        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        body_feat = self.conv_body(self.body(feat))
        feat = feat + body_feat
        
        # Upsample 1 (x2)
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        # Upsample 2 (x2)
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        
        out = self.conv_last(self.lrelu(self.conv_hr(feat)))
        return out

class TextSharpnessLoss(nn.Module):
    """
    Penalizes blurry output by calculating the Laplacian of the text edges
    and encouraging higher variance/energy (which corresponds to sharper text).
    """
    def __init__(self):
        super(TextSharpnessLoss, self).__init__()
        # Laplacian kernel
        laplacian_kernel = torch.tensor([[0, 1, 0],
                                         [1, -4, 1],
                                         [0, 1, 0]], dtype=torch.float32).unsqueeze(0).unsqueeze(0)
        # Register as buffer so it's moved to the correct device with the module
        self.register_buffer('laplacian_kernel', laplacian_kernel)

    def forward(self, img):
        """
        Args:
            img (torch.Tensor): Output image of shape (B, C, H, W). Assumes RGB [0,1].
        """
        # Convert RGB to Grayscale
        # Y = 0.299 R + 0.587 G + 0.114 B
        gray = 0.299 * img[:, 0:1, :, :] + 0.587 * img[:, 1:2, :, :] + 0.114 * img[:, 2:3, :, :]
        
        # Compute laplacian
        laplacian = F.conv2d(gray, self.laplacian_kernel, padding=1)
        
        # Variance of laplacian gives the focus/sharpness measure.
        # We want to maximize this, so we return the negative variance.
        var = torch.var(laplacian, dim=[1, 2, 3])
        return -torch.mean(var)

class DocumentSRDataset(Dataset):
    """
    Dataset for loading LR and HR document image pairs for super resolution.
    """
    def __init__(self, root_dir, split='train', scale=4, hr_size=512):
        """
        Args:
            root_dir (str): Root directory with 'hr' (high res) folder.
            split (str): 'train' or 'val'.
            scale (int): Downsampling scale factor.
            hr_size (int): Size of the HR image crops.
        """
        self.root_dir = os.path.join(root_dir, split)
        self.hr_dir = os.path.join(self.root_dir, 'hr')
        self.scale = scale
        self.hr_size = hr_size
        self.lr_size = hr_size // scale
        
        if os.path.exists(self.hr_dir):
            self.image_files = sorted(os.listdir(self.hr_dir))
        else:
            self.image_files = []
            
        self.transform_hr = transforms.Compose([
            transforms.Resize((self.hr_size, self.hr_size)),
            transforms.ToTensor(),
        ])
        
        self.transform_lr = transforms.Compose([
            transforms.Resize((self.lr_size, self.lr_size), interpolation=Image.BICUBIC),
            transforms.ToTensor(),
        ])

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, idx):
        hr_path = os.path.join(self.hr_dir, self.image_files[idx])
        img = Image.open(hr_path).convert('RGB')
        
        hr_img = self.transform_hr(img)
        lr_img = self.transform_lr(img)
        
        return lr_img, hr_img

def train_super_resolution(model_save_path='super_resolution_model.pth'):
    """
    Basic training loop stub for Document Super Resolution model.
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = CompactRealESRGAN(nb=6).to(device)
    
    # Losses
    l1_criterion = nn.L1Loss()
    sharpness_criterion = TextSharpnessLoss().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=2e-4)
    
    # Dummy DataLoader just for the stub
    dataset = DocumentSRDataset(root_dir='./data')
    if len(dataset) == 0:
        print("No data found for training super resolution. Skipping real loop.")
        return
        
    dataloader = DataLoader(dataset, batch_size=4, shuffle=True, num_workers=2)
    
    epochs = 10
    model.train()
    
    # Sharpness weight
    lambda_sharp = 0.01 

    for epoch in range(epochs):
        epoch_loss = 0.0
        for i, (lr, hr) in enumerate(dataloader):
            lr, hr = lr.to(device), hr.to(device)
            
            optimizer.zero_grad()
            sr = model(lr)
            
            # Combined Loss: Pixel-level + Text Sharpness
            loss_pixel = l1_criterion(sr, hr)
            loss_sharp = sharpness_criterion(sr)
            loss = loss_pixel + lambda_sharp * loss_sharp
            
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        print(f"Epoch [{epoch+1}/{epochs}], Loss: {epoch_loss/len(dataloader):.4f}")
        
    torch.save(model.state_dict(), model_save_path)
    print(f"Model saved to {model_save_path}")

if __name__ == "__main__":
    # Test model shape consistency and loss function
    net = CompactRealESRGAN(nb=6)
    loss_fn = TextSharpnessLoss()
    
    x = torch.randn(1, 3, 128, 128)
    y = net(x)
    sharpness = loss_fn(y)
    
    print(f"LR Input: {x.shape} -> SR Output: {y.shape}")
    print(f"Sharpness Loss: {sharpness.item():.4f}")
