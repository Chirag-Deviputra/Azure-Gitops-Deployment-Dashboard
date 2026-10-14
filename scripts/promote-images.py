"""Pin both images after CI has successfully published them."""
import re
import sys
from pathlib import Path

sha = sys.argv[1]
if not re.fullmatch(r"[0-9a-f]{40}", sha):
    raise SystemExit("Expected a full lowercase Git commit SHA")
path = Path(__file__).resolve().parents[1] / "helm/gitops-dashboard/values.yaml"
content, count = re.subn(r"(?m)^  imageTag: .+$", f'  imageTag: "{sha}"', path.read_text())
if count != 2:
    raise SystemExit("Expected exactly two component image tags")
path.write_text(content)
