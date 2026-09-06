/**
 * Camera 2D code reader, for the environments LIFF's own scanner cannot serve.
 *
 * Inside the LINE client `liff.scanCodeV2()` is the only reader that works and
 * this one must not be used: LINE's in-app browser does not hand a page the
 * camera on iOS. Everywhere else — an external browser on a desktop or a
 * phone — the camera is ours to open, and `@paulmillr/qr` already carries the
 * decoder alongside the encoder the payment screen draws QR codes with.
 */

/**
 * Whether opening the camera here is worth attempting.
 *
 * `getUserMedia` exists only in a secure context, and a page served over
 * plain HTTP would fail at the permission prompt rather than at the call.
 */
export function cameraScanAvailable() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.isSecureContext);
}

/**
 * Opens a full-screen viewfinder and resolves with the first code read, or
 * null if the tenant closed it without scanning.
 *
 * Throws only when the camera could not be opened at all — no camera, or
 * permission refused. A frame that fails to decode is the ordinary case and
 * never an error: the next frame gets another try.
 *
 * @returns {Promise<string|null>}
 */
export async function scanWithCamera() {
  const overlay = document.createElement('div');
  overlay.className = 'scanner';
  overlay.innerHTML = `
    <video class="scanner__video" playsinline muted autoplay></video>
    <div class="scanner__frame" aria-hidden="true"></div>
    <p class="scanner__hint">วาง QR ให้อยู่ในกรอบ</p>
    <button class="btn scanner__cancel" type="button">ยกเลิก</button>`;

  const video = overlay.querySelector('.scanner__video');
  document.body.appendChild(overlay);

  // Loaded here rather than at the top of the module: the decoder is a third
  // of this app's JavaScript, and a tenant opening from LINE never reaches
  // this path.
  const { QRCanvas, frontalCamera, frameLoop } = await import('@paulmillr/qr/dom.js');

  let camera;
  try {
    camera = await frontalCamera(video);
  } catch (cause) {
    overlay.remove();
    throw cause;
  }

  // iOS plays an inline stream only when the element is muted and playsinline;
  // a rejected play() there means the frame loop reads a blank video, not a
  // crash, so it is not worth failing the scan over.
  await video.play().catch(() => {});

  return new Promise((resolve) => {
    const canvas = new QRCanvas();
    let stopLoop = () => {};
    let finished = false;

    const finish = (value) => {
      if (finished) return;
      finished = true;
      stopLoop();
      camera.stop();
      overlay.remove();
      resolve(value);
    };

    stopLoop = frameLoop(() => {
      if (finished) return;
      let value;
      try {
        value = camera.readFrame(canvas);
      } catch {
        // Undecodable frame. Wait for the next one.
        return;
      }
      if (value) finish(value);
    });

    overlay.querySelector('.scanner__cancel').addEventListener('click', () => finish(null));
  });
}
