#!/usr/bin/env python3
"""
Process the site background image to remove the logo and nav bar.
Crops the top portion where the UI elements are, keeping the decorative border.
"""

from PIL import Image
import os

def process_background():
    # Load the raw background image
    input_path = "public/images/site-background-raw.png"
    output_path = "public/images/site-background.png"

    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        return

    img = Image.open(input_path)
    width, height = img.size
    print(f"Original image size: {width}x{height}")

    # Crop out the top portion where nav/logo are (approximately top 18-20%)
    # Keep the decorative borders on sides and bottom
    crop_top = int(height * 0.18)  # Remove top 18% where nav/logo sits
    crop_bottom = height

    # Keep full width for the decorative side borders
    crop_left = 0
    crop_right = width

    cropped = img.crop((crop_left, crop_top, crop_right, crop_bottom))
    print(f"Cropped image size: {cropped.size}")

    # Save the processed background
    cropped.save(output_path, "PNG", optimize=True)
    print(f"Saved processed background to: {output_path}")

if __name__ == "__main__":
    process_background()
