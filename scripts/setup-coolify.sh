#!/bin/bash
# Script de configuration Coolify pour lovable-to-astro
#
# Prérequis :
# 1. Crée un token API sur http://51.77.212.239:8000/security/api-tokens
# 2. Lance ce script : ./scripts/setup-coolify.sh <COOLIFY_API_TOKEN>
#
# Ce script va :
# - Lister les serveurs disponibles
# - Créer l'application lovable-to-astro depuis le repo GitHub
# - Afficher l'ID de l'application pour le .env

set -e

COOLIFY_URL="http://51.77.212.239:8000"
TOKEN="${1:?Usage: $0 <COOLIFY_API_TOKEN>}"

echo "=== Configuration Coolify pour lovable-to-astro ==="
echo ""

# 1. Vérifier la connexion
echo "1. Vérification de la connexion..."
VERSION=$(curl -sf -H "Authorization: Bearer $TOKEN" "$COOLIFY_URL/api/v1/version")
echo "   Coolify version: $VERSION"

# 2. Lister les serveurs
echo ""
echo "2. Serveurs disponibles :"
SERVERS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$COOLIFY_URL/api/v1/servers")
echo "$SERVERS" | python3 -m json.tool 2>/dev/null || echo "$SERVERS"

# 3. Lister les projets
echo ""
echo "3. Projets existants :"
PROJECTS=$(curl -sf -H "Authorization: Bearer $TOKEN" "$COOLIFY_URL/api/v1/projects")
echo "$PROJECTS" | python3 -m json.tool 2>/dev/null || echo "$PROJECTS"

echo ""
echo "=== Prochaines étapes manuelles ==="
echo ""
echo "1. Va sur $COOLIFY_URL"
echo "2. Crée un nouveau projet 'lovable-to-astro'"
echo "3. Ajoute une ressource → Docker → GitHub Repository"
echo "4. Sélectionne le repo simplauto/lovable-to-astro"
echo "5. Configure :"
echo "   - Build Pack: Dockerfile"
echo "   - Port: 4321"
echo "   - Domaine: choisis un domaine ou utilise l'IP"
echo "6. Dans les variables d'environnement, ajoute :"
echo "   GITHUB_WEBHOOK_SECRET=<un_secret_aléatoire>"
echo "   GITHUB_TOKEN=<ton_github_token>"
echo "   GITHUB_SOURCE_REPO=simplauto/<repo_lovable>"
echo "   GITHUB_TARGET_REPO=simplauto/<repo_astro_output>"
echo "   COOLIFY_API_URL=$COOLIFY_URL"
echo "   COOLIFY_API_TOKEN=$TOKEN"
echo "   COOLIFY_PREVIEW_APP_ID=<id_app_preview>"
echo "   COOLIFY_PROD_APP_ID=<id_app_prod>"
echo ""
echo "7. Note l'ID de l'application (visible dans l'URL)"
echo "8. Active le déploiement automatique (webhook GitHub)"
echo ""
echo "Ton token Coolify : $TOKEN"
echo "URL API Coolify : $COOLIFY_URL"
