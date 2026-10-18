#!/usr/bin/env bash
# Evaluates every policy on the same initial conditions (seed 12345, 200 episodes).
#   Fixed  spawn : agent starts at (0, 0.5, 0) as during training
#   Random spawn : agent starts anywhere on the floor (generalisation test, Experiment B)
# Usage: bash tools/run_evaluation.sh <path-to-python>
set -u
PY=${1:-python}
ENV=Builds/RollerBall/RollerBall.exe
OUT=docs/week05/data/eval
N=200
mkdir -p "$OUT"
port=5500

run() { # name, extra args...
  local name=$1; shift
  if [ -f "$OUT/$name.json" ]; then echo "skip $name"; return; fi
  "$PY" tools/evaluate.py --env "$ENV" --episodes $N --port $port --out "$OUT/$name.json" "$@" 2>&1 | grep -vE "WARNING|^\s*$"
  port=$((port + 3))
}

for spawn in Fixed Random; do
  run "random_${spawn}"   --policy random   --obs-mode Absolute8 --spawn-mode $spawn
  run "scripted_${spawn}" --policy scripted --obs-mode Absolute8 --spawn-mode $spawn
  for mode in Absolute8 NoVelocity6 Relative5; do
    for seed in 1 2 3; do
      [ -f "results/RB_${mode}_s${seed}/RollerBall_U63.onnx" ] || { echo "missing model RB_${mode}_s${seed}"; continue; }
      run "ppo_${mode}_s${seed}_${spawn}" --policy onnx --model "results/RB_${mode}_s${seed}/RollerBall_U63.onnx" \
          --obs-mode $mode --spawn-mode $spawn
    done
  done
done
