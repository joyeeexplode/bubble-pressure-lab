export class UIControls {
  constructor({ onPause, onMusicSwitch, onAudioGesture, onSoundToggle, onTouchMode }) {
    this.values = {
      bubbleSize: 1.44,
      bubbleOpacity: 0.55,
      musicVolume: 0.38,
      popVolume: 0.78,
      paused: false,
    };

    this.prompt = document.querySelector("#stagePrompt");
    this.debug = document.querySelector("#debugInfo");
    this.error = document.querySelector("#errorPanel");
    this.pauseBtn = document.querySelector("#pauseToggle");
    this.soundBtn = document.querySelector("#soundToggle");
    this.touchBtn = document.querySelector("#touchToggle");
    this.audioGate = document.querySelector("#audioGate");
    this.audioGateButton = document.querySelector("#audioGateButton");
    this.audioStatus = document.querySelector("#audioStatus");
    this.cursor = document.querySelector("#pinchCursor");
    this.sceneStatus = document.querySelector("#sceneStatus");
    this.rhythmStatus = document.querySelector("#rhythmStatus");
    this.combo = document.createElement("div");
    this.combo.className = "combo-toast";
    document.querySelector("#app").append(this.combo);

    const bindRange = (id, key) => {
      const el = document.querySelector(`#${id}`);
      el.addEventListener("input", () => {
        this.values[key] = Number(el.value);
        onAudioGesture?.();
      });
    };

    bindRange("bubbleSize", "bubbleSize");
    bindRange("bubbleOpacity", "bubbleOpacity");
    bindRange("musicVolume", "musicVolume");
    bindRange("popVolume", "popVolume");

    document.querySelector("#switchMusic").addEventListener("click", async () => {
      await onAudioGesture?.();
      await onMusicSwitch?.();
    });

    this.soundBtn.addEventListener("click", async () => {
      this.soundBtn.disabled = true;
      try {
        const enabled = await onSoundToggle?.();
        this.setSoundEnabled(enabled);
      } finally {
        this.soundBtn.disabled = false;
      }
    });

    this.audioGateButton.addEventListener("click", async () => {
      this.audioGateButton.disabled = true;
      this.audioStatus.textContent = "正在解锁声音…";
      try {
        const enabled = await onAudioGesture?.();
        this.setSoundEnabled(enabled);
        this.audioStatus.textContent = enabled
          ? "声音已开启：应能听到提示音和背景节拍"
          : "声音开启失败，请检查标签页是否静音";
      } catch (error) {
        this.audioStatus.textContent = `声音开启失败：${error.message}`;
      } finally {
        this.audioGateButton.disabled = false;
      }
    });

    this.pauseBtn.addEventListener("click", async () => {
      this.values.paused = !this.values.paused;
      this.pauseBtn.querySelector("span").textContent = this.values.paused ? "▶" : "Ⅱ";
      this.pauseBtn.title = this.values.paused ? "继续" : "暂停";
      this.pauseBtn.setAttribute("aria-label", this.pauseBtn.title);
      await onPause?.(this.values.paused);
    });

    this.touchBtn.addEventListener("click", async () => {
      const enabled = await onTouchMode?.();
      this.setTouchMode(enabled);
    });
  }

  setPrompt(text) {
    this.prompt.textContent = text;
    const card = this.prompt.closest(".stage-card");
    if (card) {
      card.classList.remove("stage-flash");
      void card.offsetWidth;
      card.classList.add("stage-flash");
    }
  }

  setDebug(text) {
    this.debug.textContent = text;
  }

  setPinchCursor(point, pinching = false) {
    if (!this.cursor) return;
    this.cursor.classList.toggle("visible", Boolean(point));
    this.cursor.classList.toggle("pinching", Boolean(pinching));
    if (point) {
      this.cursor.style.left = `${point.x}px`;
      this.cursor.style.top = `${point.y}px`;
    }
  }

  showError(message) {
    this.error.hidden = false;
    this.error.textContent = message;
  }

  clearError() {
    this.error.hidden = true;
    this.error.textContent = "";
  }

  setSoundEnabled(enabled) {
    this.soundBtn.querySelector("span").textContent = enabled ? "●" : "◉";
    this.soundBtn.title = enabled ? "关闭声音" : "开启声音";
    this.soundBtn.setAttribute("aria-label", this.soundBtn.title);
    this.soundBtn.classList.toggle("active", enabled);
    this.soundBtn.setAttribute("aria-pressed", String(enabled));
    if (enabled) {
      this.audioGate.classList.add("hidden");
    } else {
      this.audioGate.classList.remove("hidden");
      this.audioStatus.textContent = "声音已关闭，点击按钮重新开启";
    }
  }

  setTouchMode(enabled) {
    this.touchBtn.classList.toggle("active", enabled);
    this.touchBtn.title = enabled ? "返回手势模式" : "触控模式";
    this.touchBtn.setAttribute("aria-label", this.touchBtn.title);
    this.touchBtn.querySelector("span").textContent = enabled ? "●" : "✦";
  }

  setAmbience(sceneLabel, rhythmLabel) {
    if (this.sceneStatus) this.sceneStatus.textContent = sceneLabel;
    if (this.rhythmStatus) this.rhythmStatus.textContent = rhythmLabel;
  }

  showCombo(combo, amount = 1, completed = false) {
    if (!this.combo) return;
    const text = completed
      ? "压力清空 · 漂亮收尾"
      : amount >= 4
        ? `一捏 ${amount} 个 · 清爽连破`
        : combo >= 8
          ? `${combo} 连破 · 渐入佳境`
          : combo >= 3
            ? `${combo} 连破`
            : "啵";
    this.combo.textContent = text;
    this.combo.classList.remove("visible", "complete");
    void this.combo.offsetWidth;
    this.combo.classList.add("visible");
    if (completed) this.combo.classList.add("complete");
    window.clearTimeout(this.comboTimer);
    this.comboTimer = window.setTimeout(() => this.combo.classList.remove("visible"), completed ? 1200 : 620);
  }
}
