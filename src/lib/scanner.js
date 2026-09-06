/**
 * Camera 2D code reader, for every environment LIFF's own scanner does not
 * serve.
 *
 * That is more environments than it sounds. `liff.scanCodeV2()` is available
 * only when *Scan QR* is on for the LIFF app and its size is `Full`; with
 * either missing it is absent inside the LINE client too, and this reader is
 * the only one left. It is not a browsers-only fallback: LINE's in-app browser
 * is WKWebView on iOS and Chrome's WebView on Android, and WKWebView has had
 * `getUserMedia` since iOS 14.3 — the same floor LINE documents for
 * `scanCodeV2()` itself. Below iOS 14.3 neither reader exists and the tenant
 * types the code.
 *
 * `@paulmillr/qr` already carries the decoder alongside the encoder the
 * payment screen draws QR codes with, so this costs no new dependency.
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
      window.removeEventListener('pagehide', abandon);
      overlay.remove();
      resolve(value);
    };

    // A tenant who closes the LIFF window mid-scan never reaches finish(), and
    // an Android camera left with a live track stays locked for the next app
    // that asks for it. pagehide fires on that close where unload does not.
    function abandon() { finish(null); }
    window.addEventListener('pagehide', abandon);

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
