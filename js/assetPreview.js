import { ITEM_CATALOG, TOY_ITEM_TYPES } from "./itemCatalog.js";

const grid = document.querySelector("#assetGrid");
const template = document.querySelector("#assetCardTemplate");
const status = document.querySelector("#previewStatus");
const camera = document.querySelector("#previewCamera");

for (const type of TOY_ITEM_TYPES) {
  const definition = ITEM_CATALOG[type];
  const card = template.content.firstElementChild.cloneNode(true);
  const image = card.querySelector("img");
  image.src = definition.asset;
  image.alt = `${type} 透明资产`;
  card.querySelector("strong").textContent = type;
  card.querySelector(".material").textContent = definition.materialFamily;
  card.querySelector(".effect").textContent = definition.effectProfile;
  grid.append(card);
}

document.querySelectorAll("[data-bg]").forEach((button) => {
  button.addEventListener("click", async () => {
    const background = button.dataset.bg;
    if (background === "camera") {
      try {
        if (!camera.srcObject) {
          camera.srcObject = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        }
        status.textContent = "摄像头背景：检查明暗区域中的轮廓、色边与实际可读性。";
      } catch (error) {
        status.textContent = `摄像头不可用：${error.message}`;
        return;
      }
    } else {
      status.textContent = `${button.textContent}背景：检查透明边缘、内部空洞和残留底色。`;
    }
    document.body.dataset.background = background;
  });
});
