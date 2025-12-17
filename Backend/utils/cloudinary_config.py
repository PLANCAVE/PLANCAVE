import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv

# Load environment variables from .env file
_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))

_dotenv_candidates = [
    os.path.join(_PROJECT_ROOT, ".env"),
    os.path.join(_PROJECT_ROOT, "Backend", ".env"),
]

for _dotenv_path in _dotenv_candidates:
    if os.path.exists(_dotenv_path):
        load_dotenv(dotenv_path=_dotenv_path)
        break

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_to_cloudinary(file_stream, public_id=None, folder="plancave_plans"):
    """Uploads a file stream to Cloudinary and returns the secure URL."""
    if not all([os.getenv("CLOUDINARY_CLOUD_NAME"), os.getenv("CLOUDINARY_API_KEY"), os.getenv("CLOUDINARY_API_SECRET")]):
        # Fallback or error if Cloudinary is not configured
        raise ValueError("Cloudinary is not configured. Set CLOUDINARY environment variables.")

    result = cloudinary.uploader.upload(
        file_stream,
        public_id=public_id,
        folder=folder,
        resource_type="auto"
    )
    return result.get('secure_url')
