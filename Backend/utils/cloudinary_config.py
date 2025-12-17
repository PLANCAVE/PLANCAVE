import cloudinary
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
