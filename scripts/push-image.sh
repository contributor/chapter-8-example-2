#
# Publishes a Docker image.
#
# Environment variables:
#
#   CONTAINER_REGISTRY - The hostname of your container registry.
#   REGISTRY_UN - User name for your container registry.
#   REGISTRY_PW - Password for your container registry.
#   VERSION - The version number to tag the images with.
#
# Usage:
#
# #       ./scripts/push-image.sh
# #

# set -u # or set -o nounset
# : "$CONTAINER_REGISTRY"
# : "$VERSION"
# : "$REGISTRY_UN"
# : "$REGISTRY_PW"

# echo $REGISTRY_PW | docker login $CONTAINER_REGISTRY --username $REGISTRY_UN --password-stdin
docker push $CONTAINER_REGISTRY/video-streaming:$VERSION
docker push $CONTAINER_REGISTRY/history:$VERSION
docker push $CONTAINER_REGISTRY/recommendations:$VERSION

