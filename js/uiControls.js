export class UIControls {
  constructor({
    onPause,
    onMusicSwitch,
    onAudioGesture,
    onSoundToggle,
    onTouchMode,
    onPrimaryStart,
    onRetry,
    onErrorTouch,
  }) {
    const defaults = {
      bubbleSize: 1.44,
      bubbleOpacity: 0.55,
      musicVolume: 0.38,
      popVolume: 0.78,
      paused: false,
    };
    try {
      this.values = { ...defaults, ...JSON.parse(localStorage.getItem("bubble-settings") ?? "{}") };
    } catch {
      this.values = defaults;
    }

    this.prompt = document.querySelector("#stagePrompt");
    this.debug = document.querySelector("#debugInfo");
    this.error = document.querySelector("#errorPanel");
    this.errorMessage = document.querySelector("#errorMessage");
    this.retryButton = document.querySelector("#retryButton");
    this.errorTouchButton = document.querySelector("#errorTouchButton");
    this.performanceHint = document.querySelector("#performanceHint");
    this.pauseBtn = document.querySelector("#pauseToggle");
    this.soundBtn = document.querySelector("#soundToggle");
    this.touchBtn = document.querySelector("#touchToggle");
    this.settingsBtn = document.querySelector("#settingsToggle");
    this.settingsPanel = document.querySelector("#mixerSettings");
    this.audioGate = document.querySelector("#audioGate");
    this.audioGateButton = document.querySelector("#audioGateButton");
    this.touchStartButton = document.querySelector("#touchStartButton");
    this.audioStatus = document.querySelector("#audioStatus");
    this.cursor = document.querySelector("#pinchCursor");
    this.sceneStatus = document.querySelector("#sceneStatus");
    this.rhythmStatus = document.querySelector("#rhythmStatus");
    this.combo = document.createElement("div");
    this.combo.className = "combo-toast";
    document.querySelector("#app").append(this.combo);

    const bindRange = (id, key) => {
      const el = document.querySelector(`#${id}`);
      el.value = this.values[key];
      el.addEventListener("input", () => {
        this.values[key] = Number(el.value);
        try {
          localStorage.setItem("bubble-settings", JSON.stringify({
            bubbleSize: this.values.bubbleSize,
            bubbleOpacity: this.values.bubbleOpacity,
            musicVolume: this.values.musicVolume,
            popVolume: this.values.popVolume,
          }));
        } catch {
          // Settings persistence is optional in restricted browsing modes.
        }
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
      this.audioStatus.textContent = "正在启动摄像头与声音…";
      try {
        const enabled = await onAudioGesture?.();
        this.setSoundEnabled(enabled);
        await onPrimaryStart?.();
      } catch (error) {
        this.audioStatus.textContent = `启动失败：${error.message}`;
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

    this.settingsBtn.addEventListener("click", () => {
      const expanded = this.settingsPanel.hidden;
      this.settingsPanel.hidden = !expanded;
      this.settingsBtn.classList.toggle("active", expanded);
      this.settingsBtn.setAttribute("aria-expanded", String(expanded));
      this.settingsBtn.setAttribute("aria-label", expanded ? "收起设置" : "展开设置");
    });

    this.touchStartButton.addEventListener("click", () => onErrorTouch?.());

    this.retryButton.addEventListener("click", () => onRetry?.());
    this.errorTouchButton.addEventListener("click", () => onErrorTouch?.());
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

  showError(message, { retry = true, touch = true } = {}) {
    this.error.hidden = false;
    this.errorMessage.textContent = message;
    this.retryButton.hidden = !retry;
    this.errorTouchButton.hidden = !touch;
  }

  clearError() {
    this.error.hidden = true;
    this.errorMessage.textContent = "";
  }

  showPerformanceHint(text) {
    if (!this.performanceHint) return;
    this.performanceHint.textContent = text;
    this.performanceHint.hidden = false;
    window.clearTimeout(this.performanceHintTimer);
    this.performanceHintTimer = window.setTimeout(() => {
      this.performanceHint.hidden = true;
    }, 4200);
  }

  dismissStartGate() {
    this.started = true;
    this.audioGate.classList.add("hidden");
  }

  setSoundEnabled(enabled) {
    this.soundBtn.querySelector("span").textContent = enabled ? "●" : "◉";
    this.soundBtn.title = enabled ? "关闭声音" : "开启声音";
    this.soundBtn.setAttribute("aria-label", this.soundBtn.title);
    this.soundBtn.classList.toggle("active", enabled);
    this.soundBtn.setAttribute("aria-pressed", String(enabled));
    if (enabled) {
      this.audioGate.classList.add("hidden");
    } else if (!this.started) {
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
