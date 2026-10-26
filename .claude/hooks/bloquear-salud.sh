#!/usr/bin/env bash
# Bloquea cualquier herramienta cuya entrada mencione la carpeta 90_SALUD.
input="$(cat)"
if printf '%s' "$input" | grep -qi '90_SALUD'; then
  echo "Acceso denegado: 90_SALUD contiene información de salud y está bloqueada por política del proyecto." >&2
  exit 2
fi
exit 0
