import re
import json
import gradio as gr
import requests
from pathlib import Path
from modules import scripts
from modules.scripts import OnComponent

LM_STUDIO_BASE = "http://localhost:1234"

EXTENSION_DIR  = Path(__file__).resolve().parent.parent
PRESETS_FILE   = EXTENSION_DIR / "presets.json"
SETTINGS_FILE  = EXTENSION_DIR / "settings.json"

DEFAULT_SETTINGS = {
    "model":           "",
    "temperature":     0.8,
    "timeout":         30,
    "gpu_ttl_enabled": False,
    "gpu_ttl":         300,
    "lm_url":          "http://localhost:1234",
    "send_mode":       "append",
    "auto_generate":   False,
    "continuous_generate": False,
    "loop_delay":      500,
    "last_preset":     "",
}


# ── デフォルトプリセット（初回起動時のみ presets.json に書き込む）──────────
DEFAULT_PRESETS = {
    "Simple": (
        "You are an AI that generates English prompts for Stable Diffusion (anime/illustration models).\n\n"
        "Rules:\n"
        "- Translate the Japanese input into English faithfully without changing its meaning.\n"
        "- Do not add any elements not present in the input.\n"
        "- Output only the prompt text.\n"
        "- Do not write greetings, explanations, preambles, or annotations."
    ),
    "Normal": (
        "You are an AI that generates English prompts for Stable Diffusion (anime/illustration models).\n\n"
        "Rules:\n"
        "- Translate the Japanese input into English and naturally supplement lighting, atmosphere, and quality tags within reasonable bounds.\n"
        "- Add only minimal details to characters and backgrounds based on the input.\n"
        "- Output as an English prompt of approximately 60–80 words.\n"
        "- Output only the prompt text.\n"
        "- Do not write greetings, explanations, preambles, or annotations."
    ),
    "Detail": (
        "You are an AI that generates English prompts for Stable Diffusion (anime/illustration models).\n\n"
        "Rules:\n"
        "- Translate the Japanese input into English and add detailed descriptions of character appearance, outfit, expression, pose, background, lighting, camera angle, art style, and quality tags.\n"
        "- Actively imagine and supplement elements not present in the input.\n"
        "- Output as an English prompt of 100 words or more.\n"
        "- Output only the prompt text.\n"
        "- Do not write greetings, explanations, preambles, or annotations."
    ),
}


# ── 設定管理 ────────────────────────────────────────────────────────────────
def _load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def _save_settings(data: dict):
    s = _load_settings()
    if "model"           in data: s["model"]           = str(data["model"])
    if "temperature"     in data: s["temperature"]     = float(data["temperature"])
    if "timeout"         in data: s["timeout"]         = max(5, int(data["timeout"]))
    if "gpu_ttl_enabled" in data: s["gpu_ttl_enabled"] = bool(data["gpu_ttl_enabled"])
    if "gpu_ttl"         in data: s["gpu_ttl"]         = max(1, int(data["gpu_ttl"]))
    if "lm_url"          in data: s["lm_url"]          = str(data["lm_url"]).rstrip("/") or "http://localhost:1234"
    if "send_mode"       in data: s["send_mode"]       = "replace" if str(data["send_mode"]) == "replace" else "append"
    if "auto_generate"   in data: s["auto_generate"]   = bool(data["auto_generate"])
    if "continuous_generate" in data: s["continuous_generate"] = bool(data["continuous_generate"])
    if "loop_delay"      in data: s["loop_delay"]      = max(0, int(data["loop_delay"]))
    SETTINGS_FILE.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")
    return s



def _save_last_preset(name: str):
    s = _load_settings()
    s["last_preset"] = name
    SETTINGS_FILE.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")


