import os
import sys

# Compute the absolute path to the project root directory
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, ".."))

# Append the project root so Python can natively find the 'backend' folder
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Now it is safe to import your app entry point
from backend.app.main import app
