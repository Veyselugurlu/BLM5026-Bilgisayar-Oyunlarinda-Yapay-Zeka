"""
Reads the TensorBoard logs written by mlagents-learn and draws the learning curves for the report.

Runs are grouped by name: "RB_Absolute8_s1", "RB_Absolute8_s2", ... -> group "Absolute8".
For each group the mean over seeds is drawn as a line and min..max as a shaded band.

  python tools/plot_training.py --results results --prefix RB_ --out docs/week05/images
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator

TAGS = {
    "Environment/Cumulative Reward": "Ortalama ödül (episode başına)",
    "RollerBall/Success Rate": "Başarı oranı",
    "Environment/Episode Length": "Episode uzunluğu (adım)",
    "RollerBall/Fall Rate": "Düşme oranı",
    "Policy/Entropy": "Politika entropisi",
    "Losses/Value Loss": "Value loss",
}
LABELS = {
    "Absolute8": "Baseline: 8 gözlem (mutlak konum + hız)",
    "NoVelocity6": "Deney A: 6 gözlem (hız yok)",
    "Relative5": "Deney B: 5 gözlem (göreli konum + hız)",
}
COLORS = {"Absolute8": "#2a6fdb", "NoVelocity6": "#e07b00", "Relative5": "#1a9e5c"}


def load_run(run_dir):
    event_dirs = [p.parent for p in run_dir.rglob("events.out.tfevents*")]
    data = {}
    for d in event_dirs:
        acc = EventAccumulator(str(d), size_guidance={"scalars": 0})
        acc.Reload()
        for tag in acc.Tags()["scalars"]:
            ev = acc.Scalars(tag)
            data[tag] = (np.array([e.step for e in ev]), np.array([e.value for e in ev]))
    return data


def main(args):
    groups = defaultdict(list)
    for run_dir in sorted(Path(args.results).glob(args.prefix + "*")):
        name = run_dir.name[len(args.prefix):]
        group = name.rsplit("_s", 1)[0]
        groups[group].append((run_dir.name, load_run(run_dir)))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    summary = {}

    fig, axes = plt.subplots(2, 3, figsize=(16, 8.5))
    for ax, (tag, title) in zip(axes.flat, TAGS.items()):
        for group, runs in groups.items():
            curves = [r[1][tag] for r in runs if tag in r[1]]
            if not curves:
                continue
            n = min(len(c[0]) for c in curves)
            steps = curves[0][0][:n]
            values = np.stack([c[1][:n] for c in curves])
            mean = values.mean(axis=0)
            ax.plot(steps, mean, color=COLORS.get(group), label=f"{LABELS.get(group, group)} (n={len(curves)})")
            if len(curves) > 1:
                ax.fill_between(steps, values.min(axis=0), values.max(axis=0), color=COLORS.get(group), alpha=0.18)
        ax.set_title(title)
        ax.set_xlabel("Eğitim adımı")
        ax.grid(alpha=0.3)
    handles, labels = axes.flat[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=3, frameon=False)
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    fig.savefig(out / "training_curves_all.png", dpi=130)
    plt.close(fig)

    # Single, larger figure of the baseline only (easy to read for non-experts)
    if "Absolute8" in groups:
        fig, ax1 = plt.subplots(figsize=(10, 5))
        for run_name, data in groups["Absolute8"]:
            s, v = data["RollerBall/Success Rate"]
            ax1.plot(s, v * 100, alpha=0.85, label=f"{run_name}")
        ax1.set_ylabel("Başarı oranı (%)")
        ax1.set_xlabel("Eğitim adımı")
        ax1.set_ylim(-3, 103)
        ax1.set_title("Baseline PPO: hedefe ulaşma oranı eğitim boyunca nasıl değişti?")
        ax1.grid(alpha=0.3)
        ax1.legend()
        fig.tight_layout()
        fig.savefig(out / "training_success_baseline.png", dpi=130)
        plt.close(fig)

    for group, runs in groups.items():
        summary[group] = {}
        for run_name, data in runs:
            row = {}
            for tag in TAGS:
                if tag in data:
                    s, v = data[tag]
                    row[tag] = {"final": float(v[-1]), "final_step": int(s[-1])}
                    if tag == "RollerBall/Success Rate":
                        hit = np.where(v >= 0.9)[0]
                        row["steps_to_90pct_success"] = int(s[hit[0]]) if len(hit) else None
            summary[group][run_name] = row
    Path(args.summary).parent.mkdir(parents=True, exist_ok=True)
    Path(args.summary).write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps(summary, indent=1, ensure_ascii=False)[:3000])


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--results", default="results")
    p.add_argument("--prefix", default="RB_")
    p.add_argument("--out", default="docs/week05/images")
    p.add_argument("--summary", default="docs/week05/data/training_summary.json")
    main(p.parse_args())
