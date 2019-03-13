#!/bin/bash
set -e
USAGE="Usage: $0 {PACKAGES_BUCKET} {WWW_BUCKET} {STACK_NAME}"
PACKAGES_BUCKET=${1?$USAGE}
WWW_BUCKET=${2?$USAGE}
STACK_NAME=${3?$USAGE}
sam build
sam package --s3-bucket $PACKAGES_BUCKET --output-template-file packaged.yaml
sam deploy --template-file packaged.yaml --stack-name $STACK_NAME --capabilities CAPABILITY_IAM
WSS_URI=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURI`]'.OutputValue --output text)
aws s3 cp --recursive --acl public-read www/ s3://$WWW_BUCKET/
echo $WSS_URI | aws s3 cp --acl public-read - s3://$WWW_BUCKET/wss-uri.txt
