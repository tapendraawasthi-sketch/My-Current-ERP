import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image

class AttentionGate(nn.Module):
    """
    Attention Gate for U-Net skip connections to focus on salient features
    (e.g., text and structure) while suppressing background regions (e.g., shadows).
    """
    def __init__(self, F_g, F_l, F_int):
        """
        Initializes the AttentionGate.
        
        Args:
            F_g (int): Number of feature maps in the gating signal.
            F_l (int): Number of feature maps in the skip connection.
            F_int (int): Number of intermediate feature maps.
        """
        super(AttentionGate, self).__init__()
        self.W_g = nn.Sequential(
            nn.Conv2d(F_g, F_int, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm2d(F_int)
        )
        
        self.W_x = nn.Sequential(
            nn.Conv2d(F_l, F_int, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm2d(F_int)
        )
        
        self.psi = nn.Sequential(
            nn.Conv2d(F_int, 1, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm2d(1),
            nn.Sigmoid()
        )
        
        self.relu = nn.ReLU(inplace=True)
        
    def forward(self, g, x):
        """
        Forward pass for Attention Gate.
        
        Args:
            g (torch.Tensor): Gating signal from the coarser layer.
            x (torch.Tensor): Skip connection features from the encoder.
            
        Returns:
            torch.Tensor: Attention-weighted skip connection features.
        """
        g1 = self.W_g(g)
        x1 = self.W_x(x)
        psi = self.relu(g1 + x1)
        psi = self.psi(psi)
        return x * psi

class ConvBlock(nn.Module):
    """
    Standard double convolution block used in U-Net.
    """
    def __init__(self, in_ch, out_ch):
        super(ConvBlock, self).__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True)
        )
        
    def forward(self, x):
        return self.conv(x)

class AttentionUNet(nn.Module):
    """
    Attention U-Net model for document shadow removal.
    Maps a 512x512x3 RGB shadowed image to a 512x512x3 RGB shadow-free image.
    Uses 4 encoder blocks and 4 decoder blocks with Attention Gates.
    """
    def __init__(self, in_channels=3, out_channels=3):
        super(AttentionUNet, self).__init__()
        
        self.Maxpool = nn.MaxPool2d(kernel_size=2, stride=2)
        
        # Encoder
        self.Conv1 = ConvBlock(in_channels, 32)
        self.Conv2 = ConvBlock(32, 64)
        self.Conv3 = ConvBlock(64, 128)
        self.Conv4 = ConvBlock(128, 256)
        
        # Bottleneck
        self.Conv5 = ConvBlock(256, 512)
        
        # Decoder 4
        self.Up4 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)
        self.Att4 = AttentionGate(F_g=256, F_l=256, F_int=128)
        self.Up_conv4 = ConvBlock(512, 256)
        
        # Decoder 3
        self.Up3 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.Att3 = AttentionGate(F_g=128, F_l=128, F_int=64)
        self.Up_conv3 = ConvBlock(256, 128)
        
        # Decoder 2
        self.Up2 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.Att2 = AttentionGate(F_g=64, F_l=64, F_int=32)
        self.Up_conv2 = ConvBlock(128, 64)
        
        # Decoder 1
        self.Up1 = nn.ConvTranspose2d(64, 32, kernel_size=2, stride=2)
        self.Att1 = AttentionGate(F_g=32, F_l=32, F_int=16)
        self.Up_conv1 = ConvBlock(64, 32)
        
        # Output layer
        self.Conv_1x1 = nn.Conv2d(32, out_channels, kernel_size=1, stride=1, padding=0)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # Encoder
        e1 = self.Conv1(x)
        
        e2 = self.Maxpool(e1)
        e2 = self.Conv2(e2)
        
        e3 = self.Maxpool(e2)
        e3 = self.Conv3(e3)
        
        e4 = self.Maxpool(e3)
        e4 = self.Conv4(e4)
        
        # Bottleneck
        e5 = self.Maxpool(e4)
        e5 = self.Conv5(e5)
        
        # Decoder
        d4 = self.Up4(e5)
        x4 = self.Att4(g=d4, x=e4)
        d4 = torch.cat((x4, d4), dim=1)
        d4 = self.Up_conv4(d4)
        
        d3 = self.Up3(d4)
        x3 = self.Att3(g=d3, x=e3)
        d3 = torch.cat((x3, d3), dim=1)
        d3 = self.Up_conv3(d3)
        
        d2 = self.Up2(d3)
        x2 = self.Att2(g=d2, x=e2)
        d2 = torch.cat((x2, d2), dim=1)
        d2 = self.Up_conv2(d2)
        
        d1 = self.Up1(d2)
        x1 = self.Att1(g=d1, x=e1)
        d1 = torch.cat((x1, d1), dim=1)
        d1 = self.Up_conv1(d1)
        
        out = self.Conv_1x1(d1)
        # Using sigmoid to bound output between 0 and 1, assuming inputs are normalized similarly
        out = self.sigmoid(out) 
        
        return out

