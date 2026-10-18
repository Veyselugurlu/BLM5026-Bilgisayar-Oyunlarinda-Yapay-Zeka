#!/usr/bin/env bash
# Trains every RollerBall configuration with 3 seeds (Sunu 2, slides 22-24).
#   Absolute8   : lecture baseline, 8 observations
#   NoVelocity6 : Experiment A, velocity removed
#   Relative5   : Experiment B, relative target position instead of absolute positions
# Each run: same YAML, same budget (max_steps 200000), only the observation set changes.
# -areas 9 runs nine copies of the TrainingArea in parallel (wall-clock speed-up only).
#
# Usage (from the repository root, in the ML-Agents Python environment):
#   bash tools/run_experiments.sh <path-to-mlagents-learn> [modes...]
set -u
LEARN=${1:-mlagents-learn}
shift || true
MODES=${*:-"Absolute8 NoVelocity6 Relative5"}
ENV=Builds/RollerBall/RollerBall.exe

port=5100
mkdir -p results/_logs
for mode in $MODES; do
  for seed in 1 2 3; do
    run="RB_${mode}_s${seed}"
    if [ -f "results/$run/RollerBall_U63.onnx" ]; then echo "skip $run"; continue; fi
    echo "=== $run ($(date +%T))"
    "$LEARN" config/rollerball_2026.yaml --run-id="$run" --env="$ENV" --no-graphics \
      --seed="$seed" --base-port="$port" --time-scale=20 --force \
      --env-args -obsMode "$mode" -areas 9 > "results/_logs/$run.txt" 2>&1
    echo "    exit=$? ($(date +%T))"
    port=$((port + 10))
  done
done
