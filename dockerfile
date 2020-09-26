from node:alpine
workdir /app/travellerstopapi
run npm install ts-node -g
run npm install typescript -g
copy ./package.json .
run npm install
copy ./ ./
cmd ["npm","start"]