class ShadowDataset(Dataset):
    """
    Dataset for loading shadowed and shadow-free document image pairs.
    """
    def __init__(self, root_dir, split='train', img_size=(512, 512)):
        """
        Args:
            root_dir (str): Root directory with 'shadow' and 'shadow_free' folders.
            split (str): 'train' or 'val'.
            img_size (tuple): Target resize dimensions.
        """
        self.root_dir = os.path.join(root_dir, split)
        self.shadow_dir = os.path.join(self.root_dir, 'shadow')
        self.target_dir = os.path.join(self.root_dir, 'shadow_free')
        self.img_size = img_size
        
        # Validate existence, though we fallback to empty list gracefully if missing
        if os.path.exists(self.shadow_dir) and os.path.exists(self.target_dir):
            self.image_files = sorted(os.listdir(self.shadow_dir))
        else:
            self.image_files = []
            
        self.transform = transforms.Compose([
            transforms.Resize(img_size),
            transforms.ToTensor(),
        ])

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, idx):
        shadow_path = os.path.join(self.shadow_dir, self.image_files[idx])
        target_path = os.path.join(self.target_dir, self.image_files[idx])
        
        shadow_img = Image.open(shadow_path).convert('RGB')
        target_img = Image.open(target_path).convert('RGB')
        
        shadow_img = self.transform(shadow_img)
        target_img = self.transform(target_img)
        
        return shadow_img, target_img

def train_shadow_removal(model_save_path='shadow_removal_model.pth'):
    """
    Basic training loop stub for the Attention U-Net model.
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = AttentionUNet().to(device)
    
    # Loss and Optimizer
    criterion = nn.L1Loss() # L1 loss is often preferred for image restoration
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    
    # Dummy DataLoader just for the stub
    dataset = ShadowDataset(root_dir='./data')
    if len(dataset) == 0:
        print("No data found for training shadow removal. Skipping real loop.")
        return
        
    dataloader = DataLoader(dataset, batch_size=4, shuffle=True, num_workers=2)
    
    epochs = 10
    model.train()
    for epoch in range(epochs):
        epoch_loss = 0.0
        for i, (shadow, target) in enumerate(dataloader):
            shadow, target = shadow.to(device), target.to(device)
            
            optimizer.zero_grad()
            output = model(shadow)
            loss = criterion(output, target)
            
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        print(f"Epoch [{epoch+1}/{epochs}], Loss: {epoch_loss/len(dataloader):.4f}")
        
    torch.save(model.state_dict(), model_save_path)
    print(f"Model saved to {model_save_path}")

if __name__ == "__main__":
    # Test model shape consistency
    net = AttentionUNet()
    x = torch.randn(1, 3, 512, 512)
    y = net(x)
    print(f"Input shape: {x.shape} -> Output shape: {y.shape}")
