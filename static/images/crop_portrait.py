import argparse
from pathlib import Path

from PIL import Image


TARGET_ASPECT = 2 / 3  # width / height


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crop a PNG to 2:3 (W:H) and resize to target height."
    )
    parser.add_argument("input_png", type=Path, help="Path to source PNG")
    parser.add_argument("height", type=int, help="Target height in pixels")
    return parser.parse_args()


def crop_to_aspect(img: Image.Image) -> Image.Image:
    width, height = img.size
    current_aspect = width / height

    if current_aspect > TARGET_ASPECT:
        # Too wide: crop left/right symmetrically.
        target_width = int(round(height * TARGET_ASPECT))
        crop_left = (width - target_width) // 2
        crop_right = crop_left + target_width
        return img.crop((crop_left, 0, crop_right, height))

    if current_aspect < TARGET_ASPECT:
        # Too tall: crop top/bottom symmetrically.
        target_height = int(round(width / TARGET_ASPECT))
        crop_top = (height - target_height) // 2
        crop_bottom = crop_top + target_height
        return img.crop((0, crop_top, width, crop_bottom))

    return img


def main() -> None:
    args = parse_args()

    if args.height <= 0:
        raise SystemExit("Height must be a positive integer.")

    input_path = args.input_png
    if input_path.suffix.lower() != ".png":
        raise SystemExit("Input must be a .png file.")

    if not input_path.exists():
        raise SystemExit(f"File not found: {input_path}")

    with Image.open(input_path) as img:
        img = img.convert("RGBA")
        cropped = crop_to_aspect(img)
        target_height = args.height
        target_width = int(round(target_height * TARGET_ASPECT))
        resized = cropped.resize((target_width, target_height), Image.LANCZOS)

        output_path = input_path.with_name(
            f"{input_path.stem}_portrait_{target_height}.png"
        )
        resized.save(output_path, format="PNG")

    print(f"Saved: {output_path}")


if __name__ == "__main__":
    main()
