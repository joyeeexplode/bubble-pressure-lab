export async function setupCamera(videoEl, profile) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持摄像头访问，请使用桌面端 Chrome / Edge。");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: profile.cameraWidth },
      height: { ideal: profile.cameraHeight },
    },
    audio: false,
  });

  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}