# ── プリセット管理 ──────────────────────────────────────────────────────────
def _load_presets() -> dict:
    if PRESETS_FILE.exists():
        try:
            return json.loads(PRESETS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    # 初回起動: デフォルトを書き込んで返す
    PRESETS_FILE.write_text(json.dumps(DEFAULT_PRESETS, ensure_ascii=False, indent=2), encoding="utf-8")
    return DEFAULT_PRESETS.copy()


def _save_presets(presets: dict):
    PRESETS_FILE.write_text(json.dumps(presets, ensure_ascii=False, indent=2), encoding="utf-8")


# ── LM Studio API ───────────────────────────────────────────────────────────
def _get_models() -> list:
    """GET /api/v1/models — 全インストール済みモデルを返す"""
    try:
        base = _load_settings().get("lm_url", LM_STUDIO_BASE)
        r = requests.get(f"{base}/api/v1/models", timeout=5)
        if r.ok:
            data = r.json()
            models = data.get("models", [])
            return [m["key"] for m in models if m.get("key")]
        return []
    except Exception:
        return []


def _unload_all_models(base: str) -> None:
    """GET /api/v1/models で loaded_instances を取得し全インスタンスを解放する"""
    try:
        r = requests.get(f"{base}/api/v1/models", timeout=5)
        if not r.ok:
            return
        for model in r.json().get("models", []):
            for inst in model.get("loaded_instances", []):
                iid = inst.get("id")          # loaded_instances 内は "id" フィールド
                if iid:
                    requests.post(f"{base}/api/v1/models/unload",
                                  json={"instance_id": iid}, timeout=10)
    except Exception:
        pass


def _load_model(model_id: str, ttl: int) -> str:
    """既存モデルを解放してから POST /api/v1/models/load でロードする"""
    if not model_id:
        return "No model selected"
    try:
        base = _load_settings().get("lm_url", LM_STUDIO_BASE)
        _unload_all_models(base)
        payload: dict = {"model": model_id}
        if ttl > 0:
            payload["ttl"] = ttl
        r = requests.post(f"{base}/api/v1/models/load", json=payload, timeout=120)
        try:
            body = r.json()
        except Exception:
            body = {}
        if not r.ok:
            msg = (body.get("error") or {}).get("message") or str(body.get("error", r.text))[:120]
            return f"Error: {msg}"
        return f"✓ {model_id.split('/')[-1]}"
    except requests.exceptions.ConnectionError:
        return "Error: Cannot connect to LM Studio"
    except Exception as e:
        return f"Error: {e}"


def _is_model_loaded(base: str, model_id: str) -> bool:
    """指定モデルが loaded_instances を持つか確認"""
    try:
        r = requests.get(f"{base}/api/v1/models", timeout=5)
        if not r.ok:
            return False
        for m in r.json().get("models", []):
            if m.get("key") == model_id and m.get("loaded_instances"):
                return True
        return False
    except Exception:
        return False


def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _call_lm(user_input: str, system_prompt: str) -> str:
    if not user_input.strip():
        return ""
    s = _load_settings()
    base     = s.get("lm_url", LM_STUDIO_BASE)
    model_id = s["model"] or ""
    if model_id and not _is_model_loaded(base, model_id):
        ttl = s.get("gpu_ttl", 0) if s.get("gpu_ttl_enabled") else 0
        _load_model(model_id, ttl)
    messages = []
    if system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    messages.append({"role": "user", "content": user_input})
    payload = {
        "model":           s["model"] or "local-model",
        "messages":        messages,
        "temperature":     s["temperature"],
        "max_tokens":      512,
        "stream":          False,
        "enable_thinking": False,
    }
    if s.get("gpu_ttl_enabled") and s.get("gpu_ttl", 0) > 0:
        payload["ttl"] = s["gpu_ttl"]
    try:
        r = requests.post(f"{base}/v1/chat/completions", json=payload, timeout=s["timeout"])
        if not r.ok:
            return f"Error {r.status_code}: {r.text}"
        return _strip_thinking(r.json()["choices"][0]["message"]["content"].strip())
    except requests.exceptions.ConnectionError:
        return "Error: Cannot connect to LM Studio"
    except requests.exceptions.Timeout:
        return f"Error: Timeout ({s['timeout']}s)"
    except Exception as e:
        return f"Error: {e}"


# ── UI ──────────────────────────────────────────────────────────────────────
class LLMDecoratorScript(scripts.Script):

    def __init__(self):
        self.on_after_component_elem_id = [
            ("txt2img_prompt_row", lambda c: self._build_ui(c, "txt2img")),
        ]

    def title(self):
        return "LLMuse"

    def show(self, is_img2img):
        return False if is_img2img else scripts.AlwaysVisible

    def ui(self, is_img2img):
        return []

    def _build_ui(self, _component: OnComponent, tab: str):
        presets  = _load_presets()
        names    = list(presets.keys())
        settings = _load_settings()
        last     = settings.get("last_preset", "")
        initial  = last if last in presets else names[0]

        model_choices = _get_models()
        model_value   = settings.get("model") or None

        with gr.Accordion("✦ LLMuse", open=False, elem_id=f"llm_dec_{tab}", elem_classes="llm-dec-root"):

            # ── 2カラム: 左=プリセット+入力、右=モデル+出力
            with gr.Row():
                with gr.Column(scale=1):
                    with gr.Row():
                        preset_dropdown = gr.Dropdown(
                            choices=names, value=initial, show_label=False,
                            scale=5, elem_id=f"llm_dec_dropdown_{tab}",
                        )
                        preset_btn   = gr.Button("📋", scale=1, min_width=40)
                        settings_btn = gr.Button("⚙",  scale=1, min_width=40)
                    user_input = gr.Textbox(lines=4, show_label=False)
                    run_btn = gr.Button("Run LLM", variant="primary", elem_id=f"llm_dec_run_btn_{tab}")
                with gr.Column(scale=1):
                    send_mode = settings.get("send_mode", "append")
                    with gr.Row():
                        model_dropdown = gr.Dropdown(
                            choices=model_choices, value=model_value,
                            show_label=False,
                            elem_id=f"llm_dec_model_dropdown_{tab}",
                            allow_custom_value=True,
                            scale=3,
                        )
                        send_mode_radio = gr.Radio(
                            choices=["Add", "Rep"],
                            value="Rep" if send_mode == "replace" else "Add",
                            show_label=False, scale=0,
                        )
                    output = gr.Textbox(
                        lines=4, show_label=False, interactive=True,
                        elem_id=f"llm_dec_output_{tab}",
                    )
                    send_btn = gr.Button("Send", variant="secondary", elem_id=f"llm_dec_send_btn_{tab}")

            # ── 非表示コンポーネント: プリセット
            system_prompt = gr.Textbox(
                value=presets[initial], lines=1, show_label=False, interactive=True,
                elem_id=f"llm_dec_sp_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            presets_json = gr.Textbox(
                value=json.dumps(presets, ensure_ascii=False),
                lines=1, show_label=False, interactive=False,
                elem_id=f"llm_dec_presets_json_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            save_trigger = gr.Textbox(
                value="", lines=1, show_label=False, interactive=True,
                elem_id=f"llm_dec_save_trigger_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            delete_trigger = gr.Textbox(
                value="", lines=1, show_label=False, interactive=True,
                elem_id=f"llm_dec_delete_trigger_{tab}", elem_classes="llm-dec-sp-hidden",
            )

            # ── 非表示コンポーネント: 設定
            settings_json = gr.Textbox(
                value=json.dumps(settings, ensure_ascii=False),
                lines=1, show_label=False, interactive=False,
                elem_id=f"llm_dec_settings_json_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            settings_trigger = gr.Textbox(
                value="", lines=1, show_label=False, interactive=True,
                elem_id=f"llm_dec_settings_trigger_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            force_unload_trigger = gr.Textbox(
                value="", lines=1, show_label=False, interactive=True,
                elem_id=f"llm_dec_force_unload_trigger_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            force_unload_status = gr.Textbox(
                value="", lines=1, show_label=False, interactive=False,
                elem_id=f"llm_dec_force_unload_status_{tab}", elem_classes="llm-dec-sp-hidden",
            )
            # ── イベント: ボタン
            settings_btn.click(fn=None, _js=f"() => llmDecOpenSettings('{tab}')")
            preset_btn.click(fn=None,   _js=f"() => llmDecOpenModal('{tab}')")

            def on_send_mode_change(value):
                mode = "replace" if value == "Rep" else "append"
                s = _save_settings({"send_mode": mode})
                return gr.update(value=json.dumps(s, ensure_ascii=False))

            send_mode_radio.change(fn=on_send_mode_change, inputs=[send_mode_radio], outputs=[settings_json])
            # ── イベント: プリセット
            def on_preset_change(name):
                _save_last_preset(name)
                return _load_presets().get(name, "")

            preset_dropdown.change(
                fn=on_preset_change,
                inputs=[preset_dropdown], outputs=[system_prompt],
            )

            def on_save_trigger(cmd):
                if not cmd:
                    return gr.update(), gr.update()
                try:
                    data = json.loads(cmd)
                    name = data.get("name", "").strip()
                    content = data.get("content", "")
                except Exception:
                    return gr.update(), gr.update()
                if not name:
                    return gr.update(), gr.update()
                p = _load_presets()
                p[name] = content
                _save_presets(p)
                return (
                    gr.update(choices=list(p.keys()), value=name),
                    gr.update(value=json.dumps(p, ensure_ascii=False)),
                    gr.update(value=content),
                )

            save_trigger.change(
                fn=on_save_trigger, inputs=[save_trigger],
                outputs=[preset_dropdown, presets_json, system_prompt],
            )

            def on_delete_trigger(cmd):
                if not cmd:
                    return gr.update(), gr.update(), gr.update()
                try:
                    name = json.loads(cmd).get("name", "").strip()
                except Exception:
                    return gr.update(), gr.update(), gr.update()
                p = _load_presets()
                if not name or name not in p or len(p) <= 1:
                    return gr.update(), gr.update(), gr.update()
                p.pop(name)
                _save_presets(p)
                ns = list(p.keys())
                return (
                    gr.update(choices=ns, value=ns[0]),
                    gr.update(value=json.dumps(p, ensure_ascii=False)),
                    gr.update(value=p.get(ns[0], "")),
                )

            delete_trigger.change(
                fn=on_delete_trigger, inputs=[delete_trigger],
                outputs=[preset_dropdown, presets_json, system_prompt],
            )

            # ── イベント: 設定
            def on_settings_trigger(cmd):
                if not cmd:
                    return gr.update()
                try:
                    s = _save_settings(json.loads(cmd))
                    return gr.update(value=json.dumps(s, ensure_ascii=False))
                except Exception:
                    return gr.update()

            settings_trigger.change(
                fn=on_settings_trigger, inputs=[settings_trigger],
                outputs=[settings_json],
            )

            def on_force_unload_trigger(_):
                try:
                    base = _load_settings().get("lm_url", LM_STUDIO_BASE)
                    _unload_all_models(base)
                    return "✓"
                except Exception as e:
                    return f"✕ {e}"

            force_unload_trigger.change(
                fn=on_force_unload_trigger, inputs=[force_unload_trigger],
                outputs=[force_unload_status],
            )

            def on_model_dropdown_change(model_id):
                s = _save_settings({"model": model_id or ""})
                return gr.update(value=json.dumps(s, ensure_ascii=False))

            model_dropdown.change(
                fn=on_model_dropdown_change,
                inputs=[model_dropdown], outputs=[settings_json],
            )


            lm_result = gr.Textbox(
                value="", lines=1, show_label=False, interactive=False,
                elem_id=f"llm_dec_lm_result_{tab}", elem_classes="llm-dec-sp-hidden",
            )

            def _call_lm_ui(user_input: str, system_prompt: str):
                result = _call_lm(user_input, system_prompt)
                s = _load_settings()
                should_auto_send = (
                    s.get("auto_generate")
                    or s.get("continuous_generate")
                )
                if should_auto_send and result and not result.startswith("Error"):
                    return gr.update(value=""), result
                return result, ""

            # ── イベント: 推論 / 送信
            run_btn.click(
                fn=_call_lm_ui, inputs=[user_input, system_prompt], outputs=[output, lm_result],
            ).then(
                fn=None, inputs=[lm_result], outputs=[],
                _js=f"(t) => llmDecAutoSend(t, '{tab}')",
            )
            send_btn.click(fn=None, inputs=[output], outputs=[], _js=f"(t) => llmDecManualSend(t, '{tab}')")
