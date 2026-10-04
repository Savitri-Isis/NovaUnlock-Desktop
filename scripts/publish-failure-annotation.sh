#!/usr/bin/env bash
# Publie les lignes utiles d'un journal en annotation GitHub Actions.
#
# Les journaux bruts d'un travail et ses artefacts ne se téléchargent que depuis
# un navigateur (hôte de blobs distinct de l'API). Les annotations, elles, sont
# exposées par l'API check-runs : c'est donc le seul canal qui rende un échec
# lisible sans ouvrir l'interface.
#
# Usage : publish-failure-annotation.sh <journal> <motif étendu> <titre>
set -euo pipefail

log="${1:?journal manquant}"
pattern="${2:?motif manquant}"
title="${3:?titre manquant}"

if [[ ! -s "$log" ]]; then
  echo "::error::${title} — journal absent ou vide."
  exit 0
fi

publish() {
  # % s'échappe en premier, %0A encode le retour à la ligne d'une annotation et
  # chaque ligne est tronquée pour rester dans les limites de l'API.
  local body
  body="$(cut -c1-400 | sed -e 's/%/%25/g' -e 's/\r//g' | awk '{printf "%s%%0A", $0}')"
  if [[ -n "$body" ]]; then
    echo "::error::${title}%0A${body}"
  fi
}

# Les lignes qui comptent sont d'abord extraites du journal complet : dans une
# sortie parallèle ou bavarde, elles peuvent se trouver loin de la fin.
matches="$(grep -nE "$pattern" "$log" | head -n 40 || true)"
if [[ -n "$matches" ]]; then
  printf '%s\n' "$matches" | publish
fi

printf '%s\n' "--- 30 dernières lignes ---"
tail -n 30 "$log" | publish
