/**
 * Converts a canvas to a blob.
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not process captured image.'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.92,
      );
    } catch {
      reject(new Error('Could not process captured image.'));
    }
  });
}

/**
 * Returns the CSS styles for the avatar image based on crop and zoom.
 */
export function avatarImageStyle(cropX: number, cropY: number, zoom: number): React.CSSProperties {
  return {
    objectFit: 'cover',
    objectPosition: `${cropX}% ${cropY}%`,
    transform: `scale(${zoom})`,
    transformOrigin: 'center',
  };
}

/**
 * Validates profile input fields.
 */
export function validateProfileInputs(values: {
  displayName: string;
  phoneNumber: string;
  address: string;
}) {
  if (!values.displayName.trim()) {
    return 'Display name is required.';
  }

  if (values.displayName.trim().length > 80) {
    return 'Display name must be 80 characters or less.';
  }

  if (values.phoneNumber.trim()) {
    const phone = values.phoneNumber.trim();
    const validPhone = /^[+]?[\d\s()-]{7,20}$/.test(phone);
    if (!validPhone) {
      return 'Phone number format looks invalid.';
    }
  }

  if (values.address.trim().length > 240) {
    return 'Address must be 240 characters or less.';
  }

  return null;
}
