CLUSTER="<+pipeline.variables.environment>-<+pipeline.variables.region>-media-extensions"
SERVICE="example-service-<+pipeline.variables.environment>"

RUNNING_TASK_DEF=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "<+pipeline.variables.region>" \
  --query 'services[0].taskDefinition' \
  --output text 2>/dev/null || echo "")

if [ -z "$RUNNING_TASK_DEF" ] || [ "$RUNNING_TASK_DEF" = "None" ]; then
  TASK_DEF="[]"
else
  TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition "$RUNNING_TASK_DEF" \
    --region "<+pipeline.variables.region>" \
    --query 'taskDefinition.containerDefinitions' \
    --output json 2>/dev/null || echo "[]")
fi

CURRENT_IMAGE_TAG=$(echo "$TASK_DEF" | \
  jq -r '.[] | select(.name=="example-service") | .image | split(":")[1]' 2>/dev/null || echo "")

CURRENT_CONTROLLER_TAG=$(echo "$TASK_DEF" | \
  jq -r '.[] | select(.name=="extension-controller") | .image | split(":")[1]' 2>/dev/null || echo "")

# Each ECR trigger sets only its own tag var; blank → keep deployed tag.
RESOLVED_IMAGE_TAG="<+pipeline.variables.image_tag>"
RESOLVED_CONTROLLER_TAG="<+pipeline.variables.controller_image_tag>"
if [ -z "$RESOLVED_IMAGE_TAG" ]; then
  RESOLVED_IMAGE_TAG="$CURRENT_IMAGE_TAG"
fi
if [ -z "$RESOLVED_CONTROLLER_TAG" ]; then
  RESOLVED_CONTROLLER_TAG="$CURRENT_CONTROLLER_TAG"
fi

if [ -z "$RESOLVED_IMAGE_TAG" ] || [ -z "$RESOLVED_CONTROLLER_TAG" ]; then
  echo "ERROR: Unable to resolve image tags (image_tag='$RESOLVED_IMAGE_TAG', controller_image_tag='$RESOLVED_CONTROLLER_TAG')." >&2
  exit 1
fi

echo "Resolved image_tag: $RESOLVED_IMAGE_TAG"
echo "Resolved controller_image_tag: $RESOLVED_CONTROLLER_TAG"

export RESOLVED_IMAGE_TAG
export RESOLVED_CONTROLLER_TAG
