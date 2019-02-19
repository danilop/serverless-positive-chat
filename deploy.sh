BUCKET_PACKAGES=positive-chat-packages
BUCKET_WWW=positive-chat-web
STACK_NAME=positive-chat
sam build
sam package --s3-bucket $BUCKET_PACKAGES --output-template-file packaged.yaml
sam deploy --template-file packaged.yaml --stack-name $STACK_NAME --capabilities CAPABILITY_IAM
WSS_URI=$(aws cloudformation describe-stacks --stack-name positive-chat --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURI`]'.OutputValue --output text)
aws s3 cp --recursive --acl public-read www/ s3://$BUCKET_WWW/
echo $WSS_URI | aws s3 cp --acl public-read - s3://$BUCKET_WWW/wss-uri.txt
