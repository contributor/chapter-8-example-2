#
# Builds a Docker image.
#
# Environment variables:
#
#   CONTAINER_REGISTRY - The hostname of your container registry.
#   VERSION - The version number to tag the images with.
#
# Usage:
#
#       ./scripts/build-image.sh
#

set -u # or set -o nounset
: "$CONTAINER_REGISTRY"
: "$VERSION"

docker build -t $CONTAINER_REGISTRY/video-streaming:$VERSION --file ./src/video-streaming/Dockerfile-prod .
docker build -t $CONTAINER_REGISTRY/history:$VERSION --file ./src/history/Dockerfile-prod .
docker build -t $CONTAINER_REGISTRY/recommendations:$VERSION --file ./src/recommendations/Dockerfile-prod .
