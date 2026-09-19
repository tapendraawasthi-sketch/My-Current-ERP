import sys, base64
from pathlib import Path
path = Path(sys.argv[1])
data = base64.b64decode(sys.stdin.buffer.read())
path.parent.mkdir(parents=True, exist_ok=True)
path.write_bytes(data)
print(path, len(data), list(data[:4]))