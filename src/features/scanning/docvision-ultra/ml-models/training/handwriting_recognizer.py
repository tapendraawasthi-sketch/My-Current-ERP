import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

class PrintedVsHandwrittenClassifier(nn.Module):
    """
    Binary classifier to distinguish between printed and handwritten text.
    Expects 64x64 crops.
    Outputs a probability of being handwritten.
    """
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.conv3 = nn.Conv2d(32, 64, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 8 * 8, 128)
        self.fc2 = nn.Linear(128, 1)
        
    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))
        x = self.pool(F.relu(self.conv2(x)))
        x = self.pool(F.relu(self.conv3(x)))
        x = x.view(-1, 64 * 8 * 8)
        x = F.relu(self.fc1(x))
        x = torch.sigmoid(self.fc2(x))
        return x

class CRNN(nn.Module):
    """
    CRNN (CNN + Bidirectional LSTM + CTC Decoder) for handwriting recognition.
    Expects grayscale images of fixed height (e.g., 32px) and variable width.
    """
    def __init__(self, img_channel=1, num_classes=80, hidden_size=256):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(img_channel, 64, 3, 1, 1), nn.ReLU(True), nn.MaxPool2d(2, 2),
            nn.Conv2d(64, 128, 3, 1, 1), nn.ReLU(True), nn.MaxPool2d(2, 2),
            nn.Conv2d(128, 256, 3, 1, 1), nn.BatchNorm2d(256), nn.ReLU(True),
            nn.Conv2d(256, 256, 3, 1, 1), nn.ReLU(True), nn.MaxPool2d((2, 2), (2, 1), (0, 1)),
            nn.Conv2d(256, 512, 3, 1, 1), nn.BatchNorm2d(512), nn.ReLU(True),
            nn.Conv2d(512, 512, 3, 1, 1), nn.ReLU(True), nn.MaxPool2d((2, 2), (2, 1), (0, 1)),
            nn.Conv2d(512, 512, 2, 1, 0), nn.BatchNorm2d(512), nn.ReLU(True)
        )
        self.rnn = nn.Sequential(
            nn.LSTM(512, hidden_size, bidirectional=True, batch_first=True),
        )
        self.rnn2 = nn.LSTM(hidden_size * 2, hidden_size, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_size * 2, num_classes)
        
    def forward(self, x):
        # x: [b, c, h, w]
        conv = self.cnn(x)
        b, c, h, w = conv.size()
        conv = conv.squeeze(2) # [b, c, w]
        conv = conv.permute(0, 2, 1) # [b, w, c]
        
        out, _ = self.rnn(conv)
        out, _ = self.rnn2(out)
        out = self.fc(out) # [b, w, num_classes]
        
        # CTC expects [T, B, C]
        out = out.permute(1, 0, 2)
        out = F.log_softmax(out, dim=2)
        return out

class DummyDataset(Dataset):
    """
    Dummy dataset for training loop demonstration.
    """
    def __init__(self, mode='classifier'):
        self.mode = mode
        
    def __len__(self):
        return 100
        
    def __getitem__(self, idx):
        if self.mode == 'classifier':
            img = torch.randn(1, 64, 64)
            label = torch.tensor([float(idx % 2)])
            return img, label
        else:
            img = torch.randn(1, 32, 128)
            label = torch.randint(1, 80, (10,))
            target_len = torch.tensor([10], dtype=torch.long)
            return img, label, target_len

def train_classifier():
    """
    Dummy training loop for the binary classifier.
    """
    model = PrintedVsHandwrittenClassifier()
    dataset = DummyDataset('classifier')
    loader = DataLoader(dataset, batch_size=16)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCELoss()
    
    print("Training Classifier (Printed vs Handwritten)...")
    for epoch in range(2):
        for img, label in loader:
            optimizer.zero_grad()
            out = model(img)
            loss = criterion(out, label)
            loss.backward()
            optimizer.step()
    print("Classifier training complete.")

def train_crnn():
    """
    Dummy training loop for the CRNN.
    """
    model = CRNN(num_classes=80)
    dataset = DummyDataset('crnn')
    
    def collate_fn(batch):
        imgs = torch.stack([b[0] for b in batch])
        labels = torch.cat([b[1] for b in batch])
        target_lens = torch.cat([b[2] for b in batch])
        return imgs, labels, target_lens
        
    loader = DataLoader(dataset, batch_size=16, collate_fn=collate_fn)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CTCLoss(blank=0)
    
    print("Training CRNN...")
    for epoch in range(2):
        for imgs, labels, target_lens in loader:
            optimizer.zero_grad()
            out = model(imgs)
            input_lens = torch.full((out.size(1),), out.size(0), dtype=torch.long)
            loss = criterion(out, labels, input_lens, target_lens)
            loss.backward()
            optimizer.step()
    print("CRNN training complete.")

if __name__ == "__main__":
    train_classifier()
    train_crnn()
