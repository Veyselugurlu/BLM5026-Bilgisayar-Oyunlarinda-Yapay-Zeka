"""
Explanatory figures for the Week 5 report (diagrams + Basic learning curve).
  python tools/make_figures.py
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

OUT = Path("docs/week05/images")
OUT.mkdir(parents=True, exist_ok=True)
BLUE, ORANGE, GREEN, GREY, INK = "#2a6fdb", "#e07b00", "#1a9e5c", "#eef1f5", "#222831"


def box(ax, x, y, w, h, title, lines, color):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.03",
                                fc=GREY, ec=color, lw=2.2))
    ax.text(x + w / 2, y + h - 0.07, title, ha="center", va="top", fontsize=12.5, weight="bold", color=color)
    for i, line in enumerate(lines):
        ax.text(x + w / 2, y + h - 0.2 - i * 0.085, line, ha="center", va="top", fontsize=10, color=INK)


def arrow(ax, p, q, text, color, offset=(0, 0.04)):
    ax.add_patch(FancyArrowPatch(p, q, arrowstyle="-|>", mutation_scale=18, lw=2, color=color,
                                 connectionstyle="arc3,rad=0.0"))
    ax.text((p[0] + q[0]) / 2 + offset[0], (p[1] + q[1]) / 2 + offset[1], text, ha="center",
            fontsize=10, color=color, weight="bold")


def rl_loop():
    fig, ax = plt.subplots(figsize=(11, 4.6))
    ax.set_xlim(0, 3.2)
    ax.set_ylim(0, 1.25)
    ax.axis("off")
    box(ax, 0.05, 0.25, 1.15, 0.85, "Unity (Ortam + Ajan)",
        ["RollerBallAgent.cs", "Rigidbody fiziği, zemin, hedef", "OnEpisodeBegin / OnActionReceived",
         "CollectObservations", "Ödül: hedefe ulaşınca +1"], GREEN)
    box(ax, 2.0, 0.25, 1.15, 0.85, "Python (mlagents-learn)",
        ["PPO algoritması", "Sinir ağı: 2 katman x 128 nöron", "Deneyimlerden öğrenir",
         "Politikayı günceller", "Çıktı: .onnx model dosyası"], BLUE)
    arrow(ax, (1.22, 0.86), (1.98, 0.86), "Gözlem (8 sayı) + Ödül", GREEN)
    arrow(ax, (1.98, 0.5), (1.22, 0.5), "Aksiyon (2 sayı: X, Z kuvveti)", BLUE, offset=(0, -0.09))
    ax.text(1.6, 0.08, "Eğitimden sonra: .onnx dosyası Unity'ye geri konur ve Python'a gerek kalmadan çalışır (Inference)",
            ha="center", fontsize=10, style="italic", color=ORANGE)
    fig.tight_layout()
    fig.savefig(OUT / "diagram_rl_loop.png", dpi=150)
    plt.close(fig)


def observation_vector():
    fig, ax = plt.subplots(figsize=(11, 2.6))
    ax.set_xlim(0, 8)
    ax.set_ylim(0, 2)
    ax.axis("off")
    cells = [("hedef.x", ORANGE), ("hedef.y", ORANGE), ("hedef.z", ORANGE),
             ("ajan.x", GREEN), ("ajan.y", GREEN), ("ajan.z", GREEN),
             ("hız.x", BLUE), ("hız.z", BLUE)]
    for i, (name, c) in enumerate(cells):
        ax.add_patch(FancyBboxPatch((i + 0.05, 0.75), 0.9, 0.6, boxstyle="round,pad=0.01", fc=c, alpha=0.18, ec=c, lw=2))
        ax.text(i + 0.5, 1.05, name, ha="center", va="center", fontsize=11, weight="bold", color=INK)
        ax.text(i + 0.5, 1.55, f"[{i}]", ha="center", fontsize=9, color="#666")
    ax.text(1.5, 0.45, "Hedefin konumu (3)", ha="center", color=ORANGE, fontsize=11, weight="bold")
    ax.text(4.5, 0.45, "Ajanın konumu (3)", ha="center", color=GREEN, fontsize=11, weight="bold")
    ax.text(7.0, 0.45, "Ajanın hızı (2)", ha="center", color=BLUE, fontsize=11, weight="bold")
    ax.text(4, 0.08, "Toplam 3 + 3 + 2 = 8 sayı → Behavior Parameters: Vector Observation Space Size = 8",
            ha="center", fontsize=10.5, color=INK)
    fig.tight_layout()
    fig.savefig(OUT / "diagram_observation_vector.png", dpi=150)
    plt.close(fig)


def episode_flow():
    fig, ax = plt.subplots(figsize=(11, 2.4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 2)
    ax.axis("off")
    steps = [("OnEpisodeBegin", "Ajanı merkeze koy,\nhızı sıfırla,\nhedefi rastgele yere koy"),
             ("CollectObservations", "8 sayıyı topla"),
             ("Politika karar verir", "2 sayı üret\n(-1 ile +1 arası)"),
             ("OnActionReceived", "Kuvvet uygula,\nödül / bitiş kontrolü"),
             ("Sonuç", "Mesafe < 1.4 → +1, bitti\ny < -1 → düştü, bitti\n500 adım → süre doldu")]
    for i, (t, d) in enumerate(steps):
        x = 0.1 + i * 2
        ax.add_patch(FancyBboxPatch((x, 0.2), 1.75, 1.6, boxstyle="round,pad=0.02", fc=GREY, ec=BLUE, lw=1.8))
        ax.text(x + 0.875, 1.6, t, ha="center", va="center", fontsize=10, weight="bold", color=BLUE)
        ax.text(x + 0.875, 0.85, d, ha="center", va="center", fontsize=9, color=INK)
        if i < 4:
            ax.add_patch(FancyArrowPatch((x + 1.78, 1.0), (x + 2.07, 1.0), arrowstyle="-|>", mutation_scale=14, color=INK))
    fig.tight_layout()
    fig.savefig(OUT / "diagram_episode_flow.png", dpi=150)
    plt.close(fig)


def basic_curve():
    run = Path("results/Basic_U63_01/Basic")
    if not run.exists():
        return
    acc = EventAccumulator(str(run), size_guidance={"scalars": 0})
    acc.Reload()
    ev = acc.Scalars("Environment/Cumulative Reward")
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot([e.step for e in ev], [e.value for e in ev], color=BLUE, marker="o", ms=4, label="Ortalama ödül")
    ax.axhline(0.93, color=GREEN, ls="--", label="Teorik en iyi: 1 − 7×0.01 = 0.93")
    ax.axhline(0.07, color=ORANGE, ls=":", label="Küçük hedef: 0.1 − 3×0.01 = 0.07")
    ax.set_xlabel("Eğitim adımı")
    ax.set_ylabel("Episode başına ödül")
    ax.set_title("Sunu 1: Basic ortamında PPO eğitimi (Basic_U63_01)")
    ax.grid(alpha=0.3)
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(OUT / "basic_training_curve.png", dpi=140)
    plt.close(fig)


if __name__ == "__main__":
    rl_loop()
    observation_vector()
    episode_flow()
    basic_curve()
    print("figures ->", OUT)
